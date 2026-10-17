import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/shared/errors.js";
import {
  runStateSchema,
  type RunGraphEdge,
  type RunRankedComposition,
  type RunRevision,
  type RunState
} from "../../src/shared/run.js";
import type { ReplaceRequest } from "../../src/shared/routes.js";
import type { QlooEnvelope } from "../../src/server/qloo/index.js";
import type { LlmClient } from "../../src/server/agent/llm.js";
import { createLedger, type Ledger } from "../../src/server/agent/ledger.js";
import { OrchestratorStateError, RunBusyError, createOrchestrator } from "../../src/server/orchestrator/index.js";
import { runMeasurement } from "../../src/server/orchestrator/measure.js";
import { applyReplacement, type ReplaceOutcome } from "../../src/server/orchestrator/replace.js";
import { RunNotFound, createMemoryStore } from "../../src/server/persistence/index.js";
import { makeComponent } from "../engine/fixtures.js";
import {
  TEST_BRIEF,
  TEST_NOW,
  TEST_PRIOR,
  fakeGateway,
  okEnvelope,
  type FakeGateway
} from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, completion, deferred } from "./support.js";

interface InsightsRequest {
  filterType?: string;
  signalEntities?: string[];
  signalLocation?: string;
  filterTags?: string[];
  take?: number;
}

interface FakeEntity {
  entityId: string;
  name?: string;
  type?: string;
  affinity?: number;
  popularity?: number;
}

function entitiesEnvelope(entities: FakeEntity[]): QlooEnvelope<unknown> {
  return okEnvelope("insights", {
    results: { entities, heatmap: [] },
    resultCount: entities.length
  });
}

const COMPONENT_ENTITIES: Record<string, Record<string, FakeEntity[]>> = {
  coffee: {
    artist: [
      { entityId: "urn:entity:artist-alice", name: "Alice Coltrane", type: "artist", affinity: 0.9 },
      { entityId: "urn:entity:artist-sun", name: "Sun Ra", type: "artist", affinity: 0.7 },
      { entityId: "urn:entity:artist-bill", name: "Bill Evans", type: "artist", affinity: 0.6 },
      { entityId: "urn:entity:artist-mary", name: "Mary Lou Williams", type: "artist", affinity: 0.5 },
      { entityId: "urn:entity:artist-thelonious", name: "Thelonious Monk", type: "artist", affinity: 0.4 }
    ],
    movie: [
      { entityId: "urn:entity:film-paris-texas", name: "Paris, Texas", type: "movie", affinity: 0.8 }
    ],
    brand: [{ entityId: "urn:entity:brand-seesaw", name: "Seesaw Coffee", type: "brand", affinity: 0.7 }]
  },
  cinema: {
    artist: [
      { entityId: "urn:entity:artist-miles", name: "Miles Davis", type: "artist", affinity: 0.9 },
      { entityId: "urn:entity:artist-coltrane", name: "John Coltrane", type: "artist", affinity: 0.8 },
      { entityId: "urn:entity:artist-park", name: "Charlie Parker", type: "artist", affinity: 0.55 },
      { entityId: "urn:entity:artist-duke", name: "Duke Ellington", type: "artist", affinity: 0.45 },
      { entityId: "urn:entity:artist-ella", name: "Ella Fitzgerald", type: "artist", affinity: 0.35 }
    ],
    movie: [
      { entityId: "urn:entity:film-in-the-mood", name: "In the Mood for Love", type: "movie", affinity: 0.85 }
    ],
    brand: [{ entityId: "urn:entity:brand-nitehawk", name: "Nitehawk", type: "brand", affinity: 0.65 }]
  },
  books: {
    artist: [
      { entityId: "urn:entity:artist-fela", name: "Fela Kuti", type: "artist", affinity: 0.88 },
      { entityId: "urn:entity:artist-miriam", name: "Miriam Makeba", type: "artist", affinity: 0.72 },
      { entityId: "urn:entity:artist-brian", name: "Brian Eno", type: "artist", affinity: 0.6 },
      { entityId: "urn:entity:artist-sster", name: "Sister Rosetta Tharpe", type: "artist", affinity: 0.5 },
      { entityId: "urn:entity:artist-sun", name: "Sun Ra", type: "artist", affinity: 0.3 }
    ],
    movie: [
      { entityId: "urn:entity:film-wings-of-desire", name: "Wings of Desire", type: "movie", affinity: 0.7 }
    ],
    brand: [{ entityId: "urn:entity:brand-mcnally", name: "McNally Jackson", type: "brand", affinity: 0.8 }]
  }
};

