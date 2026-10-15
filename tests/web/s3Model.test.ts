import { describe, expect, it } from "vitest";
import { runStateSchema, type RunGraphEdge, type RunState } from "../../src/shared/run.js";
import {
  HOW_COMPUTED,
  SCALE_NOTE,
  STRESS_HIGH,
  UNMEASURED_COPY,
  buildNodeSheet,
  buildPairEvidence,
  buildS3Model,
  buildStressSentence,
  lineStyleFor,
  normalizeCompositionKey,
  pairKey,
  pairStateFor
} from "../../src/web/screens/s3/s3Model.js";
import { prettifyMemberId } from "../../src/web/screens/s2/s2Model.js";

function shared(
  entityId: string,
  domain: "artist" | "movie" | "brand",
  aWeight: number,
  bWeight: number,
  idf: number,
  dotContribution: number,
  name?: string
) {
  return {
    entityId,
    domain,
    aWeight,
    bWeight,
    idf,
    dotContribution,
    ...(name !== undefined ? { name } : {})
  };
}

function poolComponent(
  id: string,
  role: "Anchor" | "Social" | "Discovery" | "Experience" | "Night" | "Community"
) {
  return {
    id,
    role,
    tags: [id],
    exemplars: [
      { id: `urn:entity:place-${id}`, name: prettifyMemberId(id) },
      { id: `urn:entity:place-${id}-2`, name: `${prettifyMemberId(id)} Two` }
    ],
    provenancePath: {
      anchorPlace: "Anchor Place",
      qlooSignal: `signal-${id}`,
      resolvedCategory: `category-${id}`,
      exemplarSet: `exemplars-${id}`,
      tasteNeighborhood: `neighborhood-${id}`
    },
    evidenceState: "measured" as const
  };
}

function fixtureGraph(): { nodes: string[]; edges: RunGraphEdge[] } {
  return {
    nodes: ["coffee", "cinema", "books", "music", "gallery"],
    edges: [
      {
        a: "coffee",
        b: "cinema",
        value: 0.8,
        band: "strong",
        state: "measured",
        sharedEntities: [
          shared("urn:entity:place-coffee", "artist", 0.9, 0.4, 2.5, 0.5),
          shared("urn:entity:artist-b", "artist", 0.7, 0.6, 1.8, 0.3),
          shared("urn:entity:movie-c", "movie", 0.5, 0.5, 1.2, 0.1)
        ]
      },
      {
        a: "coffee",
        b: "music",
        value: 0.7,
        band: "typical",
        state: "measured",
        sharedEntities: [
          shared("urn:entity:artist-d", "artist", 0.8, 0.7, 2.0, 0.4),
          shared("urn:entity:brand-e", "brand", 0.6, 0.5, 1.5, 0.2)
        ]
      },
      {
        a: "coffee",
        b: "books",
        value: 0.55,
        band: "typical",
        state: "measured",
        sharedEntities: [shared("urn:entity:artist-f", "artist", 0.5, 0.5, 1.4, 0.2)]
      },
      {
        a: "cinema",
        b: "music",
        value: 0.5,
        band: "weak",
        state: "measured",
        sharedEntities: [shared("urn:entity:movie-g", "movie", 0.4, 0.4, 1.1, 0.1)]
      },
      {
        a: "coffee",
        b: "gallery",
        value: null,
        band: null,
        state: "unmeasured"
      },
      {
        a: "books",
        b: "music",
        value: 0.4,
        band: "weak",
        state: "measured",
        sharedEntities: [shared("urn:entity:artist-h", "artist", 0.4, 0.4, 1.3, 0.1)]
      },
      {
        a: "cinema",
        b: "gallery",
        value: null,
        band: null,
        state: "unmeasured"
      },
      {
        a: "cinema",
        b: "books",
        value: 0.65,
        band: "typical",
        state: "measured",
        sharedEntities: [shared("urn:entity:movie-i", "movie", 0.5, 0.4, 1.6, 0.2)]
      },
      {
        a: "music",
        b: "gallery",
        value: 0.5,
        band: "weak",
        state: "measured",
        sharedEntities: []
      },
      {
        a: "books",
        b: "gallery",
        value: 0.3,
        band: "weak",
        state: "measured",
        sharedEntities: [shared("urn:entity:brand-k", "brand", 0.3, 0.3, 0.9, 0.05)]
      }
    ]
  };
}

