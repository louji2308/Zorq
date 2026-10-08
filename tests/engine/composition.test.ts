import { describe, expect, it } from "vitest";
import {
  MAX_ENUMERATION_CANDIDATES,
  buildCompositions,
  compositionSchema,
  isRoleValidSubset,
  measureComposition,
  percentileOf
} from "../../src/server/engine/index.js";
import type { ComponentRole, CultureGraph } from "../../src/server/engine/index.js";
import {
  expectEngineError,
  makeMeasuredGraph,
  makeRolePool
} from "./compositionFixtures.js";

// ---------------------------------------------------------------------------
// Hand-worked fixtures
// ---------------------------------------------------------------------------

// Pool P4: four components, s2 is NOT measured (evidence filter).
const p4 = makeRolePool([
  { id: "a1", role: "Anchor" },
  { id: "n1", role: "Night" },
  { id: "s1", role: "Social" },
  { id: "s2", role: "Social", evidenceState: "incomplete" }
]);

// Graph G4 over P4. Five measured edges; a1|n1 deliberately unmeasured.
//   a1|s1 = 0.5   a1|s2 = 0.6   n1|s1 = 0.7   n1|s2 = 0.8   s1|s2 = 0.9
const g4: CultureGraph = makeMeasuredGraph(
  ["a1", "n1", "s1", "s2"],
  [
    ["a1", "s1", 0.5],
    ["a1", "s2", 0.6],
    ["n1", "s1", 0.7],
    ["n1", "s2", 0.8],
    ["s1", "s2", 0.9]
  ]
);

// Pool P5: five components; n1 is NOT measured.
const p5 = makeRolePool([
  { id: "a1", role: "Anchor" },
  { id: "a2", role: "Anchor" },
  { id: "n1", role: "Night", evidenceState: "not measured" },
  { id: "s1", role: "Social" },
  { id: "s2", role: "Social" }
]);

// Graph G5 over P5. Measured edges:
//   a1|a2 = 0.6  a1|s1 = 0.5  a2|s1 = 0.4  a1|s2 = 0.7  a2|s2 = 0.8
// Unmeasured: s1|s2 plus every pair touching the unmeasured n1
// (consistent with buildGraph, which marks edges of unmeasured components).
const g5: CultureGraph = makeMeasuredGraph(
  ["a1", "a2", "n1", "s1", "s2"],
  [
    ["a1", "a2", 0.6],
    ["a1", "s1", 0.5],
    ["a2", "s1", 0.4],
    ["a1", "s2", 0.7],
    ["a2", "s2", 0.8]
  ]
);

// Pool P3: four measured components, complete measured graph.
const p3 = makeRolePool([
  { id: "a1", role: "Anchor" },
  { id: "n1", role: "Night" },
  { id: "s1", role: "Social" },
  { id: "s2", role: "Social" }
]);

