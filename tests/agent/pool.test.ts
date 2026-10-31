import { describe, expect, it } from "vitest";
import {
  candidatePoolSchema,
  poolComponentEvidenceStates,
  poolComponentRoles,
  type CandidatePool
} from "../../src/shared/run.js";
import {
  candidateComponentSchema,
  componentEvidenceStates,
  componentRoles,
  validatePool
} from "../../src/server/engine/index.js";
import { AgentToolError } from "../../src/server/agent/errors.js";
import {
  SITE_READ_ANCHOR_CAP,
  createObservationIndex,
  deriveSiteRead,
  formCandidatePool,
  proposeCandidatePoolTool
} from "../../src/server/agent/pool.js";
import { okEnvelope } from "./support/fakes.js";

const DEVOCION = {
  entityId: "urn:entity:place-devocion",
  name: "Devoción",
  type: "place",
  location: { lat: 40.717, lon: -73.958 },
  tags: [{ id: "tag-coffee-1", name: "coffee" }]
};

const NITEHAWK = {
  entityId: "urn:entity:place-nitehawk",
  name: "Nitehawk Cinema",
  type: "place",
  location: { lat: 40.7181, lon: -73.9556 },
  tags: [{ id: "tag-film-1", name: "independent film" }]
};

const SONIC_YOUTH = { entityId: "urn:entity:artist-sonic-youth", name: "Sonic Youth", type: "artist" };

const PROVENANCE = {
  anchorPlace: "Williamsburg, Brooklyn, NY",
  qlooSignal: "coffee",
  resolvedCategory: "urn:tag:coffee",
  exemplarSet: "specialty coffee roasteries",
  tasteNeighborhood: "daytime coffee culture"
};

function component(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "comp-anchor",
    role: "Anchor",
    tags: ["coffee"],
    exemplars: [{ id: DEVOCION.entityId, name: DEVOCION.name }],
    provenancePath: PROVENANCE,
    evidenceState: "measured",
    ...overrides
  };
}

function populatedIndex() {
  const index = createObservationIndex();
  index.record(
    okEnvelope("search", { results: { entities: [DEVOCION, NITEHAWK, SONIC_YOUTH] }, resultCount: 3 }),
    "ev-search"
  );
  index.record(
    okEnvelope("resolveTags", {
      results: { tags: [{ id: "tag-coffee-1", name: "coffee" }] },
      resultCount: 1
    }),
    "ev-tags"
  );
  index.record(
    okEnvelope("insights", {
      results: {
        heatmap: [
          { latitude: 40.715, longitude: -73.962, affinity: 0.8 },
          { latitude: 40.716, longitude: -73.961, affinity: 0.55 },
          { latitude: 999, longitude: -73.961, affinity: 0.5 },
          { latitude: 40.71, longitude: -73.96, affinity: "hot" }
        ]
      },
      resultCount: 2
    }),
    "ev-heat"
  );
  return index;
}

function bulkIndex(count: number) {
  const index = createObservationIndex();
  const entities = Array.from({ length: count }, (_, position) => ({
    entityId: `urn:entity:place-bulk-${position}`,
    name: `Bulk Place ${position}`,
    type: "place",
    location: { lat: 40.71 + position * 0.001, lon: -73.96 },
    tags: [{ id: "tag-coffee-1", name: "coffee" }]
  }));
  index.record(okEnvelope("search", { results: { entities }, resultCount: count }), "ev-bulk");
  index.record(
    okEnvelope("resolveTags", {
      results: { tags: [{ id: "tag-coffee-1", name: "coffee" }] },
      resultCount: 1
    }),
    "ev-bulk-tags"
  );
  return index;
}

function bulkComponent(position: number): Record<string, unknown> {
  return component({
    id: `c-${position}`,
    exemplars: [
      { id: `urn:entity:place-bulk-${position}`, name: `Bulk Place ${position}` }
    ]
  });
}

describe("propose_candidate_pool tool contract", () => {
  it("is offered to the planner with a JSON-schema parameter body", () => {
    expect(proposeCandidatePoolTool.name).toBe("propose_candidate_pool");
    expect(proposeCandidatePoolTool.description.length).toBeGreaterThan(20);
    expect(proposeCandidatePoolTool.parameters.type).toBe("object");
    expect(JSON.parse(JSON.stringify(proposeCandidatePoolTool.parameters))).toEqual(
      proposeCandidatePoolTool.parameters
    );
  });
});