function baseCompositions(overrides: Partial<NonNullable<RunState["compositions"]>> = {}) {
  return {
    family: {
      poolSize: 5,
      size: 5,
      requiredRoles: ["Anchor" as const],
      totalCandidates: 10,
      totalValid: 10,
      coherenceDistribution: [0.35, 0.4, 0.5, 0.6, 0.72]
    },
    ranked: [
      {
        members: ["coffee", "cinema", "music"],
        size: 3,
        coherence: 0.72,
        percentile: 78,
        distinctivenessMean: 0.5,
        weakestLink: { a: "coffee", b: "cinema", value: 0.3 },
        rankScore: 1.2,
        grade: "A" as const,
        gradeReasons: ["edge coffee|cinema state=confirmed"]
      },
      {
        members: ["coffee", "music", "books"],
        size: 3,
        coherence: 0.66,
        percentile: 64,
        distinctivenessMean: 0.55,
        weakestLink: { a: "coffee", b: "music", value: 0.35 },
        rankScore: 1.0,
        grade: "B" as const,
        gradeReasons: ["measured edges"]
      },
      {
        members: ["cinema", "music", "gallery"],
        size: 3,
        coherence: 0.5,
        percentile: 42,
        distinctivenessMean: 0.7,
        weakestLink: { a: "cinema", b: "gallery", value: 0.25 },
        rankScore: 0.8,
        grade: "C" as const,
        gradeReasons: ["thin triangulation"]
      }
    ],
    excluded: [],
    triangulation: [
      {
        a: "music",
        b: "coffee",
        state: "confirmed" as const,
        route1State: "measured" as const,
        route1Value: 0.7,
        resultCount: 9,
        focalInTopHalf: true
      },
      {
        a: "cinema",
        b: "music",
        state: "contested" as const,
        route1State: "measured" as const,
        route1Value: 0.5,
        resultCount: 8,
        focalInTopHalf: false
      },
      {
        a: "books",
        b: "music",
        state: "thin" as const,
        route1State: "measured" as const,
        route1Value: 0.4,
        resultCount: 2,
        focalInTopHalf: null
      },
      {
        a: "cinema",
        b: "books",
        state: "failed" as const,
        route1State: "measured" as const,
        route1Value: 0.65,
        resultCount: 0,
        focalInTopHalf: null
      }
    ],
    rivalFlips: [],
    prior: {
      state: "not measured" as const,
      reason: "only 1 Prior member(s) resolve against the measured pool; no Prior reading is guessed"
    },
    ...overrides
  };
}

function fixtureState(overrides: Partial<RunState> = {}): RunState {
  const graph = fixtureGraph();
  return runStateSchema.parse({
    id: "run-s3-fixture",
    status: "complete",
    phase: "measurement",
    candidatePool: [
      poolComponent("coffee", "Anchor"),
      poolComponent("cinema", "Discovery"),
      poolComponent("books", "Community"),
      poolComponent("music", "Social"),
      poolComponent("gallery", "Experience")
    ],
    graph,
    compositions: baseCompositions(),
    evidence: [
      { id: "ev-term", kind: "insights", label: "Qloo insights · coffee neighborhood", summary: "site coffee city coffee" },
      { id: "ev-other", kind: "lookup", label: "unrelated lookup", summary: "nothing here" },
      { id: "ev-fallback", kind: "insights", label: "generic insights", summary: "generic" },
      { id: "ev-more1", kind: "insights", label: "insights one", summary: "" },
      { id: "ev-more2", kind: "insights", label: "insights two", summary: "" },
      { id: "ev-more3", kind: "insights", label: "insights three", summary: "" },
      { id: "ev-more4", kind: "insights", label: "insights four", summary: "" }
    ],
    ...overrides
  });
}

function edgeIndexFor(run: RunState): Map<string, RunGraphEdge> {
  return new Map((run.graph?.edges ?? []).map((edge) => [pairKey(edge.a, edge.b), edge]));
}

function triIndexFor(run: RunState): Map<string, NonNullable<RunState["compositions"]>["triangulation"][number]> {
  return new Map(
    (run.compositions?.triangulation ?? []).map((entry) => [pairKey(entry.a, entry.b), entry])
  );
}

describe("pairKey and normalizeCompositionKey", () => {
  it("normalizes pair orientation", () => {
    expect(pairKey("b", "a")).toBe(pairKey("a", "b"));
  });

  it("joins member keys with the canonical delimiter and rejects empty input", () => {
    expect(normalizeCompositionKey("b|a")).toBe("b+a");
    expect(normalizeCompositionKey("  a + b ")).toBe("a+b");
    expect(normalizeCompositionKey("|coffee||cinema|")).toBe("coffee+cinema");
    expect(normalizeCompositionKey("||")).toBeNull();
    expect(normalizeCompositionKey(null)).toBeNull();
  });
});

