import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANK_WEIGHT,
  SWEEP_POINT_COUNT,
  populationZScores,
  rankCompositionSet,
  rankCompositions,
  rivalSweep
} from "../../src/server/engine/index.js";
import type { ComponentRole } from "../../src/server/engine/index.js";
import {
  expectEngineError,
  makeHandComposition,
  makeMeasuredGraph,
  makeRolePool
} from "./compositionFixtures.js";

// ---------------------------------------------------------------------------
// Hand-worked ranking fixtures
// ---------------------------------------------------------------------------

// X: coherence 0.75 (high), distinctiveness 0.25 (low), weakest link 0.3.
const compX = makeHandComposition({
  members: ["m1", "m2"],
  coherence: 0.75,
  distinctivenessMean: 0.25,
  weakestLink: { a: "m1", b: "m2", value: 0.3 }
});

// Y: coherence 0.25 (low), distinctiveness 0.75 (high), weakest link 0.7.
const compY = makeHandComposition({
  members: ["m3", "m4"],
  coherence: 0.25,
  distinctivenessMean: 0.75,
  weakestLink: { a: "m3", b: "m4", value: 0.7 }
});

// Population z-scores over {0.75, 0.25}:
//   μ = (0.75 + 0.25)/2 = 0.5 ; σ = √(((0.25)² + (0.25)²)/2) = √(0.0625) = 0.25
//   zC(X) = (0.75 − 0.5)/0.25 = +1   zC(Y) = (0.25 − 0.5)/0.25 = −1
// Population z-scores over {0.25, 0.75}:
//   zD(X) = (0.25 − 0.5)/0.25 = −1   zD(Y) = (0.75 − 0.5)/0.25 = +1
// All arithmetic is dyadic → exact, so scores below are exact too.

