import { describe, expect, it } from "vitest";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import {
  DEFAULT_DIAL_WEIGHT,
  FIELD_BIN_COUNT,
  binDistribution,
  buildField,
  buildS2Model,
  clampDialWeight,
  formatPercentileSentence,
  populationZScores,
  prettifyMemberId,
  projectOverIndex,
  rerankCards
} from "../../src/web/screens/s2/s2Model.js";

function neighborhoodEntry(entityId: string, weight: number, rank = 1) {
  return { entityId, rank, weight, affinityUsed: weight > 0.5 };
}

function poolComponent(id: string, role: "Anchor" | "Social" | "Discovery" | "Experience" | "Night" | "Community") {
  return {
    id,
    role,
    tags: [id],
    exemplars: [{ id: `urn:entity:place-${id}`, name: prettifyMemberId(id) }],
    provenancePath: {
      anchorPlace: "Anchor",
      qlooSignal: "signal",
      resolvedCategory: "category",
      exemplarSet: "exemplars",
      tasteNeighborhood: "neighborhood"
    },
    evidenceState: "measured" as const
  };
}

const COHERENCE = [0.72, 0.66, 0.5, 0.6, 0.4];
const DISTINCTIVENESS = [0.4, 0.55, 0.7, 0.45, 0.65];
const WEAKEST = [0.3, 0.35, 0.25, 0.4, 0.2];
const MEMBERS = [
  ["coffee", "cinema", "books", "music", "gallery"],
  ["coffee", "music", "books"],
  ["cinema", "music", "gallery"],
  ["coffee", "cinema", "music"],
  ["books", "gallery"]
] as const;

function storedOrderIndices(): number[] {
  const zC = populationZScores(COHERENCE);
  const zD = populationZScores(DISTINCTIVENESS);
  const scored = COHERENCE.map((_, index) => ({
    index,
    score: (zC[index] ?? 0) * (1 - DEFAULT_DIAL_WEIGHT) + (zD[index] ?? 0) * DEFAULT_DIAL_WEIGHT
  }));
  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    const lw = WEAKEST[left.index] ?? 0;
    const rw = WEAKEST[right.index] ?? 0;
    if (lw !== rw) {
      return rw - lw;
    }
    const lm = MEMBERS[left.index] ?? [];
    const rm = MEMBERS[right.index] ?? [];
    for (let i = 0; i < Math.min(lm.length, rm.length); i += 1) {
      if (lm[i] !== rm[i]) {
        return (lm[i] ?? "") < (rm[i] ?? "") ? -1 : 1;
      }
    }
    return lm.length - rm.length;
  });
  return scored.map((entry) => entry.index);
}

function baseCompositions(overrides: Partial<NonNullable<RunState["compositions"]>> = {}) {
  const order = storedOrderIndices();
  return {
    family: {
      poolSize: 5,
      size: 5,
      requiredRoles: ["Anchor" as const],
      totalCandidates: 10,
      totalValid: 10,
      coherenceDistribution: [0.35, 0.4, 0.44, 0.5, 0.52, 0.58, 0.6, 0.66, 0.7, 0.72],
      ...(overrides.family ?? {})
    },
    ranked: order.map((index) => ({
      members: [...(MEMBERS[index] ?? [])],
      size: (MEMBERS[index] ?? []).length,
      coherence: COHERENCE[index] ?? 0,
      percentile: index === 4 ? null : 50 + index * 10,
      distinctivenessMean: DISTINCTIVENESS[index] ?? 0,
      weakestLink: {
        a: (MEMBERS[index] ?? [])[0] ?? "a",
        b: (MEMBERS[index] ?? [])[1] ?? "b",
        value: WEAKEST[index] ?? 0
      },
      rankScore: 0,
      grade: (["A", "B", "C"] as const)[index % 3] ?? "C",
      gradeReasons: ["measured edges", "no contested triangulation"]
    })),
    excluded: [{ members: ["coffee", "gallery"], reason: "distinctiveness_unavailable" as const }],
    triangulation: [
      {
        a: "coffee",
        b: "music",
        state: "confirmed" as const,
        route1State: "measured" as const,
        route1Value: 0.6,
        resultCount: 9,
        focalInTopHalf: true
      }
    ],
    rivalFlips: [],
    prior: { state: "not measured" as const, reason: "only 1 Prior member(s) resolve against the measured pool; no Prior reading is guessed" },
    ...overrides
  };
}

