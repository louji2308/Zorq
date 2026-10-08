import { describe, expect, it } from "vitest";
import {
  EngineError,
  assignEdgeBands,
  buildGraph,
  buildNeighborhoods,
  computeIdf,
  cosineSimilarity
} from "../../src/server/engine/index.js";
import type {
  ComponentEvidenceState,
  CultureGraph,
  GraphEdge,
  NeighborhoodSignalInput,
  TasteNeighborhood
} from "../../src/server/engine/index.js";
import { makePool } from "./fixtures.js";

function expectEngineError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
  expect((caught as EngineError).message).not.toBe("");
}

function edgeMap(graph: CultureGraph): Map<string, GraphEdge> {
  return new Map(graph.edges.map((edge) => [`${edge.a}|${edge.b}`, edge]));
}

function pipeline(
  ids: readonly string[],
  inputs: NeighborhoodSignalInput[],
  overrides: Partial<Record<string, ComponentEvidenceState>> = {}
): CultureGraph {
  const pool = makePool(ids).map((component) => {
    const state = overrides[component.id];
    return state !== undefined ? { ...component, evidenceState: state } : component;
  });
  const neighborhoods = buildNeighborhoods(pool, inputs);
  return buildGraph(pool, neighborhoods, computeIdf(pool, neighborhoods));
}

describe("cosineSimilarity", () => {
  it("computes cosine of two known vectors", () => {
    // [3,4]·[1,0] = 3; ||[3,4]|| = 5; ||[1,0]|| = 1 → 3/5.
    expect(cosineSimilarity([3, 4], [1, 0])).toBeCloseTo(0.6, 12);
  });

  it("computes cosine across a three-domain concatenation", () => {
    // [1,2,2]·[2,1,0] = 2+2+0 = 4; ||a|| = 3; ||b|| = √5 → 4/(3√5).
    expect(cosineSimilarity([1, 2, 2], [2, 1, 0])).toBeCloseTo(4 / (3 * Math.sqrt(5)), 12);
  });

  it("returns 1 for parallel vectors, 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([0.3, 0.4], [0.3, 0.4])).toBeCloseTo(1, 12);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns null for zero vectors instead of NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBeNull();
    expect(cosineSimilarity([0, 0], [0, 0])).toBeNull();
  });

  it("throws on length mismatch", () => {
    expectEngineError(() => cosineSimilarity([1], [1, 2]), "INVALID_GRAPH_INPUT");
  });
});

describe("assignEdgeBands", () => {
  it("splits six distinct values into two strong, two typical, two weak", () => {
    const banded = assignEdgeBands([
      { a: "c", b: "d", value: 0.4 },
      { a: "a", b: "b", value: 0.9 },
      { a: "e", b: "f", value: 0.5 },
      { a: "g", b: "h", value: 0.8 },
      { a: "i", b: "j", value: 0.6 },
      { a: "k", b: "l", value: 0.7 }
    ]);
    expect(banded).toEqual([
      { a: "a", b: "b", value: 0.9, band: "strong" },
      { a: "g", b: "h", value: 0.8, band: "strong" },
      { a: "k", b: "l", value: 0.7, band: "typical" },
      { a: "i", b: "j", value: 0.6, band: "typical" },
      { a: "e", b: "f", value: 0.5, band: "weak" },
      { a: "c", b: "d", value: 0.4, band: "weak" }
    ]);
  });

  it("keeps the middle band larger when the remainder is not divisible", () => {
    // m=7, floor(7/3)=2 → strong 2, typical 3, weak 2.
    const values = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const banded = assignEdgeBands(
      values.map((value, index) => ({ a: `c${index}`, b: `d${index}`, value }))
    );
    expect(banded.map((edge) => edge.band)).toEqual([
      "strong",
      "strong",
      "typical",
      "typical",
      "typical",
      "weak",
      "weak"
    ]);
    // m=5, floor(5/3)=1 → strong 1, typical 3, weak 1.
    const five = assignEdgeBands(
      values.slice(0, 5).map((value, index) => ({ a: `c${index}`, b: `d${index}`, value }))
    );
    expect(five.map((edge) => edge.band)).toEqual([
      "strong",
      "typical",
      "typical",
      "typical",
      "weak"
    ]);
  });

  it("assigns every edge 'typical' when fewer than three edges are measured", () => {
    expect(
      assignEdgeBands([
        { a: "a", b: "b", value: 0.7 },
        { a: "c", b: "d", value: 0.2 }
      ]).map((edge) => edge.band)
    ).toEqual(["typical", "typical"]);
    expect(assignEdgeBands([{ a: "a", b: "b", value: 0.7 }])[0].band).toBe("typical");
    expect(assignEdgeBands([])).toEqual([]);
  });

  it("breaks value ties deterministically by a then b ascending", () => {
    const banded = assignEdgeBands([
      { a: "x", b: "y", value: 0.5 },
      { a: "c", b: "d", value: 0.9 },
      { a: "a", b: "b", value: 0.5 }
    ]);
    // sorted desc then (a,b): (c,d,0.9), (a,b,0.5), (x,y,0.5); m=3 → 1/1/1.
    expect(banded).toEqual([
      { a: "c", b: "d", value: 0.9, band: "strong" },
      { a: "a", b: "b", value: 0.5, band: "typical" },
      { a: "x", b: "y", value: 0.5, band: "weak" }
    ]);
  });
});