describe("populationZScores", () => {
  it("computes hand-worked population z-scores (σ>0)", () => {
    // [1,2,3]: μ=2, σ=√((1²+0²+1²)/3)=√(2/3) → z = [−√(3/2), 0, √(3/2)].
    const z = populationZScores([1, 2, 3]);
    expect(z[0]).toBeCloseTo(-Math.sqrt(1.5), 12);
    expect(z[1]).toBe(0);
    expect(z[2]).toBeCloseTo(Math.sqrt(1.5), 12);
  });

  it("returns z=0 for every member when σ=0 (population, ddof=0)", () => {
    expect(populationZScores([5, 5, 5])).toEqual([0, 0, 0]);
    expect(populationZScores([0.5, 0.5, 0.5])).toEqual([0, 0, 0]);
    expect(populationZScores([7])).toEqual([0]);
    expect(populationZScores([])).toEqual([]);
    for (const value of populationZScores([5, 5, 5])) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("rejects non-finite inputs", () => {
    expectEngineError(() => populationZScores([1, Number.NaN]), "INVALID_GRAPH_INPUT");
    expectEngineError(
      () => populationZScores([1, Number.POSITIVE_INFINITY]),
      "INVALID_GRAPH_INPUT"
    );
  });
});

describe("rankCompositionSet", () => {
  it("ranks at w=0 purely by coherence (z(C) only)", () => {
    // w=0 → rankScore = zC·1 + zD·0 → X = +1, Y = −1 → X first.
    const outcome = rankCompositionSet([compX, compY], 0);
    expect(outcome.weight).toBe(0);
    expect(outcome.ranked.map((entry) => entry.members)).toEqual([
      ["m1", "m2"],
      ["m3", "m4"]
    ]);
    expect(outcome.ranked[0].rankScore).toBe(1);
    expect(outcome.ranked[1].rankScore).toBe(-1);
    expect(outcome.excluded).toEqual([]);
  });

  it("ranks at w=1 purely by distinctiveness (z(D̄) only)", () => {
    // w=1 → rankScore = zC·0 + zD·1 → X = −1, Y = +1 → Y first.
    const outcome = rankCompositionSet([compX, compY], 1);
    expect(outcome.ranked.map((entry) => entry.members)).toEqual([
      ["m3", "m4"],
      ["m1", "m2"]
    ]);
    expect(outcome.ranked[0].rankScore).toBe(1);
    expect(outcome.ranked[1].rankScore).toBe(-1);
  });

  it("breaks the exact w=0.5 score tie by weakest link", () => {
    // w=0.5 → X: (+1)·0.5 + (−1)·0.5 = 0 ; Y: (−1)·0.5 + (+1)·0.5 = 0.
    // Equal scores → higher weakest-link value first: Y (0.7) beats X (0.3).
    const outcome = rankCompositionSet([compX, compY], 0.5);
    expect(outcome.ranked[0].members).toEqual(["m3", "m4"]);
    expect(outcome.ranked[0].rankScore).toBe(0);
    expect(outcome.ranked[1].rankScore).toBe(0);
    expect(outcome.weight).toBe(0.5);
  });

  it("defaults w to 0.5", () => {
    expect(DEFAULT_RANK_WEIGHT).toBe(0.5);
    expect(rankCompositionSet([compX, compY]).weight).toBe(0.5);
  });

  it("excludes compositions with null d̄ and ranks z over the rankable set only", () => {
    // Z has no distinctiveness → excluded with an honest reason, never averaged.
    // Rankable stays {X, Y} → zC remains exactly [1, −1]; if Z (coherence 0.7)
    // had entered the z population the scores would drift off ±1.
    const compZ = makeHandComposition({
      members: ["m5", "m6"],
      coherence: 0.7,
      distinctivenessMean: null,
      weakestLink: { a: "m5", b: "m6", value: 0.5 }
    });
    const outcome = rankCompositionSet([compX, compY, compZ], 0);
    expect(outcome.excluded).toEqual([
      { members: ["m5", "m6"], reason: "distinctiveness_unavailable" }
    ]);
    expect(outcome.ranked.map((entry) => entry.members)).toEqual([
      ["m1", "m2"],
      ["m3", "m4"]
    ]);
    expect(outcome.ranked[0].rankScore).toBe(1);
    expect(outcome.ranked[1].rankScore).toBe(-1);
  });

  it("applies the full tie-break ladder: score, weakest link, members", () => {
    // Four compositions share coherence 0.5 and d̄ 0.5 → σ=0 → z=0 → every
    // rankScore is exactly 0 (no NaN). Ordering then falls to weakest link
    // (0.6 before 0.4) and finally to members lexicographically.
    const p = makeHandComposition({
      members: ["z1", "z2"],
      weakestLink: { a: "z1", b: "z2", value: 0.6 }
    });
    const r = makeHandComposition({
      members: ["b1", "b2"],
      weakestLink: { a: "b1", b: "b2", value: 0.6 }
    });
    const q = makeHandComposition({
      members: ["a1", "a2"],
      weakestLink: { a: "a1", b: "a2", value: 0.4 }
    });
    const s = makeHandComposition({
      members: ["c1", "c2"],
      weakestLink: { a: "c1", b: "c2", value: 0.4 }
    });
    const outcome = rankCompositionSet([s, q, p, r], 0.5);
    expect(outcome.ranked.map((entry) => entry.members)).toEqual([
      ["b1", "b2"],
      ["z1", "z2"],
      ["a1", "a2"],
      ["c1", "c2"]
    ]);
    for (const entry of outcome.ranked) {
      expect(entry.rankScore).toBe(0);
      expect(Number.isNaN(entry.rankScore)).toBe(false);
    }
  });

  it("returns an honest empty ranking for an empty or fully excluded input", () => {
    const empty = rankCompositionSet([], 0.5);
    expect(empty.ranked).toEqual([]);
    expect(empty.excluded).toEqual([]);
    const compZ = makeHandComposition({
      members: ["m5", "m6"],
      distinctivenessMean: null
    });
    const excluded = rankCompositionSet([compZ], 0.5);
    expect(excluded.ranked).toEqual([]);
    expect(excluded.excluded).toEqual([
      { members: ["m5", "m6"], reason: "distinctiveness_unavailable" }
    ]);
  });

  it("rejects weights outside [0,1]", () => {
    for (const weight of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectEngineError(() => rankCompositionSet([compX], weight), "INVALID_GRAPH_INPUT");
    }
  });
});

describe("rival sweep", () => {
  it("sweeps w = 0.00…1.00 at step 0.01 and reports the leadership flip", () => {
    // score_X(w) = 1·(1−w) + (−1)·w = 1 − 2w
    // score_Y(w) = (−1)·(1−w) + 1·w = 2w − 1
    // X leads while w < 0.5 (indices 0..49); at w = 0.5 (index 50) both
    // scores are exactly 0 and the weakest-link tie-break hands leadership to
    // Y; Y leads for w > 0.5 (indices 51..100). One flip, at index 50.
    const sweep = rivalSweep([compX, compY]);
    expect(SWEEP_POINT_COUNT).toBe(101);
    expect(sweep.points).toHaveLength(101);
    expect(sweep.points[0].weight).toBe(0);
    expect(sweep.points[100].weight).toBe(1);
    expect(sweep.points[50].weight).toBe(0.5);
    expect(sweep.points[0].leader).toEqual(["m1", "m2"]);
    expect(sweep.points[49].leader).toEqual(["m1", "m2"]);
    expect(sweep.points[50].leader).toEqual(["m3", "m4"]);
    expect(sweep.points[100].leader).toEqual(["m3", "m4"]);
    expect(sweep.flips).toEqual([
      { index: 50, weight: 0.5, from: ["m1", "m2"], to: ["m3", "m4"] }
    ]);
  });

  it("reports no flips when leadership never changes", () => {
    const sweep = rivalSweep([compX]);
    expect(sweep.flips).toEqual([]);
    expect(sweep.points.every((point) => point.leader?.[0] === "m1")).toBe(true);
  });

  it("reports honest null leaders when nothing is rankable", () => {
    const compZ = makeHandComposition({
      members: ["m5", "m6"],
      distinctivenessMean: null
    });
    for (const compositions of [[], [compZ]]) {
      const sweep = rivalSweep(compositions);
      expect(sweep.points).toHaveLength(101);
      expect(sweep.points.every((point) => point.leader === null)).toBe(true);
      expect(sweep.flips).toEqual([]);
    }
  });
});

describe("rankCompositions (end to end)", () => {
  const pool = makeRolePool([
    { id: "a1", role: "Anchor" },
    { id: "n1", role: "Night" },
    { id: "s1", role: "Social" },
    { id: "s2", role: "Social" }
  ]);
  const graph = makeMeasuredGraph(
    ["a1", "n1", "s1", "s2"],
    [
      ["a1", "n1", 0.7],
      ["a1", "s1", 0.5],
      ["a1", "s2", 0.6],
      ["n1", "s1", 0.9],
      ["n1", "s2", 0.1],
      ["s1", "s2", 0.8]
    ]
  );
  const distinctiveness = { a1: 0.2, n1: 0.6, s1: 0.4 };
  const baseInput = {
    pool,
    graph,
    size: 2,
    requiredRoles: [] as ComponentRole[],
    distinctiveness
  };

  it("enumerates, ranks and sweeps in one call with w defaulting to 0.5", () => {
    // Valid family (all 6 pairs measured, no role filter):
    //   [a1,n1] C=0.7 d̄=0.4 · [a1,s1] C=0.5 d̄=0.3 · [a1,s2] C=0.6 d̄=null
    //   [n1,s1] C=0.9 d̄=0.5 · [n1,s2] C=0.1 d̄=null · [s1,s2] C=0.8 d̄=null
    // Rankable = 3 (s2 has no city vector) → the other 3 are excluded with
    // reason "distinctiveness_unavailable"; percentiles stay on every subset.
    // At w=0.5, [n1,s1] has the highest z on both axes → leader at every
    // sweep point → no leadership flips.
    const result = rankCompositions(baseInput);
    expect(result.weight).toBe(0.5);
    expect(result.ranked).toHaveLength(3);
    expect(result.excluded).toEqual([
      { members: ["a1", "s2"], reason: "distinctiveness_unavailable" },
      { members: ["n1", "s2"], reason: "distinctiveness_unavailable" },
      { members: ["s1", "s2"], reason: "distinctiveness_unavailable" }
    ]);
    expect(result.ranked.map((entry) => entry.members)).toEqual([
      ["n1", "s1"],
      ["a1", "n1"],
      ["a1", "s1"]
    ]);
    expect(result.ranked[0].coherence).toBe(0.9);
    expect(result.ranked[0].percentile).toBe((100 * 5) / 6);
    expect(result.ranked[1].percentile).toBe(50);
    expect(result.ranked[2].percentile).toBe((100 * 1) / 6);
    expect(result.ranked[0].distinctivenessMean).toBeCloseTo(0.5, 12);
    expect(result.ranked[0].weakestLink).toEqual({ a: "n1", b: "s1", value: 0.9 });
    expect(result.ranked[0].rankScore).toBeCloseTo(1.2247448713915889, 6);
    expect(result.ranked[1].rankScore).toBeCloseTo(0, 6);
    expect(result.sweep.points).toHaveLength(101);
    expect(result.sweep.flips).toEqual([]);
    expect(result.sweep.points[0].leader).toEqual(["n1", "s1"]);
    expect(result.sweep.points[100].leader).toEqual(["n1", "s1"]);
  });

  it("accepts an explicit weight", () => {
    const result = rankCompositions({ ...baseInput, weight: 1 });
    expect(result.weight).toBe(1);
    expect(result.ranked[0].members).toEqual(["n1", "s1"]);
    const invalid = { ...baseInput, weight: 2 };
    expectEngineError(() => rankCompositions(invalid), "INVALID_GRAPH_INPUT");
  });

  it("produces byte-identical output for repeated and shuffled inputs", () => {
    const first = rankCompositions(baseInput);
    const second = rankCompositions(baseInput);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    const shuffled = rankCompositions({
      ...baseInput,
      pool: [...pool].reverse(),
      graph: { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() },
      distinctiveness: Object.fromEntries(Object.entries(distinctiveness).reverse())
    });
    expect(shuffled).toEqual(first);
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(first));
  });

  it("fails fast on structural input errors", () => {
    expectEngineError(
      () => rankCompositions({ ...baseInput, size: 1 }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => rankCompositions({ ...baseInput, requiredRoles: ["Hero" as ComponentRole] }),
      "INVALID_COMPONENT"
    );
  });
});