function baseNeighborhoods(): RunState["neighborhoods"] {
  const domains = (artistWeight: number) => ({
    artist: [neighborhoodEntry(`urn:entity:artist-${artistWeight}`, artistWeight)],
    movie: [neighborhoodEntry("urn:entity:movie-1", 0.5)],
    brand: [neighborhoodEntry("urn:entity:brand-1", 0.5)]
  });
  return {
    components: [
      { componentId: "coffee", domains: domains(0.9), state: "measured" as const },
      { componentId: "cinema", domains: domains(0.4), state: "measured" as const },
      { componentId: "books", domains: domains(0.6), state: "incomplete" as const },
      { componentId: "music", domains: domains(0.7), state: "measured" as const },
      { componentId: "gallery", domains: domains(0.1), state: "measured" as const }
    ],
    city: [
      { componentId: "coffee", domains: domains(0.3), state: "measured" as const },
      { componentId: "cinema", domains: domains(0.4), state: "measured" as const },
      { componentId: "books", domains: domains(0.2), state: "measured" as const },
      { componentId: "music", domains: domains(0.2), state: "measured" as const },
      { componentId: "gallery", domains: domains(0.5), state: "measured" as const }
    ],
    sources: [
      {
        componentId: "coffee",
        domain: "artist" as const,
        scope: "site" as const,
        evidenceId: "ev-site-coffee"
      }
    ]
  };
}

function fixtureState(overrides: Partial<RunState> = {}): RunState {
  return runStateSchema.parse({
    id: "run-s2-fixture",
    status: "complete",
    phase: "measurement",
    candidatePool: [
      poolComponent("coffee", "Anchor"),
      poolComponent("cinema", "Discovery"),
      poolComponent("books", "Community"),
      poolComponent("music", "Social"),
      poolComponent("gallery", "Experience")
    ],
    neighborhoods: baseNeighborhoods(),
    compositions: baseCompositions(),
    ...overrides
  });
}

describe("binDistribution", () => {
  it("bins a spread distribution into the fixed bin count with fractions summing to 1", () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const { bins, domainMin, domainMax } = binDistribution(values);
    expect(bins).toHaveLength(FIELD_BIN_COUNT);
    expect(domainMin).toBeCloseTo(0.1);
    expect(domainMax).toBeCloseTo(0.9);
    const total = bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(values.length);
    const fractionSum = bins.reduce((sum, bin) => sum + bin.fraction, 0);
    expect(fractionSum).toBeCloseTo(1);
  });

  it("collapses a single-value distribution to one full bin", () => {
    const { bins } = binDistribution([0.5, 0.5, 0.5]);
    expect(bins).toHaveLength(1);
    expect(bins[0]?.count).toBe(3);
    expect(bins[0]?.fraction).toBe(1);
  });

  it("returns no bins for an empty distribution", () => {
    const { bins } = binDistribution([]);
    expect(bins).toEqual([]);
  });
});

describe("buildField", () => {
  it("marks the three finalists A/B/C and a dashed prior when the prior is measured", () => {
    const state = fixtureState({
      compositions: baseCompositions({
        prior: { state: "measured", members: ["coffee", "cinema"], coherence: 0.55, percentile: 61 }
      })
    });
    const model = buildS2Model(state);
    expect(model).not.toBeNull();
    const field = model?.field;
    expect(field).not.toBeNull();
    const labels = (field?.marks ?? []).map((mark) => mark.label);
    expect(labels).toContain("A");
    expect(labels).toContain("B");
    expect(labels).toContain("C");
    const prior = (field?.marks ?? []).find((mark) => mark.key === "prior");
    expect(prior?.dashed).toBe(true);
    expect(prior?.label).toBe("P");
    expect(field?.totalValid).toBe(10);
    expect(field?.summary).toContain("10 valid combinations");
  });

  it("returns a null field and an honest reason for an empty family", () => {
    const state = fixtureState({
      compositions: baseCompositions({
        family: {
          poolSize: 5,
          size: 5,
          requiredRoles: ["Anchor"],
          totalCandidates: 0,
          totalValid: 0,
          coherenceDistribution: [],
          reason: "no size-5 subset of this pool is both role-valid and fully measured"
        },
        ranked: []
      })
    });
    const model = buildS2Model(state);
    expect(model?.field).toBeNull();
    expect(model?.emptyReason).toContain("no size-5 subset");
    expect(model?.cards).toEqual([]);
    expect(model?.headline.length).toBeGreaterThan(0);
  });

  it("buildField on a family with no distribution returns null", () => {
    const state = fixtureState();
    const compositions = state.compositions;
    expect(compositions).toBeDefined();
    if (compositions === undefined) {
      return;
    }
    const field = buildField(
      { ...compositions.family, coherenceDistribution: [], totalValid: 0 },
      [],
      compositions.prior
    );
    expect(field).toBeNull();
  });
});