function sharedSignalGateway(request: InsightsRequest): QlooEnvelope<unknown> | undefined {
  const signals = request.signalEntities ?? [];
  const matching = Object.keys(COMPONENT_ENTITIES).filter((key) =>
    signals.includes(`urn:entity:place-${key}`)
  );
  if (matching.length === 0 || request.filterTags !== undefined) {
    return undefined;
  }
  const domain = request.filterType ?? "artist";
  const entities = matching.flatMap((key) => COMPONENT_ENTITIES[key]?.[domain] ?? []);
  const deduped = [...new Map(entities.map((entity) => [entity.entityId, entity])).values()];
  const limited = request.signalLocation !== undefined ? deduped.slice(0, 4) : deduped;
  return entitiesEnvelope(limited);
}

function labels(ledger: Ledger): string[] {
  return ledger.list().map((entry) => entry.event.label);
}

function rankedEntry(
  members: string[],
  coherence: number,
  distinctivenessMean: number,
  percentile: number
): RunRankedComposition {
  return {
    members,
    size: members.length,
    coherence,
    percentile,
    distinctivenessMean,
    weakestLink: { a: members[0]!, b: members[1]!, value: 0.4 },
    rankScore: coherence,
    grade: "B",
    gradeReasons: ["fixture ranking"]
  };
}

function completeEdges(ids: string[]): RunGraphEdge[] {
  const edges: RunGraphEdge[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      edges.push({ a: ids[i]!, b: ids[j]!, value: 0.5, band: "typical", state: "measured" });
    }
  }
  return edges;
}

const MEASURED_POOL = [
  makeComponent({ id: "anchor", role: "Anchor", tags: ["coffee"], exemplars: [{ id: "urn:entity:place-coffee", name: "Devoción" }] }),
  makeComponent({ id: "discovery", role: "Discovery", tags: ["cinema"], exemplars: [{ id: "urn:entity:place-cinema", name: "Nitehawk" }] }),
  makeComponent({ id: "community", role: "Community", tags: ["books"], exemplars: [{ id: "urn:entity:place-books", name: "McNally Jackson" }] }),
  makeComponent({ id: "tea", role: "Community", tags: ["tea"], exemplars: [{ id: "urn:entity:place-tea", name: "T Gallery" }] }),
  makeComponent({ id: "music", role: "Discovery", tags: ["vinyl"], exemplars: [{ id: "urn:entity:place-vinyl", name: "Academy" }] }),
  makeComponent({ id: "extra", role: "Community", tags: ["print"], exemplars: [{ id: "urn:entity:place-print", name: "Printed Matter" }] })
];

const MEASURED_NODES = ["anchor", "community", "discovery", "extra", "music", "tea"];

function measuredState(overrides: Partial<RunState> = {}): RunState {
  return runStateSchema.parse({
    id: "run-replace",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: MEASURED_POOL,
    graph: { nodes: MEASURED_NODES, edges: completeEdges(MEASURED_NODES) },
    compositions: {
      ranked: [
        rankedEntry(["anchor", "discovery", "community"], 0.72, 0.61, 88.2),
        rankedEntry(["anchor", "discovery", "tea"], 0.68, 0.55, 71.6),
        rankedEntry(["anchor", "discovery", "music"], 0.64, 0.58, 66.0),
        rankedEntry(["anchor", "music", "community"], 0.62, 0.57, 60.0),
        rankedEntry(["anchor", "music", "tea"], 0.58, 0.5, 50.0)
      ],
      excluded: [],
      triangulation: [],
      rivalFlips: [],
      family: {
        poolSize: 6,
        size: 3,
        requiredRoles: ["Anchor"],
        totalCandidates: 20,
        totalValid: 5,
        coherenceDistribution: [0.58, 0.62, 0.64, 0.68, 0.72]
      },
      prior: { state: "not measured", reason: "fixture prior has no measured counterpart" }
    },
    ...overrides
  });
}

function revisionFixture(rev: number): RunRevision {
  return {
    rev,
    replacedMember: "community",
    newMember: "tea",
    role: "Community",
    membersBefore: ["anchor", "discovery", "community"],
    membersAfter: ["anchor", "discovery", "tea"],
    coherenceBefore: 0.72,
    coherenceAfter: 0.68,
    percentileBefore: 88.2,
    percentileAfter: 71.6,
    custom: false
  };
}