// Graph G3 over P3, every edge measured:
//   a1|n1 = 0.7  a1|s1 = 0.5  a1|s2 = 0.6
//   n1|s1 = 0.9  n1|s2 = 0.1  s1|s2 = 0.8
const g3: CultureGraph = makeMeasuredGraph(
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

// Graph for coherence/weakest-link arithmetic over p,q,r,s:
//   p|q = 0.5  p|r = 0.25  q|r = 0.75  p|s = 0.5  q|s = 0.5  r|s = 0.5
const gPQRS: CultureGraph = makeMeasuredGraph(
  ["p", "q", "r", "s"],
  [
    ["p", "q", 0.5],
    ["p", "r", 0.25],
    ["q", "r", 0.75],
    ["p", "s", 0.5],
    ["q", "s", 0.5],
    ["r", "s", 0.5]
  ]
);
const pPQRS = makeRolePool([
  { id: "p" },
  { id: "q" },
  { id: "r" },
  { id: "s" }
]);

// Graph for weakest-link tie behavior:
//   x|y = 0.4  x|z = 0.4  y|z = 0.9
const gTie: CultureGraph = makeMeasuredGraph(
  ["x", "y", "z"],
  [
    ["x", "y", 0.4],
    ["x", "z", 0.4],
    ["y", "z", 0.9]
  ]
);
const pTie = makeRolePool([{ id: "x" }, { id: "y" }, { id: "z" }]);

describe("measureComposition (coherence and weakest link)", () => {
  it("computes coherence of a three-member set as the mean of its pair values", () => {
    // Members p,q,r → pairs (p,q)=0.5, (p,r)=0.25, (q,r)=0.75.
    // C = (0.5 + 0.25 + 0.75) / 3 = 1.5 / 3 = 0.5 (all dyadic → exact).
    // Weakest link = minimum = (p,r) at 0.25.
    const measured = measureComposition(["p", "q", "r"], pPQRS, gPQRS);
    expect(measured.members).toEqual(["p", "q", "r"]);
    expect(measured.size).toBe(3);
    expect(measured.coherence).toBe(0.5);
    expect(measured.weakestLink).toEqual({ a: "p", b: "r", value: 0.25 });
  });

  it("computes coherence of a four-member set over six pairs", () => {
    // Members p,q,r,s → pairs (p,q)=0.5, (p,r)=0.25, (q,r)=0.75,
    // (p,s)=0.5, (q,s)=0.5, (r,s)=0.5.
    // Sum = 0.5+0.25+0.75+0.5+0.5+0.5 = 3.0 ; C = 3.0 / 6 = 0.5 (exact).
    // Weakest link remains (p,r) at 0.25.
    const measured = measureComposition(["s", "r", "q", "p"], pPQRS, gPQRS);
    expect(measured.members).toEqual(["p", "q", "r", "s"]);
    expect(measured.coherence).toBe(0.5);
    expect(measured.weakestLink).toEqual({ a: "p", b: "r", value: 0.25 });
  });

  it("breaks weakest-link ties by the first pair in sorted member order", () => {
    // Pairs iterate in sorted member order: (x,y)=0.4, (x,z)=0.4, (y,z)=0.9.
    // Both (x,y) and (x,z) are the minimum 0.4; strict "<" keeps the first
    // candidate, so the named weakest link is (x,y).
    // Coherence = (0.4 + 0.4 + 0.9) / 3 = 1.7 / 3 ≈ 0.5666666666666667.
    const measured = measureComposition(["x", "y", "z"], pTie, gTie);
    expect(measured.weakestLink).toEqual({ a: "x", b: "y", value: 0.4 });
    expect(measured.coherence).toBeCloseTo(1.7 / 3, 12);
  });

  it("returns a two-member composition as its single edge", () => {
    const measured = measureComposition(["a1", "s1"], p4, g4);
    expect(measured.coherence).toBe(0.5);
    expect(measured.weakestLink).toEqual({ a: "a1", b: "s1", value: 0.5 });
  });
});

describe("enumeration of role-valid subsets", () => {
  it("enumerates C(4,2)=6 candidates and keeps exactly the ones passing every filter", () => {
    // Candidates in sorted member-id order with verdicts for requiredRoles ["Anchor"]:
    //   1. [a1,n1]  → edge a1|n1 is unmeasured                      → invalid
    //   2. [a1,s1]  → measured evidence, measured edge, has Anchor  → VALID (C=0.5)
    //   3. [a1,s2]  → s2 evidenceState "incomplete"                 → invalid
    //   4. [n1,s1]  → passes evidence+edge but no Anchor            → invalid (role)
    //   5. [n1,s2]  → s2 unmeasured AND no Anchor                   → invalid
    //   6. [s1,s2]  → s2 unmeasured AND no Anchor                   → invalid
    // totalCandidates = 6, totalValid = 1. Single valid subset → percentile 0%.
    const family = buildCompositions({
      pool: p4,
      graph: g4,
      size: 2,
      requiredRoles: ["Anchor"]
    });
    expect(family.totalCandidates).toBe(6);
    expect(family.totalValid).toBe(1);
    expect(family.compositions.map((composition) => composition.members)).toEqual([
      ["a1", "s1"]
    ]);
    expect(family.compositions[0].percentile).toBe(0);
    expect(family.compositions[0].coherence).toBe(0.5);
  });

  it("changes the valid family when requiredRoles is empty", () => {
    // With no role requirement the role filter disappears:
    //   valid = [a1,s1] (0.5) and [n1,s1] (0.7); everything else still fails
    //   the evidence filter (s2) or the unmeasured a1|n1 edge.
    // Percentiles over coherences {0.5, 0.7}:
    //   [a1,s1]: |{u : u < 0.5}| = 0 → 0%
    //   [n1,s1]: |{u : u < 0.7}| = 1 → 100·1/2 = 50%
    const family = buildCompositions({
      pool: p4,
      graph: g4,
      size: 2,
      requiredRoles: []
    });
    expect(family.totalCandidates).toBe(6);
    expect(family.totalValid).toBe(2);
    const byMembers = new Map(
      family.compositions.map((composition) => [composition.members.join(","), composition])
    );
    expect(byMembers.get("a1,s1")?.percentile).toBe(0);
    expect(byMembers.get("n1,s1")?.percentile).toBe(50);
    expect(byMembers.get("n1,s1")?.coherence).toBe(0.7);
  });

  it("hand-lists all ten C(5,3) candidates for a pool of five", () => {
    // Candidates over sorted ids [a1,a2,n1,s1,s2] with verdicts for
    // requiredRoles ["Anchor"]:
    //   1.  [a1,a2,n1]  → n1 evidenceState "not measured"       → invalid
    //   2.  [a1,a2,s1]  → all evidence+edges+Anchor             → VALID (C=(0.6+0.5+0.4)/3=0.5)
    //   3.  [a1,a2,s2]  → all evidence+edges+Anchor             → VALID (C=(0.6+0.7+0.8)/3≈0.7)
    //   4.  [a1,n1,s1]  → n1 unmeasured                          → invalid
    //   5.  [a1,n1,s2]  → n1 unmeasured                          → invalid
    //   6.  [a1,s1,s2]  → edge s1|s2 unmeasured                  → invalid
    //   7.  [a2,n1,s1]  → n1 unmeasured                          → invalid
    //   8.  [a2,n1,s2]  → n1 unmeasured                          → invalid
    //   9.  [a2,s1,s2]  → edge s1|s2 unmeasured                  → invalid
    //   10. [n1,s1,s2]  → n1 unmeasured (and no Anchor)          → invalid
    // Percentiles over {0.5, ≈0.7}: 0% and 50%.
    const family = buildCompositions({
      pool: p5,
      graph: g5,
      size: 3,
      requiredRoles: ["Anchor"]
    });
    expect(family.totalCandidates).toBe(10);
    expect(family.totalValid).toBe(2);
    const [first, second] = family.compositions;
    expect(first.members).toEqual(["a1", "a2", "s1"]);
    expect(first.coherence).toBeCloseTo(0.5, 12);
    expect(first.percentile).toBe(0);
    expect(first.weakestLink).toEqual({ a: "a2", b: "s1", value: 0.4 });
    expect(second.members).toEqual(["a1", "a2", "s2"]);
    expect(second.coherence).toBeCloseTo(0.7, 12);
    expect(second.percentile).toBe(50);
    expect(second.weakestLink).toEqual({ a: "a1", b: "a2", value: 0.6 });
  });

  it("returns an honest empty family when no subset satisfies the roles", () => {
    // No component plays "Community" in P5, so every candidate fails role
    // coverage. Result stays structured: totalValid 0, compositions empty —
    // never a fabricated number.
    const family = buildCompositions({
      pool: p5,
      graph: g5,
      size: 3,
      requiredRoles: ["Community"]
    });
    expect(family.totalCandidates).toBe(10);
    expect(family.totalValid).toBe(0);
    expect(family.compositions).toEqual([]);
    expect(percentileOf(0.5, family.compositions.map((composition) => composition.coherence)))
      .toBeNull();
  });

  it("canonicalizes requiredRoles to a sorted, de-duplicated list", () => {
    const family = buildCompositions({
      pool: p4,
      graph: g4,
      size: 2,
      requiredRoles: ["Social", "Anchor", "Social"]
    });
    expect(family.requiredRoles).toEqual(["Anchor", "Social"]);
    expect(family.poolSize).toBe(4);
    expect(family.size).toBe(2);
  });
});

describe("exact percentile", () => {
  it("counts strictly-lower coherences and excludes equal-coherence ties", () => {
    // Family coherences {0.5, 0.5}: nothing is strictly below either member,
    // so both receive 0% — ties are never counted as "more coherent than".
    expect(percentileOf(0.5, [0.5, 0.5])).toBe(0);
    // Family {0.4, 0.5, 0.9} for target 0.6: below = {0.4, 0.5} → 100·2/3.
    expect(percentileOf(0.6, [0.4, 0.5, 0.9])).toBe((100 * 2) / 3);
    // Single valid subset: target below nothing → 0%.
    expect(percentileOf(0.5, [0.9])).toBe(0);
    // Target above everything → 100%.
    expect(percentileOf(0.95, [0.1, 0.2])).toBe(100);
    // Empty family → honest null, never a number.
    expect(percentileOf(0.5, [])).toBeNull();
    // Family order does not matter (count, not positional rank).
    expect(percentileOf(0.6, [0.9, 0.4, 0.5])).toBe(percentileOf(0.6, [0.4, 0.5, 0.9]));
  });

  it("rejects non-finite inputs instead of returning NaN", () => {
    expectEngineError(() => percentileOf(Number.NaN, [0.5]), "INVALID_GRAPH_INPUT");
    expectEngineError(
      () => percentileOf(0.5, [0.1, Number.POSITIVE_INFINITY]),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("hand-checks every percentile of a six-subset family", () => {
    // Size-2 family over P3/G3; each coherence equals its single edge value:
    //   [a1,n1]=0.7  [a1,s1]=0.5  [a1,s2]=0.6
    //   [n1,s1]=0.9  [n1,s2]=0.1  [s1,s2]=0.8
    // Percentile = 100·|{u : u < c}| / 6:
    //   0.7 → 3/6 = 50%;  0.5 → 1/6;  0.6 → 2/6;
    //   0.9 → 5/6;        0.1 → 0%;   0.8 → 4/6.
    const family = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: []
    });
    expect(family.totalValid).toBe(6);
    const percentiles = new Map(
      family.compositions.map((composition) => [
        composition.members.join(","),
        composition.percentile
      ])
    );
    expect(percentiles.get("a1,n1")).toBe((100 * 3) / 6);
    expect(percentiles.get("a1,s1")).toBe((100 * 1) / 6);
    expect(percentiles.get("a1,s2")).toBe((100 * 2) / 6);
    expect(percentiles.get("n1,s1")).toBe((100 * 5) / 6);
    expect(percentiles.get("n1,s2")).toBe(0);
    expect(percentiles.get("s1,s2")).toBe((100 * 4) / 6);
  });
});

describe("distinctivenessMean on compositions", () => {
  it("averages member d(k) and keeps percentile independent of missing d(k)", () => {
    // Lookup provides d for a1/n1/s1 but not s2:
    //   [a1,n1] → (0.2+0.6)/2 = 0.4   [a1,s1] → (0.2+0.4)/2 = 0.3
    //   [n1,s1] → (0.6+0.4)/2 = 0.5   any subset containing s2 → null
    // Percentile is still computed for every coherence-valid subset — the two
    // validity notions stay separate (ranking excludes null-mean compositions
    // later; percentile never does).
    const family = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: [],
      distinctiveness: { a1: 0.2, n1: 0.6, s1: 0.4 }
    });
    expect(family.totalValid).toBe(6);
    const byMembers = new Map(
      family.compositions.map((composition) => [composition.members.join(","), composition])
    );
    expect(byMembers.get("a1,n1")?.distinctivenessMean).toBeCloseTo(0.4, 12);
    expect(byMembers.get("a1,s1")?.distinctivenessMean).toBeCloseTo(0.3, 12);
    expect(byMembers.get("n1,s1")?.distinctivenessMean).toBeCloseTo(0.5, 12);
    expect(byMembers.get("a1,s2")?.distinctivenessMean).toBeNull();
    expect(byMembers.get("n1,s2")?.distinctivenessMean).toBeNull();
    expect(byMembers.get("s1,s2")?.distinctivenessMean).toBeNull();
    // Excluded-from-ranking subsets still carry honest percentiles.
    expect(byMembers.get("a1,s2")?.percentile).toBe((100 * 2) / 6);
    expect(byMembers.get("n1,s2")?.percentile).toBe(0);
  });

  it("marks every composition null when the distinctiveness lookup is omitted", () => {
    const family = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: []
    });
    for (const composition of family.compositions) {
      expect(composition.distinctivenessMean).toBeNull();
    }
  });

  it("treats an explicit null d(k) as unavailable, never as zero", () => {
    const family = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: [],
      distinctiveness: { a1: null, n1: 0.6, s1: 0.4, s2: 0.9 }
    });
    const byMembers = new Map(
      family.compositions.map((composition) => [composition.members.join(","), composition])
    );
    expect(byMembers.get("a1,n1")?.distinctivenessMean).toBeNull();
    expect(byMembers.get("n1,s1")?.distinctivenessMean).toBeCloseTo(0.5, 12);
  });

  it("rejects corrupt distinctiveness values loudly", () => {
    expectEngineError(
      () =>
        buildCompositions({
          pool: p3,
          graph: g3,
          size: 2,
          requiredRoles: [],
          distinctiveness: { a1: Number.NaN }
        }),
      "INVALID_COMPONENT"
    );
    expectEngineError(
      () =>
        buildCompositions({
          pool: p3,
          graph: g3,
          size: 2,
          requiredRoles: [],
          distinctiveness: { a1: 1.5 }
        }),
      "INVALID_COMPONENT"
    );
  });
});