describe("pairStateFor", () => {
  const measured = (band: "strong" | "typical" | "weak" | null): RunGraphEdge => ({
    a: "x",
    b: "y",
    value: 0.5,
    band,
    state: "measured",
    sharedEntities: [
      shared("urn:entity:z", "artist", 0.5, 0.5, 1, 0.1)
    ]
  });

  it("reports unmeasured for missing edges, unmeasured state, or empty shared entities", () => {
    expect(pairStateFor(null, null)).toBe("unmeasured");
    expect(pairStateFor({ ...measured(null), state: "unmeasured" }, null)).toBe("unmeasured");
    expect(pairStateFor({ ...measured(null), sharedEntities: [] }, null)).toBe("unmeasured");
    expect(pairStateFor({ ...measured(null), sharedEntities: undefined }, null)).toBe("unmeasured");
  });

  it("prefers triangulation state, then falls back to band", () => {
    const tri = {
      a: "x",
      b: "y",
      state: "contested" as const,
      route1State: "measured" as const,
      route1Value: 0.5,
      resultCount: 7,
      focalInTopHalf: false
    };
    expect(pairStateFor(measured("strong"), tri)).toBe("contested");
    expect(pairStateFor(measured("strong"), null)).toBe("strong");
    expect(pairStateFor(measured("typical"), null)).toBe("typical");
    expect(pairStateFor(measured("weak"), null)).toBe("weak");
    expect(pairStateFor(measured(null), null)).toBe("measured");
  });
});

describe("lineStyleFor", () => {
  it("maps states to weights and dash patterns", () => {
    expect(lineStyleFor("confirmed")).toEqual({ widthClass: "l4", dash: null, tone: "ink" });
    expect(lineStyleFor("strong")).toEqual({ widthClass: "l4", dash: null, tone: "ink" });
    expect(lineStyleFor("typical")).toEqual({ widthClass: "l3", dash: null, tone: "ink-800" });
    expect(lineStyleFor("weak").widthClass).toBe("l2");
    expect(lineStyleFor("thin").dash).toBe("1 3");
    expect(lineStyleFor("contested").dash).toBe("6 4");
    expect(lineStyleFor("failed").dash).toBe("6 4");
    expect(lineStyleFor("unmeasured").widthClass).toBe("l5");
    expect(lineStyleFor("unmeasured").dash).toBe("4 4");
  });
});

describe("buildStressSentence", () => {
  it("reports clean accuracy without a pair count", () => {
    expect(buildStressSentence({ stress: 0.05, distortedCount: 0, jitter: false })).toBe(
      "This map keeps most pairwise distances accurately."
    );
  });

  it("counts distorted pairs", () => {
    expect(buildStressSentence({ stress: 0.1, distortedCount: 2, jitter: false })).toBe(
      "This map keeps most pairwise distances accurately. 2 pairs are drawn closer than they were measured."
    );
    expect(buildStressSentence({ stress: 0.1, distortedCount: 1, jitter: false })).toContain(
      "1 pair is drawn closer"
    );
  });

  it("points to the distance chart under high stress or jitter", () => {
    expect(
      buildStressSentence({ stress: STRESS_HIGH + 0.05, distortedCount: 3, jitter: false })
    ).toBe("The distance chart reads every pair exactly. 3 pairs are drawn closer than they were measured.");
    expect(buildStressSentence({ stress: 0.9, distortedCount: 4, jitter: true })).toBe(
      "The distance chart reads every pair exactly."
    );
  });
});

describe("buildS3Model guards", () => {
  it("returns null without a run, graph, or compositions", () => {
    expect(buildS3Model(null)).toBeNull();
    expect(buildS3Model(fixtureState({ graph: undefined }))).toBeNull();
    expect(buildS3Model(fixtureState({ compositions: undefined }))).toBeNull();
  });
});

