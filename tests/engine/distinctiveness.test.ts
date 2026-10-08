import { describe, expect, it } from "vitest";
import {
  computeDistinctiveness,
  computeDistinctivenessMap,
  rankCompositions
} from "../../src/server/engine/index.js";
import type { TasteNeighborhood, WeightedEntity } from "../../src/server/engine/index.js";
import {
  expectEngineError,
  makeMeasuredGraph,
  makeRolePool
} from "./compositionFixtures.js";

function makeArtistNeighborhood(componentId: string, entityId: string): TasteNeighborhood {
  return {
    componentId,
    domains: {
      artist: [{ entityId, rank: 1, weight: 1, affinityUsed: false }],
      movie: [],
      brand: []
    },
    state: "measured"
  };
}

describe("computeDistinctiveness", () => {
  it("computes 1 − cosine on two known artist vectors", () => {
    // site = [3, 4] over {e1, e2}; city = [1, 0] over the union {e1, e2}.
    // cosine = (3·1 + 4·0) / (5 · 1) = 3/5 = 0.6 → d = 1 − 0.6 = 0.4 (exact).
    const d = computeDistinctiveness(
      [
        { entityId: "e1", weight: 3 },
        { entityId: "e2", weight: 4 }
      ],
      [{ entityId: "e1", weight: 1 }]
    );
    expect(d).toBe(0.4);
  });

  it("computes a second hand-worked three-entity vector pair", () => {
    // site = [1, 2, 2] over {a, b, c}; city = [2, 1, 0] over the union.
    // dot = 1·2 + 2·1 + 2·0 = 4 ; ‖site‖ = 3 ; ‖city‖ = √5
    // cosine = 4/(3√5) ≈ 0.5962847939906215 → d ≈ 0.4037152060093785.
    const d = computeDistinctiveness(
      [
        { entityId: "a", weight: 1 },
        { entityId: "b", weight: 2 },
        { entityId: "c", weight: 2 }
      ],
      [
        { entityId: "a", weight: 2 },
        { entityId: "b", weight: 1 }
      ]
    );
    expect(d).toBeCloseTo(1 - 4 / (3 * Math.sqrt(5)), 12);
  });

  it("returns a clamped near-zero for identical vectors (float drift)", () => {
    const vector: WeightedEntity[] = [
      { entityId: "x", weight: 0.6 },
      { entityId: "y", weight: 0.4 }
    ];
    const d = computeDistinctiveness(vector, [...vector]);
    expect(d).not.toBeNull();
    // Exact arithmetic gives cosine = 1 → d = 0; float sqrt round-off can
    // leave a few ULPs of drift, but the result stays clamped to [0, 1].
    expect(d as number).toBeGreaterThanOrEqual(0);
    expect(d as number).toBeLessThanOrEqual(1);
    expect(d as number).toBeCloseTo(0, 12);
  });

  it("returns null when the city vector is missing or a vector is empty", () => {
    const site: WeightedEntity[] = [{ entityId: "x", weight: 1 }];
    const city: WeightedEntity[] = [{ entityId: "x", weight: 1 }];
    expect(computeDistinctiveness(site, null)).toBeNull();
    expect(computeDistinctiveness(site, undefined)).toBeNull();
    expect(computeDistinctiveness([], city)).toBeNull();
    expect(computeDistinctiveness(site, [])).toBeNull();
    expect(computeDistinctiveness([], [])).toBeNull();
  });

  it("rejects corrupt vectors instead of averaging nonsense", () => {
    const site: WeightedEntity[] = [{ entityId: "x", weight: 1 }];
    expectEngineError(
      () =>
        computeDistinctiveness(
          [
            { entityId: "x", weight: 1 },
            { entityId: "x", weight: 2 }
          ],
          site
        ),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () => computeDistinctiveness(site, [{ entityId: "x", weight: 0 }]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () => computeDistinctiveness(site, [{ entityId: "x", weight: Number.NaN }]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () => computeDistinctiveness(site, [{ entityId: "  ", weight: 1 }]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () => computeDistinctiveness(site, "city" as unknown as WeightedEntity[]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
  });
});

describe("computeDistinctivenessMap", () => {
  it("builds a deterministic keyed map with null for missing city vectors", () => {
    const neighborhoods = [
      makeArtistNeighborhood("s1", "z"),
      makeArtistNeighborhood("a1", "x"),
      makeArtistNeighborhood("n1", "y")
    ];
    const cityVectors = {
      a1: [{ entityId: "x", weight: 1 }],
      n1: [{ entityId: "y", weight: 1 }]
      // s1 deliberately absent → d(s1) must be null, never a fake number.
    };
    const map = computeDistinctivenessMap(neighborhoods, cityVectors);
    expect(Object.keys(map)).toEqual(["a1", "n1", "s1"]);
    expect(map.a1).toBe(0);
    expect(map.n1).toBe(0);
    expect(map.s1).toBeNull();
    expect(Object.isFrozen(map)).toBe(true);
  });

  it("accepts an explicit null city entry as unavailable", () => {
    const map = computeDistinctivenessMap([makeArtistNeighborhood("a1", "x")], {
      a1: null
    });
    expect(map.a1).toBeNull();
  });

  it("rejects duplicate neighborhoods for the same component", () => {
    expectEngineError(
      () =>
        computeDistinctivenessMap(
          [
            makeArtistNeighborhood("a1", "x"),
            makeArtistNeighborhood("a1", "y")
          ],
          {}
        ),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
  });
});

describe("distinctiveness exclusion end to end", () => {
  it("excludes compositions whose members lack a city vector, with a reason", () => {
    // Pool of three measured components, complete measured graph (C=0.5 on
    // every pair). Distinctiveness: a1 = 0, n1 = 0, s1 = null (no city
    // vector). Size-2 family:
    //   [a1,n1] d̄ = 0        → rankable
    //   [a1,s1] d̄ = null     → excluded
    //   [n1,s1] d̄ = null     → excluded
    // The ranked set never receives a fabricated 0 for s1; the sweep still
    // reports honest leadership for the single rankable composition.
    const pool = makeRolePool([
      { id: "a1", role: "Anchor" },
      { id: "n1", role: "Night" },
      { id: "s1", role: "Social" }
    ]);
    const graph = makeMeasuredGraph(
      ["a1", "n1", "s1"],
      [
        ["a1", "n1", 0.5],
        ["a1", "s1", 0.5],
        ["n1", "s1", 0.5]
      ]
    );
    const distinctiveness = computeDistinctivenessMap(
      [
        makeArtistNeighborhood("a1", "x"),
        makeArtistNeighborhood("n1", "y"),
        makeArtistNeighborhood("s1", "z")
      ],
      {
        a1: [{ entityId: "x", weight: 1 }],
        n1: [{ entityId: "y", weight: 1 }]
      }
    );
    const result = rankCompositions({
      pool,
      graph,
      size: 2,
      requiredRoles: [],
      distinctiveness
    });
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].members).toEqual(["a1", "n1"]);
    expect(result.ranked[0].distinctivenessMean).toBe(0);
    expect(result.excluded).toEqual([
      { members: ["a1", "s1"], reason: "distinctiveness_unavailable" },
      { members: ["n1", "s1"], reason: "distinctiveness_unavailable" }
    ]);
    expect(result.sweep.points).toHaveLength(101);
    expect(result.sweep.points.every((point) => point.leader?.[0] === "a1")).toBe(true);
    expect(result.sweep.flips).toEqual([]);
  });
});