describe("isRoleValidSubset", () => {
  const input = { pool: p4, graph: g4, requiredRoles: ["Anchor"] as ComponentRole[] };

  it("accepts a subset that passes evidence, edge and role filters", () => {
    expect(isRoleValidSubset(["a1", "s1"], input)).toBe(true);
  });

  it("rejects subsets failing exactly one filter with false, not an error", () => {
    expect(isRoleValidSubset(["n1", "s1"], input)).toBe(false); // no Anchor role
    expect(isRoleValidSubset(["a1", "s2"], input)).toBe(false); // s2 not measured
    expect(isRoleValidSubset(["a1", "n1"], input)).toBe(false); // edge unmeasured
    expect(isRoleValidSubset(["s1", "s2"], { ...input, requiredRoles: [] })).toBe(false);
  });

  it("throws typed errors on structurally invalid member lists", () => {
    expectEngineError(() => isRoleValidSubset(["a1"], input), "INVALID_GRAPH_INPUT");
    expectEngineError(() => isRoleValidSubset(["a1", "ghost"], input), "INVALID_COMPONENT");
    expectEngineError(() => isRoleValidSubset(["a1", "a1"], input), "INVALID_COMPONENT");
    expectEngineError(
      () => isRoleValidSubset(["a1", "s1"], { ...input, requiredRoles: ["Hero" as ComponentRole] }),
      "INVALID_COMPONENT"
    );
  });
});