describe("buildS3Model layout determinism", () => {
  it("produces byte-identical positions across rebuilds", () => {
    const first = buildS3Model(fixtureState());
    const second = buildS3Model(fixtureState());
    expect(first).not.toBeNull();
    expect(JSON.stringify(first?.nodes)).toBe(JSON.stringify(second?.nodes));
  });

  it("produces identical positions when edge order is shuffled", () => {
    const state = fixtureState();
    const reversed = fixtureState({
      graph: { nodes: [...(state.graph?.nodes ?? [])], edges: [...(state.graph?.edges ?? [])].reverse() }
    });
    const first = buildS3Model(state);
    const second = buildS3Model(reversed);
    expect(first).not.toBeNull();
    const firstPositions = (first?.nodes ?? []).map((node) => [node.x, node.y]);
    const secondPositions = (second?.nodes ?? []).map((node) => [node.x, node.y]);
    expect(firstPositions).toEqual(secondPositions);
  });

  it("keeps every node inside the unit box", () => {
    const model = buildS3Model(fixtureState());
    for (const node of model?.nodes ?? []) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(1);
    }
  });

  it("exposes a finite stress reading and the locked scale note", () => {
    const model = buildS3Model(fixtureState());
    expect(model?.stress.stress).toBeGreaterThanOrEqual(0);
    expect(model?.stress.distortedCount).toBeGreaterThanOrEqual(0);
    expect(model?.scaleNote).toBe(SCALE_NOTE);
    expect(model?.stressSentence.length).toBeGreaterThan(0);
  });
});

describe("buildS3Model selection", () => {
  it("builds A/B/C options from ranked compositions and defaults to the leader", () => {
    const model = buildS3Model(fixtureState());
    expect(model?.options.map((option) => option.letter)).toEqual(["A", "B", "C"]);
    expect(model?.selected?.letter).toBe("A");
    expect(model?.selected?.key).toBe("coffee+cinema+music");
  });

  it("honors a requested composition key and falls back for unknown keys", () => {
    const requested = buildS3Model(fixtureState(), "cinema+music+gallery");
    expect(requested?.selected?.key).toBe("cinema+music+gallery");
    const unknown = buildS3Model(fixtureState(), "nothing+here");
    expect(unknown?.selected?.letter).toBe("A");
  });

  it("adds a Prior option only when the prior is measured", () => {
    const measured = buildS3Model(
      fixtureState({
        compositions: baseCompositions({
          prior: { state: "measured", members: ["coffee", "cinema"], coherence: 0.55, percentile: 61 }
        })
      })
    );
    expect(measured?.options.map((option) => option.letter)).toEqual(["A", "B", "C", "P"]);
    expect(measured?.options[3]?.kind).toBe("prior");
  });
});

describe("buildS3Model map and chart", () => {
  it("draws lines only for selected-composition member pairs", () => {
    const model = buildS3Model(fixtureState());
    const memberPairs = (model?.mapEdges ?? []).map((edge) => edge.key);
    expect(memberPairs).toEqual(
      expect.arrayContaining([
        pairKey("coffee", "cinema"),
        pairKey("coffee", "music"),
        pairKey("cinema", "music")
      ])
    );
    expect(memberPairs).toHaveLength(3);
    expect(memberPairs).not.toContain(pairKey("books", "gallery"));
    const memberFlags = new Map((model?.nodes ?? []).map((node) => [node.id, node.member]));
    expect(memberFlags.get("coffee")).toBe(true);
    expect(memberFlags.get("cinema")).toBe(true);
    expect(memberFlags.get("music")).toBe(true);
    expect(memberFlags.get("books")).toBe(false);
    expect(memberFlags.get("gallery")).toBe(false);
  });

  it("covers every node pair exactly once in the chart and the sorted list", () => {
    const model = buildS3Model(fixtureState());
    expect(model?.chartCells).toHaveLength(10);
    expect(model?.pairs).toHaveLength(10);
    const cellKeys = (model?.chartCells ?? []).map((cell) => cell.pairKey);
    const pairKeys = (model?.pairs ?? []).map((pair) => pair.key);
    expect(new Set(cellKeys).size).toBe(10);
    expect([...pairKeys].sort()).toEqual([...cellKeys].sort());
  });

  it("sorts the pair list with unmeasured pairs last", () => {
    const model = buildS3Model(fixtureState());
    const states = (model?.pairs ?? []).map((pair) => pair.displayState);
    const lastUnmeasuredIndex = states.lastIndexOf("unmeasured");
    const firstUnmeasuredIndex = states.indexOf("unmeasured");
    if (firstUnmeasuredIndex !== -1) {
      expect(lastUnmeasuredIndex).toBe(states.length - 1);
    }
    expect(states[0]).not.toBe("unmeasured");
  });

  it("flags the weakest link of the selected composition", () => {
    const model = buildS3Model(fixtureState());
    expect(model?.weakest?.headline).toBe("Weakest link: Coffee and Cinema.");
    expect(model?.weakest?.reason).toBe("Shared culture between them is strong.");
    expect(model?.weakest?.key).toBe(pairKey("coffee", "cinema"));
    const weakestPair = (model?.pairs ?? []).find((pair) => pair.isWeakest);
    expect(weakestPair?.key).toBe(pairKey("coffee", "cinema"));
    expect(model?.pulse).toBe(true);
  });

  it("reports an unmeasured weakest link honestly", () => {
    const model = buildS3Model(fixtureState(), "cinema+music+gallery");
    expect(model?.weakest?.headline).toBe("Weakest link: Cinema and Gallery.");
    expect(model?.weakest?.reason).toBe("This pair was not measured.");
  });

  it("marks the measured-but-empty-sharedEntities pair as unmeasured", () => {
    const model = buildS3Model(fixtureState());
    const pair = (model?.pairs ?? []).find(
      (entry) => entry.key === pairKey("music", "gallery")
    );
    expect(pair?.displayState).toBe("unmeasured");
    expect(pair?.value).toBe(0.5);
  });
});