async function runReplace(
  state: RunState,
  request: ReplaceRequest,
  fake: FakeGateway
): Promise<{ outcome: ReplaceOutcome; ledger: Ledger }> {
  const ledger = createLedger();
  const outcome = await applyReplacement({ state, request, gateway: fake.gateway, ledger, now: () => TEST_NOW });
  return { outcome, ledger };
}

async function measuredThreePool(): Promise<RunState> {
  const ledger = createLedger();
  const fake = fakeGateway({
    onCall: (call) => {
      if (call.operation === "resolveTags") {
        return okEnvelope("resolveTags", {
          results: { tags: [{ id: "urn:tag:cuisine:qloo:coffee", name: "coffee", type: "Interest" }] },
          resultCount: 1
        });
      }
      if (call.operation === "insights") {
        const request = call.request as InsightsRequest;
        const response = sharedSignalGateway(request);
        if (response !== undefined) {
          return response;
        }
        const domain = request.filterType ?? "artist";
        const entities = Object.keys(COMPONENT_ENTITIES).flatMap(
          (key) => COMPONENT_ENTITIES[key]?.[domain] ?? []
        );
        const deduped = [...new Map(entities.map((entity) => [entity.entityId, entity])).values()];
        const limited = request.signalLocation !== undefined ? deduped.slice(0, 4) : deduped;
        return entitiesEnvelope(limited);
      }
      return okEnvelope(call.operation);
    }
  });
  const pool = [
    makeComponent({ id: "coffee", role: "Anchor", tags: ["coffee"], exemplars: [{ id: "urn:entity:place-coffee", name: "Devoción" }] }),
    makeComponent({ id: "cinema", role: "Discovery", tags: ["cinema"], exemplars: [{ id: "urn:entity:place-cinema", name: "Nitehawk" }] }),
    makeComponent({ id: "books", role: "Community", tags: ["books"], exemplars: [{ id: "urn:entity:place-books", name: "McNally Jackson" }] })
  ];
  const base = runStateSchema.parse({
    id: "run-replace-custom",
    status: "complete",
    phase: "measurement",
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    candidatePool: pool
  });
  const result = await runMeasurement({
    state: base,
    gateway: fake.gateway,
    ledger,
    now: () => TEST_NOW,
    shouldStop: () => false
  });
  return result.state;
}

function customFake(): FakeGateway {
  return fakeGateway({
    onCall: (call) => {
      if (call.operation === "resolveTags") {
        return okEnvelope("resolveTags", {
          results: { tags: [{ id: "urn:tag:music:ambient:qloo", name: "ambient jazz", type: "Interest" }] },
          resultCount: 1
        });
      }
      if (call.operation === "insights") {
        const request = call.request as InsightsRequest;
        if (request.filterTags !== undefined) {
          return entitiesEnvelope([
            { entityId: "urn:entity:place-ambient-1", name: "Ambient Room", type: "place", affinity: 0.9, popularity: 0.5 },
            { entityId: "urn:entity:place-ambient-2", name: "Drift Hall", type: "place", affinity: 0.8, popularity: 0.4 }
          ]);
        }
        return entitiesEnvelope(COMPONENT_ENTITIES.coffee?.artist ?? []);
      }
      return okEnvelope(call.operation);
    }
  });
}