describe("observation index and siteRead derivation", () => {
  it("derives lettered anchors from located observed entities and real heat cells only", () => {
    const siteRead = deriveSiteRead(populatedIndex());

    expect(siteRead).toEqual({
      anchors: [
        {
          id: DEVOCION.entityId,
          label: DEVOCION.name,
          letter: "A",
          lat: 40.717,
          lon: -73.958,
          evidenceId: "ev-search"
        },
        {
          id: NITEHAWK.entityId,
          label: NITEHAWK.name,
          letter: "B",
          lat: 40.7181,
          lon: -73.9556,
          evidenceId: "ev-search"
        }
      ],
      heat: [
        { lat: 40.715, lon: -73.962, weight: 0.8 },
        { lat: 40.716, lon: -73.961, weight: 0.55 }
      ]
    });
  });

  it("exposes only observed entities and tags as grounding for the pool", () => {
    const index = createObservationIndex();
    index.record(
      okEnvelope("search", { results: { entities: [DEVOCION] }, resultCount: 1 }),
      "ev-search"
    );
    index.record(
      okEnvelope("resolveTags", {
        results: { tags: [{ id: "tag-coffee-1", name: "coffee" }] },
        resultCount: 1
      }),
      "ev-tags"
    );

    expect(index.observedEntities()).toEqual([
      {
        entityId: DEVOCION.entityId,
        name: DEVOCION.name,
        location: DEVOCION.location,
        evidenceId: "ev-search"
      }
    ]);
    expect(index.observedTags()).toEqual(["coffee"]);
    expect(index.hasTag("tag-coffee-1")).toBe(true);
  });

  it("returns undefined when nothing located or measured exists — never synthetic anchors", () => {
    const index = createObservationIndex();
    index.record(okEnvelope("search", { results: { entities: [SONIC_YOUTH] }, resultCount: 1 }), "ev-1");

    expect(deriveSiteRead(index)).toBeUndefined();
  });

  it("caps anchors at the lettered capacity and dedupes repeated entities by first evidence", () => {
    const index = createObservationIndex();
    const many = Array.from({ length: 7 }, (_, position) => ({
      entityId: `urn:entity:place-${position}`,
      name: `Place ${position}`,
      type: "place",
      location: { lat: 40.71 + position * 0.001, lon: -73.96 }
    }));
    index.record(okEnvelope("search", { results: { entities: many }, resultCount: 7 }), "ev-first");
    index.record(okEnvelope("describe", { results: { entities: [many[0]] }, resultCount: 1 }), "ev-second");

    const siteRead = deriveSiteRead(index);
    expect(siteRead?.anchors).toHaveLength(SITE_READ_ANCHOR_CAP);
    expect(siteRead?.anchors?.[0]?.evidenceId).toBe("ev-first");
    expect(siteRead?.anchors?.[4]?.letter).toBe("E");
  });
});

describe("formCandidatePool", () => {
  it("accepts a grounded draft, passes engine validatePool and matches the shared schema", () => {
    const pool = formCandidatePool({
      draft: { components: [component()] },
      index: populatedIndex()
    });

    expect(validatePool(pool)).toEqual(pool);
    expect(candidatePoolSchema.parse(pool)).toEqual(pool);
    expect(pool).toHaveLength(1);
    expect(pool[0]?.role).toBe("Anchor");
  });

  it("rejects an exemplar that was never observed", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: { components: [component({ exemplars: [{ id: "urn:entity:place-fabricated", name: "Imaginary Cafe" }] })] },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain("never observed");
  });

  it("names the observed id when an exemplar id looks mistyped", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: {
          components: [
            component({
              exemplars: [{ id: "urn:entity:place-devocion-typo", name: DEVOCION.name }]
            })
          ]
        },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain(DEVOCION.entityId);
    expect((caught as AgentToolError).message).toContain("copy that id exactly");
  });

  it("rejects an exemplar whose name does not match the observed name", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: { components: [component({ exemplars: [{ id: DEVOCION.entityId, name: "Devocion Roasters" }] })] },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain("observed name");
  });

  it("rejects a tag that was never observed", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: { components: [component({ tags: ["coffee culture"] })] },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain('tag "coffee culture"');
  });

  it("reports every unobserved tag in one rejection so repair can fix all at once", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: {
          components: [
            component({
              tags: ["coffee culture", "intimate setting", "local crafts", "souvenirs"]
            })
          ]
        },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    const message = (caught as AgentToolError).message;
    expect(message).toContain('tag "coffee culture"');
    expect(message).toContain('tag "intimate setting"');
    expect(message).toContain('tag "local crafts"');
    expect(message).toContain('tag "souvenirs"');
  });

  it("rejects a structurally invalid component through the engine, without repair", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: { components: [component({ role: "Rocket" })] },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain("failed engine validation");
  });

  it("rejects an empty or oversized draft before the engine sees it", () => {
    expect(() => formCandidatePool({ draft: { components: [] }, index: populatedIndex() })).toThrow(
      AgentToolError
    );
    expect(() =>
      formCandidatePool({
        draft: { components: Array.from({ length: 10 }, (_, i) => bulkComponent(i)) },
        index: bulkIndex(10)
      })
    ).not.toThrow();
    expect(() =>
      formCandidatePool({
        draft: { components: Array.from({ length: 11 }, (_, i) => bulkComponent(i)) },
        index: bulkIndex(11)
      })
    ).toThrow(AgentToolError);
  });

  it("rejects two components built on the same observed exemplar", () => {
    let caught: unknown;
    try {
      formCandidatePool({
        draft: {
          components: [
            component({ id: "anchor" }),
            component({ id: "social", role: "Social", tags: ["coffee"] })
          ]
        },
        index: populatedIndex()
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).message).toContain("both cite exemplar");
    expect((caught as AgentToolError).message).toContain("distinct observed place");
  });
});

describe("shared <-> engine pool conformance", () => {
  it("mirrors the engine role and evidence-state vocabularies exactly", () => {
    expect([...poolComponentRoles]).toEqual([...componentRoles]);
    expect([...poolComponentEvidenceStates]).toEqual([...componentEvidenceStates]);
  });

  it("parses the same component identically in shared and engine schemas", () => {
    const raw = component();
    const shared = candidatePoolSchema.parse([raw]);
    const engine = validatePool([raw]);

    expect(candidateComponentSchema.parse(shared[0])).toEqual(engine[0]);
    expect(shared).toEqual(engine);
  });

  it("lets engine validatePool accept values produced from the shared schema", () => {
    const shared: CandidatePool = candidatePoolSchema.parse([
      component({ exemplars: [{ id: NITEHAWK.entityId, name: NITEHAWK.name }], tags: ["independent film"] })
    ]);

    expect(validatePool(shared)).toEqual(shared);
  });
});