describe("formatPercentileSentence", () => {
  it("builds the locked percentile sentence from stored values", () => {
    expect(formatPercentileSentence(91, 252)).toBe(
      "More coherent than 91% of 252 valid combinations from this pool"
    );
  });

  it("rounds fractional percentiles", () => {
    expect(formatPercentileSentence(61.4, 10)).toContain("61%");
  });

  it("degrades honestly when the percentile is null", () => {
    expect(formatPercentileSentence(null, 10)).toBe(
      "Coherence percentile was not measured against this pool."
    );
  });
});

describe("projectOverIndex", () => {
  it("marks over-index, equality, under-index, and unmeasured members from stored neighborhoods", () => {
    const projection = projectOverIndex(fixtureState(), ["coffee", "cinema", "books", "gallery"]);
    const byId = new Map(projection.perMember.map((entry) => [entry.memberId, entry]));
    expect(byId.get("coffee")?.overIndexes).toBe(true);
    expect(byId.get("coffee")?.measured).toBe(true);
    expect(byId.get("cinema")?.overIndexes).toBe(false);
    expect(byId.get("cinema")?.measured).toBe(true);
    expect(byId.get("books")?.measured).toBe(false);
    expect(byId.get("gallery")?.overIndexes).toBe(false);
    expect(projection.neighborhoodsAvailable).toBe(true);
    expect(projection.overIndexCount).toBe(1);
  });

  it("reports neighborhoods unavailable when the run has none", () => {
    const projection = projectOverIndex(fixtureState({ neighborhoods: undefined }), ["coffee"]);
    expect(projection.neighborhoodsAvailable).toBe(false);
    expect(projection.measuredCount).toBe(0);
    expect(projection.perMember[0]?.measured).toBe(false);
  });
});

describe("populationZScores", () => {
  it("matches the engine convention: zero sigma yields all zeros", () => {
    expect(populationZScores([0.5, 0.5, 0.5])).toEqual([0, 0, 0]);
  });

  it("standardizes a known vector", () => {
    const z = populationZScores([0, 1, 2]);
    expect(z[0]).toBeCloseTo(-1.224744871);
    expect(z[1]).toBeCloseTo(0);
    expect(z[2]).toBeCloseTo(1.224744871);
  });

  it("returns an empty list for no values", () => {
    expect(populationZScores([])).toEqual([]);
  });
});

describe("rerankCards", () => {
  it("at the default weight reproduces the stored rank order", () => {
    const model = buildS2Model(fixtureState());
    expect(model).not.toBeNull();
    if (model === null) {
      return;
    }
    const reranked = rerankCards(model.rankedAll, DEFAULT_DIAL_WEIGHT);
    expect(reranked.map((card) => card.memberIds.join("|"))).toEqual(
      model.rankedAll.map((card) => card.memberIds.join("|"))
    );
  });

  it("is monotonic: w=0 orders by coherence descending, w=1 by distinctiveness descending", () => {
    const model = buildS2Model(fixtureState());
    if (model === null) {
      return;
    }
    const byCoherence = rerankCards(model.rankedAll, 0).map((card) => card.coherence);
    expect(byCoherence).toEqual([...byCoherence].sort((left, right) => right - left));
    const byDistinctiveness = rerankCards(model.rankedAll, 1).map((card) => card.distinctivenessMean);
    expect(byDistinctiveness).toEqual([...byDistinctiveness].sort((left, right) => right - left));
  });

  it("moves the high-distinctiveness composition to the front at w=1", () => {
    const model = buildS2Model(fixtureState());
    if (model === null) {
      return;
    }
    const lead = rerankCards(model.rankedAll, 1)[0];
    expect(lead?.distinctivenessMean).toBe(Math.max(...model.rankedAll.map((card) => card.distinctivenessMean)));
  });

  it("breaks score ties by higher weakest link, then by member keys", () => {
    const model = buildS2Model(fixtureState());
    if (model === null) {
      return;
    }
    const twin = model.rankedAll[0];
    const twinWeak = model.rankedAll[1];
    if (twin === undefined || twinWeak === undefined) {
      return;
    }
    const tied = [
      { ...twin, key: "tie-b", memberIds: ["zeta", "alpha"], weakestValue: 0.1 },
      { ...twin, key: "tie-a", memberIds: ["alpha", "zeta"], weakestValue: 0.9 },
      { ...twin, key: "tie-c", memberIds: ["alpha", "zeta"], weakestValue: 0.9 }
    ];
    const ordered = rerankCards(tied, 0.5);
    expect(ordered[0]?.key).toBe("tie-a");
    expect(ordered[1]?.key).toBe("tie-c");
    expect(ordered[2]?.key).toBe("tie-b");
  });

  it("clamps out-of-range weights", () => {
    expect(clampDialWeight(-3)).toBe(0);
    expect(clampDialWeight(7)).toBe(1);
    expect(clampDialWeight(Number.NaN)).toBe(DEFAULT_DIAL_WEIGHT);
  });
});