describe("applyReplacement candidate path", () => {
  it("swaps a same-role pool candidate with zero Qloo calls, engine-true deltas, a revision, and a mini-stress report", async () => {
    const state = measuredState();
    const fake = fakeGateway();
    const { outcome, ledger } = await runReplace(state, { targetComponentId: "community", candidateId: "tea" }, fake);

    expect(fake.calls).toHaveLength(0);
    expect(outcome.delta.coherence).toBeCloseTo(0.68 - 0.72, 10);
    expect(outcome.delta.distinctiveness).toBeCloseTo(0.55 - 0.61, 10);
    expect(outcome.weakestLink).toEqual({ a: "anchor", b: "discovery", value: 0.4 });

    expect(outcome.state.candidatePool).toEqual(state.candidatePool);
    expect(outcome.state.compositions).toEqual(state.compositions);

    const revisions = outcome.state.revisions ?? [];
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toEqual({
      rev: 1,
      replacedMember: "community",
      newMember: "tea",
      role: "Community",
      membersBefore: ["anchor", "discovery", "community"],
      membersAfter: ["anchor", "discovery", "tea"],
      coherenceBefore: 0.72,
      coherenceAfter: 0.68,
      percentileBefore: 88.2,
      percentileAfter: 71.6,
      custom: false,
      at: TEST_NOW
    });

    const stress = outcome.state.stressReport as {
      kind: string;
      trigger: string;
      rev: number;
      verdict: string;
      attacks: Array<{ kind: string; status: string }>;
    };
    expect(stress.kind).toBe("mini");
    expect(stress.trigger).toBe("replace");
    expect(stress.rev).toBe(1);
    expect(stress.verdict).toBe("Revised");
    expect(stress.attacks.map((attack) => attack.kind)).toEqual(["ablation", "rival"]);

    expect(labels(ledger)).toEqual(["replace.stress", "replace.apply"]);
    expect(outcome.evidence).toEqual([]);
  });

  it("is deterministic across two identical measured runs", async () => {
    const state = measuredState();
    const first = await runReplace(state, { targetComponentId: "community", candidateId: "tea" }, fakeGateway());
    const second = await runReplace(state, { targetComponentId: "community", candidateId: "tea" }, fakeGateway());
    expect(second.outcome.state).toEqual(first.outcome.state);
    expect(second.outcome.delta).toEqual(first.outcome.delta);
    expect(second.outcome.weakestLink).toEqual(first.outcome.weakestLink);
    expect(labels(second.ledger)).toEqual(labels(first.ledger));
  });

  it("increments the revision counter across sequential replacements", async () => {
    const state = measuredState();
    const first = await runReplace(state, { targetComponentId: "community", candidateId: "tea" }, fakeGateway());
    const second = await runReplace(
      first.outcome.state,
      { targetComponentId: "discovery", candidateId: "music" },
      fakeGateway()
    );
    const revisions = second.outcome.state.revisions ?? [];
    expect(revisions).toHaveLength(2);
    expect(revisions[1]?.rev).toBe(2);
    expect(revisions[1]?.replacedMember).toBe("discovery");
    expect(revisions[1]?.newMember).toBe("music");
    expect(second.outcome.state.stressReport).toMatchObject({ kind: "mini", rev: 2 });
  });

  it("refuses unknown candidates, members already in the composition, role mismatches, and off-ranked swaps", async () => {
    const state = measuredState();
    const cases: Array<[ReplaceRequest, string]> = [
      [{ targetComponentId: "community", candidateId: "ghost" }, "not in the measured candidate pool"],
      [{ targetComponentId: "community", candidateId: "anchor" }, "already sits in the target composition"],
      [{ targetComponentId: "community", candidateId: "music" }, "replace preserves the role"],
      [{ targetComponentId: "community", candidateId: "extra" }, "does not match a ranked composition"]
    ];
    for (const [request, fragment] of cases) {
      const fake = fakeGateway();
      await expect(runReplace(state, request, fake)).rejects.toThrow(fragment);
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("refuses targets outside the pool and targets with no ranked role", async () => {
    const state = measuredState();
    await expect(
      runReplace(state, { targetComponentId: "ghost", candidateId: "tea" }, fakeGateway())
    ).rejects.toThrow("not in the measured candidate pool");
    await expect(
      runReplace(state, { targetComponentId: "extra", candidateId: "tea" }, fakeGateway())
    ).rejects.toThrow("not part of any ranked composition");
  });

  it("requires exactly one of candidateId or customQuery", async () => {
    const state = measuredState();
    await expect(
      runReplace(state, { targetComponentId: "community", candidateId: "tea", customQuery: "jazz" } as ReplaceRequest, fakeGateway())
    ).rejects.toThrow("exactly one of candidateId or customQuery");
    await expect(runReplace(state, { targetComponentId: "community" }, fakeGateway())).rejects.toThrow(
      "exactly one of candidateId or customQuery"
    );
  });

  it("targets the selected composition through compositionKey instead of the default first match", async () => {
    const state = measuredState();
    const fake = fakeGateway();
    const { outcome } = await runReplace(
      state,
      { targetComponentId: "community", candidateId: "tea", compositionKey: " anchor|music+community " },
      fake
    );
    expect(fake.calls).toHaveLength(0);
    const revisions = outcome.state.revisions ?? [];
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toEqual({
      rev: 1,
      replacedMember: "community",
      newMember: "tea",
      role: "Community",
      membersBefore: ["anchor", "music", "community"],
      membersAfter: ["anchor", "music", "tea"],
      coherenceBefore: 0.62,
      coherenceAfter: 0.58,
      percentileBefore: 60.0,
      percentileAfter: 50.0,
      custom: false,
      at: TEST_NOW
    });
    expect(outcome.delta.coherence).toBeCloseTo(0.58 - 0.62, 10);
    expect(outcome.delta.distinctiveness).toBeCloseTo(0.5 - 0.57, 10);
  });

  it("refuses unknown keyed compositions and members outside the selected composition", async () => {
    const state = measuredState();
    const unknownKey = fakeGateway();
    await expect(
      runReplace(
        state,
        { targetComponentId: "community", candidateId: "tea", compositionKey: "anchor+discovery+ghost" },
        unknownKey
      )
    ).rejects.toThrow("is not part of the ranked family");
    expect(unknownKey.calls).toHaveLength(0);

    const wrongMember = fakeGateway();
    await expect(
      runReplace(
        state,
        { targetComponentId: "community", candidateId: "extra", compositionKey: "anchor+discovery+tea" },
        wrongMember
      )
    ).rejects.toThrow("not a member of the selected composition");
    expect(wrongMember.calls).toHaveLength(0);
  });
});

describe("applyReplacement state guards", () => {
  it("refuses resumable, stopped, and failed runs before any other work", async () => {
    for (const status of ["prior_pending", "investigating", "stopped", "failed"] as const) {
      const fake = fakeGateway();
      await expect(
        runReplace(measuredState({ status }), { targetComponentId: "community", candidateId: "tea" }, fake)
      ).rejects.toThrow(OrchestratorStateError);
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("refuses when the revision ledger is already full", async () => {
    const revisions = Array.from({ length: 100 }, (_, index) => revisionFixture(index + 1));
    const fake = fakeGateway();
    await expect(
      runReplace(measuredState({ revisions }), { targetComponentId: "community", candidateId: "tea" }, fake)
    ).rejects.toThrow("already carries 100 replace revisions");
    expect(fake.calls).toHaveLength(0);
  });
});

describe("applyReplacement custom path", () => {
  it("resolves a custom query with exactly four Qloo calls, rebuilds measurement, and appends one custom revision", async () => {
    const base = await measuredThreePool();
    const fake = customFake();
    const ledger = createLedger();
    const outcome = await applyReplacement({
      state: base,
      request: { targetComponentId: "coffee", customQuery: "ambient jazz" },
      gateway: fake.gateway,
      ledger,
      now: () => TEST_NOW
    });

    expect(fake.calls).toHaveLength(4);
    expect(fake.calls[0]?.operation).toBe("resolveTags");
    expect(fake.calls[1]?.operation).toBe("insights");
    const placeRequest = fake.calls[1]?.request as InsightsRequest;
    expect(placeRequest.filterTags).toEqual(["urn:tag:music:ambient:qloo"]);
    const siteRequest = fake.calls[2]?.request as InsightsRequest;
    expect(siteRequest.filterType).toBe("artist");
    expect(siteRequest.signalLocation).toBe("Williamsburg, Brooklyn, NY");
    const cityRequest = fake.calls[3]?.request as InsightsRequest;
    expect(cityRequest.filterType).toBe("artist");
    expect(cityRequest.signalLocation).toBeUndefined();

    const pool = outcome.state.candidatePool ?? [];
    expect(pool).toHaveLength(4);
    const created = pool.find((component) => component.id === "comp-ambient-jazz");
    expect(created).toBeDefined();
    expect(created?.role).toBe("Anchor");
    expect(created?.tags).toEqual(["ambient jazz"]);
    expect(created?.exemplars).toHaveLength(2);
    expect(created?.provenancePath.anchorPlace).toBe("Williamsburg, Brooklyn, NY");
    expect(created?.provenancePath.qlooSignal).toBe("ambient jazz");
    expect(created?.provenancePath.resolvedCategory).toBe("urn:tag:music:ambient:qloo");
    expect(created?.evidenceState).toBe("measured");

    expect(outcome.state.culturalDna).toEqual(base.culturalDna);
    expect(outcome.state.neighborhoods?.components).toHaveLength(4);
    expect(outcome.state.neighborhoods?.city).toHaveLength(4);
    expect(outcome.state.neighborhoods?.sources).toHaveLength((base.neighborhoods?.sources.length ?? 0) + 2);
    expect(outcome.state.graph?.nodes).toContain("comp-ambient-jazz");
    expect(outcome.state.compositions?.ranked.length).toBeGreaterThan(0);
    expect(
      outcome.state.compositions?.ranked.some((composition) => composition.members.includes("comp-ambient-jazz"))
    ).toBe(true);

    const revisions = outcome.state.revisions ?? [];
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.custom).toBe(true);
    expect(revisions[0]?.newMember).toBe("comp-ambient-jazz");
    expect(revisions[0]?.replacedMember).toBe("coffee");
    expect(revisions[0]?.role).toBe("Anchor");

    expect(outcome.evidence).toHaveLength(4);
    const labelList = labels(ledger);
    expect(labelList).toEqual([
      "replace.resolve_tag",
      "replace.exemplar_probe",
      "replace.neighborhood_fetch",
      "replace.neighborhood_fetch",
      "replace.measure",
      "replace.stress",
      "replace.apply"
    ]);
  });

  it("re-derives stored triangulation route1 against the rebuilt graph while carrying probes forward", async () => {
    const base = await measuredThreePool();
    const withStale = runStateSchema.parse({
      ...base,
      compositions: {
        ...base.compositions!,
        triangulation: [
          {
            a: "cinema",
            b: "books",
            state: "confirmed",
            route1State: "measured",
            route1Value: 0.99,
            resultCount: 9,
            focalInTopHalf: true
          }
        ]
      }
    });
    const fake = customFake();
    const ledger = createLedger();
    const outcome = await applyReplacement({
      state: withStale,
      request: { targetComponentId: "coffee", customQuery: "ambient jazz" },
      gateway: fake.gateway,
      ledger,
      now: () => TEST_NOW
    });

    const entries = outcome.state.compositions?.triangulation ?? [];
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.a).toBe("cinema");
    expect(entry.b).toBe("books");
    expect(entry.resultCount).toBe(9);
    expect(entry.focalInTopHalf).toBe(true);
    const edge = outcome.state.graph?.edges.find(
      (candidate) =>
        (candidate.a === "cinema" && candidate.b === "books") ||
        (candidate.a === "books" && candidate.b === "cinema")
    );
    expect(edge).toBeDefined();
    expect(entry.route1Value).toBe(edge?.value);
    expect(entry.route1State).toBe(edge?.state);
    expect(entry.route1Value).not.toBe(0.99);
  });

  it("reports UNKNOWN_ENTITY and leaves the state untouched when the query resolves to no tag", async () => {
    const base = await measuredThreePool();
    const fake = fakeGateway({
      onCall: (call) => {
        if (call.operation === "resolveTags") {
          return okEnvelope("resolveTags", { results: { tags: [] }, resultCount: 0 });
        }
        return okEnvelope(call.operation);
      }
    });
    const ledger = createLedger();
    let caught: unknown;
    try {
      await applyReplacement({
        state: base,
        request: { targetComponentId: "coffee", customQuery: "nothing here" },
        gateway: fake.gateway,
        ledger,
        now: () => TEST_NOW
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("UNKNOWN_ENTITY");
    expect((caught as ApiError).message).toContain("resolved to no Qloo tag");
    expect(fake.calls).toHaveLength(1);
    expect(labels(ledger)).toEqual(["replace.resolve_tag"]);
  });

  it("refuses a custom replacement when the pool is already at capacity, without calling Qloo", async () => {
    const pool = [
      ...MEASURED_POOL,
      makeComponent({ id: "print-1", role: "Discovery" }),
      makeComponent({ id: "print-2", role: "Community" }),
      makeComponent({ id: "print-3", role: "Anchor" }),
      makeComponent({ id: "print-4", role: "Discovery" })
    ];
    expect(pool).toHaveLength(10);
    const state = measuredState({ candidatePool: pool });
    const fake = customFake();
    await expect(
      runReplace(state, { targetComponentId: "community", customQuery: "ambient jazz" }, fake)
    ).rejects.toThrow("the schema cap is 10");
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses a custom replacement the gateway budget cannot finish", async () => {
    const base = await measuredThreePool();
    const lean = customFake();
    const gateway = {
      capabilities: lean.gateway.capabilities,
      search: lean.gateway.search,
      resolveTags: lean.gateway.resolveTags,
      insights: lean.gateway.insights,
      describe: lean.gateway.describe,
      bridge: lean.gateway.bridge,
      replace: lean.gateway.replace,
      triangulate: lean.gateway.triangulate,
      close: lean.gateway.close,
      get stats() {
        return { budgetUsed: 177, budgetRemaining: 3, cacheSize: 0, cacheHits: 0 };
      }
    } as typeof lean.gateway;
    const ledger = createLedger();
    await expect(
      applyReplacement({
        state: base,
        request: { targetComponentId: "coffee", customQuery: "ambient jazz" },
        gateway,
        ledger,
        now: () => TEST_NOW
      })
    ).rejects.toThrow(OrchestratorStateError);
    expect(lean.calls).toHaveLength(0);
  });

  it("refuses an empty custom query after trimming", async () => {
    const base = await measuredThreePool();
    const fake = customFake();
    await expect(
      runReplace(base, { targetComponentId: "coffee", customQuery: "   " }, fake)
    ).rejects.toThrow("customQuery must carry 1 to 200 characters");
    expect(fake.calls).toHaveLength(0);
  });
});

function gatedLlm(gate: Promise<void>, onInvestigate?: () => void): LlmClient {
  return {
    async complete(request) {
      if (request.label.startsWith("prior")) {
        return completion(PRIOR_RESPONSE);
      }
      onInvestigate?.();
      await gate;
      return completion(FINAL_TURN.content);
    }
  };
}

describe("orchestrator.replaceComponent", () => {
  it("rejects unknown runs with RunNotFound", async () => {
    const store = createMemoryStore();
    const orchestrator = createOrchestrator({
      store,
      gateway: fakeGateway().gateway,
      llm: gatedLlm(Promise.resolve()),
      now: () => TEST_NOW
    });
    await expect(
      orchestrator.replaceComponent("run-missing", { targetComponentId: "community", candidateId: "tea" })
    ).rejects.toThrow(RunNotFound);
  });

  it("persists the revision, delta, weakest link, and ledger events through the store", async () => {
    const state = measuredState();
    const store = createMemoryStore();
    await store.createRun({ id: state.id, state });
    const orchestrator = createOrchestrator({
      store,
      gateway: fakeGateway().gateway,
      llm: gatedLlm(Promise.resolve()),
      now: () => TEST_NOW
    });

    const response = await orchestrator.replaceComponent(state.id, {
      targetComponentId: "community",
      candidateId: "tea"
    });

    expect(response.delta).toEqual({ coherence: 0.68 - 0.72, distinctiveness: 0.55 - 0.61 });
    expect(response.weakestLink).toEqual({ a: "anchor", b: "discovery", value: 0.4 });
    expect(response.run.revisions).toHaveLength(1);
    expect(response.run.stressReport).toMatchObject({ kind: "mini", trigger: "replace", rev: 1 });

    const stored = await store.loadRun(state.id);
    expect(stored?.state.revisions).toHaveLength(1);
    expect(stored?.state.revisions?.[0]?.newMember).toBe("tea");

    const ledger = await store.listLedgerEvents(state.id);
    const ledgerLabels = ledger.map((entry) => entry.event.label);
    expect(ledgerLabels).toContain("replace.stress");
    expect(ledgerLabels).toContain("replace.apply");
  });

  it("rejects a replacement while a pass is running", async () => {
    const store = createMemoryStore();
    const gate = deferred();
    const reached = deferred();
    const llm = gatedLlm(gate.promise, reached.resolve);
    const firstStateDeferred = deferred<RunState>();
    const orchestrator = createOrchestrator({
      store,
      gateway: fakeGateway().gateway,
      llm,
      now: () => TEST_NOW,
      eventSink: (event) => {
        if (event.type === "state") firstStateDeferred.resolve(event.payload as RunState);
      }
    });

    const runPromise = orchestrator.startRun({ brief: TEST_BRIEF });
    const started = await firstStateDeferred.promise;
    await reached.promise;

    await expect(
      orchestrator.replaceComponent(started.id, { targetComponentId: "coffee", candidateId: "tea" })
    ).rejects.toThrow(RunBusyError);

    gate.resolve();
    await runPromise;
  });
});