describe("validation rejections", () => {
  it("rejects sizes below 2, non-integers and sizes above the pool", () => {
    for (const size of [0, 1, 1.5, Number.NaN]) {
      expectEngineError(
        () => buildCompositions({ pool: p4, graph: g4, size, requiredRoles: [] }),
        "INVALID_GRAPH_INPUT"
      );
    }
    expectEngineError(
      () => buildCompositions({ pool: p4, graph: g4, size: 5, requiredRoles: [] }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("rejects a K=1 pool for size 2 (degenerate by formula)", () => {
    const solo = makeRolePool([{ id: "solo" }]);
    expectEngineError(
      () =>
        buildCompositions({
          pool: solo,
          graph: { nodes: ["solo"], edges: [] },
          size: 2,
          requiredRoles: []
        }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("rejects unknown member ids, duplicates and single-member sets", () => {
    expectEngineError(() => measureComposition(["p"], pPQRS, gPQRS), "INVALID_GRAPH_INPUT");
    expectEngineError(
      () => measureComposition(["ghost", "p"], pPQRS, gPQRS),
      "INVALID_COMPONENT"
    );
    expectEngineError(
      () => measureComposition(["p", "p"], pPQRS, gPQRS),
      "INVALID_COMPONENT"
    );
  });

  it("rejects measuring across an unmeasured edge", () => {
    expectEngineError(() => measureComposition(["a1", "n1"], p4, g4), "INVALID_GRAPH_INPUT");
  });

  it("rejects duplicate pool ids and pool/graph node mismatches", () => {
    expectEngineError(
      () =>
        buildCompositions({
          pool: [...p4, p4[0]],
          graph: g4,
          size: 2,
          requiredRoles: []
        }),
      "INVALID_COMPONENT"
    );
    expectEngineError(
      () => buildCompositions({ pool: p4, graph: g5, size: 2, requiredRoles: [] }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => buildCompositions({ pool: p5, graph: g4, size: 2, requiredRoles: [] }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        buildCompositions({
          pool: p4,
          graph: { ...g4, nodes: [...g4.nodes.slice(0, 3), "a1"] },
          size: 2,
          requiredRoles: []
        }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("guards exact enumeration behind the candidate safety cap", () => {
    // C(20,10) = 184756 > MAX_ENUMERATION_CANDIDATES (10000) — far beyond the
    // spec's K≈10 (max 252 subsets) — so the call is refused up front.
    expect(MAX_ENUMERATION_CANDIDATES).toBeGreaterThanOrEqual(252);
    const ids = Array.from({ length: 20 }, (_, index) => `c${String(index).padStart(2, "0")}`);
    expectEngineError(
      () =>
        buildCompositions({
          pool: makeRolePool(ids.map((id) => ({ id }))),
          graph: makeMeasuredGraph(ids, []),
          size: 10,
          requiredRoles: []
        }),
      "INVALID_GRAPH_INPUT"
    );
  });
});

describe("composition schema", () => {
  it("rejects null weakest links, size mismatches, unknown keys and out-of-range values", () => {
    const valid = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: []
    }).compositions[0];
    expect(compositionSchema.safeParse({ ...valid, weakestLink: null }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...valid, size: valid.size + 1 }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...valid, percentile: 150 }).success).toBe(false);
    expect(compositionSchema.safeParse({ ...valid, coherence: -0.1 }).success).toBe(false);
    expect(compositionSchema.safeParse(valid).success).toBe(true);
  });
});

describe("composition determinism", () => {
  it("produces byte-identical families for identical and shuffled inputs", () => {
    const input = { pool: p3, graph: g3, size: 2, requiredRoles: [] as ComponentRole[] };
    const first = buildCompositions(input);
    const second = buildCompositions(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    const shuffled = buildCompositions({
      ...input,
      pool: [...input.pool].reverse(),
      graph: { nodes: [...g3.nodes].reverse(), edges: [...g3.edges].reverse() }
    });
    expect(shuffled).toEqual(first);
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(first));
  });

  it("freezes families, composition lists and member arrays", () => {
    const family = buildCompositions({
      pool: p3,
      graph: g3,
      size: 2,
      requiredRoles: []
    });
    expect(Object.isFrozen(family)).toBe(true);
    expect(Object.isFrozen(family.compositions)).toBe(true);
    expect(Object.isFrozen(family.requiredRoles)).toBe(true);
    expect(Object.isFrozen(family.compositions[0])).toBe(true);
    expect(Object.isFrozen(family.compositions[0].members)).toBe(true);
  });
});