describe("buildS2Model", () => {
  it("returns null without a run or without compositions", () => {
    expect(buildS2Model(null)).toBeNull();
    expect(buildS2Model(fixtureState({ compositions: undefined }))).toBeNull();
  });

  it("parses the fixture through runStateSchema and produces a full model", () => {
    const state = fixtureState();
    const model = buildS2Model(state);
    expect(model).not.toBeNull();
    if (model === null) {
      return;
    }
    expect(model.cards).toHaveLength(3);
    expect(model.rankedAll).toHaveLength(5);
    expect(model.totalValid).toBe(10);
    expect(model.excludedCount).toBe(1);
    expect(model.field).not.toBeNull();
    expect(model.poolNote).toBeNull();
    expect(model.prior.state).toBe("not measured");
    expect(model.prior.reason).toContain("Prior");
  });

  it("orders the three readings in the locked order on each card", () => {
    const model = buildS2Model(fixtureState());
    const card = model?.cards[0];
    expect(card?.readings.percentile.sentence.startsWith("More coherent than")).toBe(true);
    expect(card?.readings.distinctiveness.sentence).toContain("over-index locally");
    expect(card?.readings.weakestLink?.sentence).toContain("weak");
    expect(card?.gradeReasons.length).toBeGreaterThan(0);
  });

  it("counts over-index members in the distinctiveness reading", () => {
    const model = buildS2Model(fixtureState());
    const card = model?.cards.find((entry) => entry.memberIds.includes("coffee") && entry.memberIds.includes("gallery"));
    expect(card).toBeDefined();
    const reading = card?.readings.distinctiveness;
    expect(reading?.overIndexCount).not.toBeNull();
    expect(reading?.sentence).toContain("over-index locally");
  });

  it("surfaces the not-measured prior reason verbatim", () => {
    const model = buildS2Model(fixtureState());
    expect(model?.prior.state).toBe("not measured");
    expect(model?.prior.reason).toBe(
      "only 1 Prior member(s) resolve against the measured pool; no Prior reading is guessed"
    );
    expect(model?.headline).toContain("not measured against this pool");
  });

  it("builds a measured prior card with its own coherence reading", () => {
    const state = fixtureState({
      compositions: baseCompositions({
        prior: { state: "measured", members: ["coffee", "cinema"], coherence: 0.55, percentile: 61 }
      })
    });
    const model = buildS2Model(state);
    expect(model?.prior.state).toBe("measured");
    expect(model?.prior.coherence).toBe(0.55);
    expect(model?.prior.reading).toContain("More coherent than 61%");
    expect(model?.prior.members).toHaveLength(2);
  });

  it("notes a thin pool when fewer than three combinations are valid", () => {
    const state = fixtureState({
      compositions: baseCompositions({
        family: {
          poolSize: 5,
          size: 3,
          requiredRoles: ["Anchor"],
          totalCandidates: 4,
          totalValid: 2,
          coherenceDistribution: [0.4, 0.6]
        },
        ranked: [
          {
            members: ["coffee", "cinema"],
            size: 2,
            coherence: 0.6,
            percentile: 100,
            distinctivenessMean: 0.5,
            weakestLink: { a: "coffee", b: "cinema", value: 0.4 },
            rankScore: 0.1,
            grade: "B",
            gradeReasons: []
          },
          {
            members: ["coffee", "music"],
            size: 2,
            coherence: 0.4,
            percentile: 0,
            distinctivenessMean: 0.6,
            weakestLink: { a: "coffee", b: "music", value: 0.3 },
            rankScore: -0.1,
            grade: "C",
            gradeReasons: []
          }
        ],
        excluded: []
      })
    });
    const model = buildS2Model(state);
    expect(model?.poolNote).toBe("Only 2 valid combinations from this pool.");
  });

  it("groups members by pool role in the canonical role order", () => {
    const model = buildS2Model(fixtureState());
    const card = model?.rankedAll.find((entry) => entry.memberIds.length === 5);
    expect(card).toBeDefined();
    const roles = card?.roleGroups.map((group) => group.role);
    expect(roles).toEqual(["Anchor", "Social", "Discovery", "Experience", "Community"]);
    const anchor = card?.roleGroups[0];
    expect(anchor?.members[0]?.id).toBe("coffee");
    expect(anchor?.members[0]?.role).toBe("Anchor");
  });

  it("is deterministic across repeated builds of the same state", () => {
    const state = fixtureState();
    const first = buildS2Model(state);
    const second = buildS2Model(state);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("prettifyMemberId", () => {
  it("turns snake and kebab ids into display names", () => {
    expect(prettifyMemberId("coffee_roastery")).toBe("Coffee roastery");
    expect(prettifyMemberId("micro-cinema")).toBe("Micro cinema");
    expect(prettifyMemberId("coffee")).toBe("Coffee");
  });
});