describe("buildPairEvidence", () => {
  it("builds the locked claim, sorted tiles, and how-computed sentence", () => {
    const run = fixtureState();
    const edges = edgeIndexFor(run);
    const tris = triIndexFor(run);
    const evidence = buildPairEvidence(
      run,
      "coffee",
      "cinema",
      edges.get(pairKey("coffee", "cinema")),
      tris.get(pairKey("coffee", "cinema"))
    );
    expect(evidence.unmeasured).toBe(false);
    expect(evidence.claim).toBe(
      `Audiences of ${prettifyMemberId("coffee")} and ${prettifyMemberId("coffee")} Two and ` +
        `${prettifyMemberId("cinema")} and ${prettifyMemberId("cinema")} Two both over-index on ` +
        `${prettifyMemberId("coffee")}, urn:entity:artist-b, urn:entity:movie-c.`
    );
    expect(evidence.provenance).toBe("Qloo");
    expect(evidence.tiles).toHaveLength(3);
    expect(evidence.tiles[0]?.entityId).toBe("urn:entity:place-coffee");
    expect(evidence.tiles[0]?.name).toBe(prettifyMemberId("coffee"));
    expect(evidence.tiles[0]?.fraction).toBe(1);
    expect(evidence.tiles[0]?.rank).toBe(1);
    expect(evidence.tiles[1]?.fraction).toBeCloseTo(0.3 / 0.5);
    expect(evidence.tiles[1]?.rank).toBe(2);
    expect(evidence.tiles[2]?.rank).toBe(3);
    expect(evidence.howComputed).toBe(HOW_COMPUTED);
  });

  it("prefers a persisted entity name over the exemplar and URN fallbacks", () => {
    const run = fixtureState();
    const edges = edgeIndexFor(run);
    const base = edges.get(pairKey("coffee", "cinema"));
    if (base === undefined) {
      throw new Error("fixture edge coffee+cinema is missing");
    }
    const named: RunGraphEdge = {
      ...base,
      sharedEntities: [
        shared("urn:entity:place-coffee", "artist", 0.9, 0.4, 2.5, 0.5, "Counter Coffee"),
        shared("urn:entity:artist-b", "artist", 0.7, 0.6, 1.8, 0.3, "Björk"),
        shared("urn:entity:movie-c", "movie", 0.5, 0.5, 1.2, 0.1)
      ]
    };
    const evidence = buildPairEvidence(run, "coffee", "cinema", named, undefined);
    expect(evidence.claim).toBe(
      `Audiences of ${prettifyMemberId("coffee")} and ${prettifyMemberId("coffee")} Two and ` +
        `${prettifyMemberId("cinema")} and ${prettifyMemberId("cinema")} Two both over-index on ` +
        `Counter Coffee, Björk, urn:entity:movie-c.`
    );
    expect(evidence.tiles[0]?.name).toBe("Counter Coffee");
    expect(evidence.tiles[0]?.rank).toBe(1);
    expect(evidence.tiles[1]?.name).toBe("Björk");
    expect(evidence.tiles[1]?.rank).toBe(2);
    expect(evidence.tiles[2]?.name).toBe("urn:entity:movie-c");
    expect(evidence.tiles[2]?.rank).toBe(3);
  });

  it("describes triangulation agreement, disagreement, thin, failed, and missing states", () => {
    const run = fixtureState();
    const edges = edgeIndexFor(run);
    const tris = triIndexFor(run);
    const confirmed = buildPairEvidence(run, "coffee", "music", edges.get(pairKey("coffee", "music")), tris.get(pairKey("coffee", "music")));
    expect(confirmed.triangulation.shape).toBe("solid");
    expect(confirmed.triangulation.sentence).toContain("Direct check agrees");

    const contested = buildPairEvidence(run, "cinema", "music", edges.get(pairKey("cinema", "music")), tris.get(pairKey("cinema", "music")));
    expect(contested.triangulation.shape).toBe("half");
    expect(contested.triangulation.sentence).toContain("Direct check disagrees");

    const thin = buildPairEvidence(run, "books", "music", edges.get(pairKey("books", "music")), tris.get(pairKey("books", "music")));
    expect(thin.triangulation.state).toBe("thin");
    expect(thin.triangulation.sentence).toContain("only 2 places");

    const failed = buildPairEvidence(run, "cinema", "books", edges.get(pairKey("cinema", "books")), tris.get(pairKey("cinema", "books")));
    expect(failed.triangulation.state).toBe("failed");
    expect(failed.triangulation.sentence).toBe(
      "Direct check unavailable: no places were returned for this pair."
    );

    const missing = buildPairEvidence(run, "music", "gallery", edges.get(pairKey("music", "gallery")), undefined);
    expect(missing.triangulation.sentence).toBe("Direct check not recorded for this pair.");
  });

  it("reports unmeasured pairs with the locked copy and no claim", () => {
    const run = fixtureState();
    const edges = edgeIndexFor(run);
    const evidence = buildPairEvidence(
      run,
      "coffee",
      "gallery",
      edges.get(pairKey("coffee", "gallery")),
      undefined
    );
    expect(evidence.unmeasured).toBe(true);
    expect(evidence.emptyReason).toBe(UNMEASURED_COPY);
    expect(evidence.claim).toBeNull();
    expect(evidence.provenance).toBeNull();
    expect(evidence.tiles).toHaveLength(0);
  });

  it("resolves ledger links with term matches first, caps at four, and drops non-matches", () => {
    const run = fixtureState();
    const edges = edgeIndexFor(run);
    const evidence = buildPairEvidence(run, "coffee", "cinema", edges.get(pairKey("coffee", "cinema")), undefined);
    expect(evidence.links).toHaveLength(4);
    expect(evidence.links[0]?.id).toBe("ev-term");
    expect(evidence.links.map((link) => link.id)).not.toContain("ev-other");
    expect(evidence.links.map((link) => link.id)).not.toContain("ev-more4");
  });

  it("returns no links when the run carries no evidence records", () => {
    const run = fixtureState({ evidence: undefined });
    const edges = edgeIndexFor(run);
    const evidence = buildPairEvidence(run, "coffee", "cinema", edges.get(pairKey("coffee", "cinema")), undefined);
    expect(evidence.links).toHaveLength(0);
  });
});

