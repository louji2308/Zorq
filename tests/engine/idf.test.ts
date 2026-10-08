import { describe, expect, it } from "vitest";
import { buildNeighborhoods, computeIdf } from "../../src/server/engine/index.js";
import type { NeighborhoodSignalInput } from "../../src/server/engine/index.js";
import { makePool } from "./fixtures.js";

describe("computeIdf", () => {
  it("computes max(0, ln(K/(1+count))) across entity presence counts", () => {
    const pool = makePool(["c1", "c2", "c3", "c4"]);
    const inputs: NeighborhoodSignalInput[] = [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "once", rank: 1 },
          { entityId: "twice", rank: 2 },
          { entityId: "thrice", rank: 3 },
          { entityId: "everywhere", rank: 4 }
        ]
      },
      {
        componentId: "c2",
        domain: "movie",
        signals: [
          { entityId: "twice", rank: 1 },
          { entityId: "thrice", rank: 2 },
          { entityId: "everywhere", rank: 3 }
        ]
      },
      {
        componentId: "c3",
        domain: "brand",
        signals: [
          { entityId: "thrice", rank: 1 },
          { entityId: "everywhere", rank: 2 }
        ]
      },
      {
        componentId: "c4",
        domain: "artist",
        signals: [{ entityId: "everywhere", rank: 1 }]
      }
    ];
    const idf = computeIdf(pool, buildNeighborhoods(pool, inputs));
    // K=4. once in 1 component → ln(4/2) = ln 2.
    expect(idf.once).toBeCloseTo(Math.log(2), 12);
    // twice in 2 components → ln(4/3).
    expect(idf.twice).toBeCloseTo(Math.log(4 / 3), 12);
    // thrice in 3 components → ln(4/4) = 0.
    expect(idf.thrice).toBe(0);
    // everywhere in all 4 → ln(4/5) < 0 → floored to 0.
    expect(idf.everywhere).toBe(0);
  });

  it("floors every entity to 0 when K=1", () => {
    const pool = makePool(["only"]);
    const idf = computeIdf(
      pool,
      buildNeighborhoods(pool, [
        { componentId: "only", domain: "artist", signals: [{ entityId: "solo", rank: 1 }] }
      ])
    );
    // ln(1/2) < 0 → floored.
    expect(idf.solo).toBe(0);
  });

  it("returns an empty lookup for an empty pool", () => {
    expect(computeIdf([], [])).toEqual({});
  });

  it("returns keys in sorted order for byte-identical output", () => {
    const pool = makePool(["c1", "c2"]);
    const idf = computeIdf(
      pool,
      buildNeighborhoods(pool, [
        { componentId: "c1", domain: "artist", signals: [{ entityId: "zz", rank: 1 }] },
        { componentId: "c2", domain: "artist", signals: [{ entityId: "aa", rank: 1 }] }
      ])
    );
    expect(Object.keys(idf)).toEqual(["aa", "zz"]);
  });
});