describe("buildGraph", () => {
  it("builds the complete graph over four components with six edges", () => {
    // K=4. x1 shared by c1,c2 → IDF ln(4/3); x2 only c3, x3 only c4 → IDF ln 2.
    const graph = pipeline(["c1", "c2", "c3", "c4"], [
      { componentId: "c1", domain: "artist", signals: [{ entityId: "x1", rank: 1, affinity: 1 }] },
      { componentId: "c2", domain: "artist", signals: [{ entityId: "x1", rank: 1, affinity: 1 }] },
      { componentId: "c3", domain: "artist", signals: [{ entityId: "x2", rank: 1, affinity: 1 }] },
      { componentId: "c4", domain: "artist", signals: [{ entityId: "x3", rank: 1, affinity: 1 }] }
    ]);
    expect(graph.nodes).toEqual(["c1", "c2", "c3", "c4"]);
    expect(graph.edges).toHaveLength(6);
    // (c1,c2): identical vectors {x1: ln(4/3)} → cosine 1.
    // all other pairs are disjoint after IDF → cosine 0.
    const edges = edgeMap(graph);
    expect(edges.get("c1|c2")).toEqual({
      a: "c1",
      b: "c2",
      value: 1,
      band: "strong",
      state: "measured"
    });
    expect(edges.get("c1|c3")).toEqual({
      a: "c1",
      b: "c3",
      value: 0,
      band: "strong",
      state: "measured"
    });
    expect(edges.get("c1|c4")).toMatchObject({ value: 0, band: "typical" });
    expect(edges.get("c2|c3")).toMatchObject({ value: 0, band: "typical" });
    expect(edges.get("c2|c4")).toMatchObject({ value: 0, band: "weak" });
    expect(edges.get("c3|c4")).toMatchObject({ value: 0, band: "weak" });
  });

  it("computes a hand-worked shared-entity cosine across two domains", () => {
    // K=4. c1: artist e + movie m; c2: artist e only.
    // IDF(e): in 2 comps → ln(4/3). IDF(m): in 1 comp → ln(4/2) = ln 2.
    // normalized domain weights are 1 (single entry each).
    // c1 vector [ln(4/3), ln 2], c2 [ln(4/3), 0].
    // cosine = ln(4/3)² / (ln(4/3) · √(ln(4/3)² + ln2²)) = ln(4/3) / √(ln(4/3)² + ln2²).
    const graph = pipeline(["c1", "c2", "c3", "c4"], [
      {
        componentId: "c1",
        domain: "artist",
        signals: [{ entityId: "e", rank: 1, affinity: 1 }]
      },
      {
        componentId: "c1",
        domain: "movie",
        signals: [{ entityId: "m", rank: 1, affinity: 1 }]
      },
      {
        componentId: "c2",
        domain: "artist",
        signals: [{ entityId: "e", rank: 1, affinity: 1 }]
      }
    ]);
    const expected = Math.log(4 / 3) / Math.hypot(Math.log(4 / 3), Math.log(2));
    expect(edgeMap(graph).get("c1|c2")?.value).toBeCloseTo(expected, 10);
    // c3 and c4 have empty neighborhoods → every edge involving them is unmeasured.
    expect(edgeMap(graph).get("c1|c3")).toEqual({
      a: "c1",
      b: "c3",
      value: null,
      band: null,
      state: "unmeasured"
    });
    expect(edgeMap(graph).get("c3|c4")).toMatchObject({ value: null, state: "unmeasured" });
  });

  it("computes a hand-worked two-domain cosine with partial overlap", () => {
    // K=5. c1 artist {p:0.5, q:0.5}, c2 artist {p:0.5, r:0.5} (sum-normalized).
    // IDF(p): count 2 → ln(5/3); IDF(q), IDF(r): count 1 → ln(5/2).
    // c1 = [0.5·ln(5/3), 0.5·ln(5/2), 0]; c2 = [0.5·ln(5/3), 0, 0.5·ln(5/2)].
    // dot = 0.25·ln(5/3)²; ||c1|| = ||c2|| = 0.5·√(ln(5/3)² + ln(5/2)²).
    // cosine = ln(5/3)² / (ln(5/3)² + ln(5/2)²).
    const graph = pipeline(["c1", "c2", "c3", "c4", "c5"], [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "p", rank: 1, affinity: 1 },
          { entityId: "q", rank: 2, affinity: 1 }
        ]
      },
      {
        componentId: "c2",
        domain: "artist",
        signals: [
          { entityId: "p", rank: 1, affinity: 1 },
          { entityId: "r", rank: 2, affinity: 1 }
        ]
      }
    ]);
    const ln53 = Math.log(5 / 3);
    const ln52 = Math.log(5 / 2);
    const expected = (ln53 * ln53) / (ln53 * ln53 + ln52 * ln52);
    expect(edgeMap(graph).get("c1|c2")?.value).toBeCloseTo(expected, 10);
  });

  it("returns identical cosine 1 for identical three-domain neighborhoods", () => {
    // K=5 keeps shared entities (count 2 → ln(5/3) > 0) from flooring to zero.
    const graph = pipeline(["c1", "c2", "c3", "c4", "c5"], [
      {
        componentId: "c1",
        domain: "artist",
        signals: [{ entityId: "a1", rank: 1, affinity: 0.4 }]
      },
      {
        componentId: "c1",
        domain: "movie",
        signals: [{ entityId: "m1", rank: 1, affinity: 0.3 }]
      },
      {
        componentId: "c1",
        domain: "brand",
        signals: [{ entityId: "b1", rank: 1, affinity: 0.5 }]
      },
      {
        componentId: "c2",
        domain: "artist",
        signals: [{ entityId: "a1", rank: 1, affinity: 0.4 }]
      },
      {
        componentId: "c2",
        domain: "movie",
        signals: [{ entityId: "m1", rank: 1, affinity: 0.3 }]
      },
      {
        componentId: "c2",
        domain: "brand",
        signals: [{ entityId: "b1", rank: 1, affinity: 0.5 }]
      }
    ]);
    const value = edgeMap(graph).get("c1|c2")?.value;
    expect(value).toBeCloseTo(1, 12);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("marks all edges unmeasured when IDF floors every weight to zero", () => {
    // K=3 with the single entity present around every component:
    // ln(3/4) < 0 → floored 0 → every vector is all-zero.
    const graph = pipeline(["c1", "c2", "c3"], [
      { componentId: "c1", domain: "artist", signals: [{ entityId: "u", rank: 1 }] },
      { componentId: "c2", domain: "artist", signals: [{ entityId: "u", rank: 1 }] },
      { componentId: "c3", domain: "artist", signals: [{ entityId: "u", rank: 1 }] }
    ]);
    for (const edge of graph.edges) {
      expect(edge).toEqual({ a: edge.a, b: edge.b, value: null, band: null, state: "unmeasured" });
    }
  });

  it("marks edges of non-measured components unmeasured even with shared content", () => {
    // K=4 so the shared entity (count 2) keeps IDF ln(4/3) > 0.
    const graph = pipeline(
      ["c1", "c2", "c3", "c4"],
      [
        { componentId: "c1", domain: "artist", signals: [{ entityId: "shared", rank: 1 }] },
        { componentId: "c2", domain: "artist", signals: [{ entityId: "shared", rank: 1 }] },
        { componentId: "c3", domain: "artist", signals: [{ entityId: "other", rank: 1 }] },
        { componentId: "c4", domain: "artist", signals: [{ entityId: "another", rank: 1 }] }
      ],
      { c2: "incomplete" }
    );
    const edges = edgeMap(graph);
    expect(edges.get("c1|c2")).toEqual({
      a: "c1",
      b: "c2",
      value: null,
      band: null,
      state: "unmeasured"
    });
    expect(edges.get("c2|c3")).toMatchObject({ value: null, state: "unmeasured" });
    // The c1|c3 pair stays measured (both components measured, non-empty vectors).
    expect(edges.get("c1|c3")).toMatchObject({ state: "measured" });
  });

  it("keeps every measured value inside [0,1] against float drift", () => {
    // K=4; v1..v3 shared (count 2 → ln(4/3) > 0), v4 unique to c3.
    const graph = pipeline(["c1", "c2", "c3", "c4"], [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "v1", rank: 1, affinity: 0.3333333333333333 },
          { entityId: "v2", rank: 2, affinity: 0.3333333333333333 },
          { entityId: "v3", rank: 3, affinity: 0.3333333333333334 }
        ]
      },
      {
        componentId: "c2",
        domain: "artist",
        signals: [
          { entityId: "v1", rank: 1, affinity: 0.3333333333333333 },
          { entityId: "v2", rank: 2, affinity: 0.3333333333333333 },
          { entityId: "v3", rank: 3, affinity: 0.3333333333333334 }
        ]
      },
      {
        componentId: "c3",
        domain: "artist",
        signals: [
          { entityId: "v3", rank: 1, affinity: 0.5 },
          { entityId: "v4", rank: 2, affinity: 0.25 }
        ]
      }
    ]);
    for (const edge of graph.edges) {
      if (edge.value !== null) {
        expect(edge.value).toBeGreaterThanOrEqual(0);
        expect(edge.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rejects missing or duplicate neighborhoods and unknown references", () => {
    const pool = makePool(["c1", "c2"]);
    const neighborhoods = buildNeighborhoods(pool, []);
    expectEngineError(() => buildGraph(pool, neighborhoods.slice(0, 1)), "INVALID_GRAPH_INPUT");
    expectEngineError(
      () => buildGraph(pool, [...neighborhoods, ...neighborhoods.slice(0, 1)]),
      "INVALID_GRAPH_INPUT"
    );
    const stray: TasteNeighborhood = { ...neighborhoods[0], componentId: "ghost" };
    expectEngineError(() => buildGraph(pool, [stray, neighborhoods[1]]), "INVALID_GRAPH_INPUT");
  });
});