describe("buildNodeSheet", () => {
  it("returns role, exemplars, provenance chain, and evidence state from the pool", () => {
    const sheet = buildNodeSheet(fixtureState(), "coffee");
    expect(sheet.role).toBe("Anchor");
    expect(sheet.evidenceState).toBe("measured");
    expect(sheet.exemplars.map((exemplar) => exemplar.name)).toEqual([
      prettifyMemberId("coffee"),
      `${prettifyMemberId("coffee")} Two`
    ]);
    expect(sheet.provenance.map((step) => step.label)).toEqual([
      "Anchor place",
      "Qloo signal",
      "Resolved category",
      "Exemplar set",
      "Taste neighborhood"
    ]);
    expect(sheet.provenance[0]?.value).toBe("Anchor Place");
    expect(sheet.provenance[1]?.value).toBe("signal-coffee");
  });

  it("returns an honest empty sheet for unknown components", () => {
    const sheet = buildNodeSheet(fixtureState(), "unknown");
    expect(sheet.role).toBeNull();
    expect(sheet.exemplars).toHaveLength(0);
    expect(sheet.provenance).toHaveLength(0);
  });
});

describe("buildS3Model determinism", () => {
  it("rebuilds byte-identical models from identical input", () => {
    const first = buildS3Model(fixtureState());
    const second = buildS3Model(fixtureState());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
