import { describe, expect, it } from "vitest";
import { EngineError, buildNeighborhoods } from "../../src/server/engine/index.js";
import type { NeighborhoodSignalInput } from "../../src/server/engine/index.js";
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

describe("buildNeighborhoods", () => {
  it("uses returned affinity when present, else 1/rank", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "e1", rank: 1, affinity: 0.75 },
          { entityId: "e2", rank: 4 }
        ]
      }
    ]);
    const artist = neighborhoods[0].domains.artist;
    // raw weights: e1 = 0.75, e2 = 1/4 = 0.25; total 1.0 → normalized unchanged.
    expect(artist).toEqual([
      { entityId: "e1", rank: 1, weight: 0.75, affinityUsed: true },
      { entityId: "e2", rank: 4, weight: 0.25, affinityUsed: false }
    ]);
  });

  it("falls back to 1/rank when affinity is not finite or not positive", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "e1", rank: 2, affinity: 0 },
          { entityId: "e2", rank: 2, affinity: -3 },
          { entityId: "e3", rank: 2, affinity: Number.NaN },
          { entityId: "e4", rank: 2, affinity: Number.POSITIVE_INFINITY }
        ]
      }
    ]);
    // Every entry falls back to 1/2 = 0.5; sum 2.0 → each normalized to 0.25.
    for (const entry of neighborhoods[0].domains.artist) {
      expect(entry.affinityUsed).toBe(false);
      expect(entry.weight).toBeCloseTo(0.25, 12);
    }
  });

  it("rejects ranks below one and non-integer ranks", () => {
    const pool = makePool(["c1"]);
    expectEngineError(
      () =>
        buildNeighborhoods(pool, [
          { componentId: "c1", domain: "artist", signals: [{ entityId: "e1", rank: 0 }] }
        ]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () =>
        buildNeighborhoods(pool, [
          { componentId: "c1", domain: "artist", signals: [{ entityId: "e1", rank: -2 }] }
        ]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    expectEngineError(
      () =>
        buildNeighborhoods(pool, [
          { componentId: "c1", domain: "artist", signals: [{ entityId: "e1", rank: 1.5 }] }
        ]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
  });

  it("caps each domain at 30 entries after weight ordering", () => {
    const pool = makePool(["c1"]);
    const signals = Array.from({ length: 35 }, (_, index) => ({
      entityId: `e${String(index + 1).padStart(2, "0")}`,
      rank: index + 1
    }));
    const neighborhoods = buildNeighborhoods(pool, [
      { componentId: "c1", domain: "artist", signals }
    ]);
    const artist = neighborhoods[0].domains.artist;
    expect(artist).toHaveLength(30);
    // weight = 1/rank, sorted desc → ranks 1..30 survive, rank 31..35 dropped.
    expect(artist[0].rank).toBe(1);
    expect(artist[29].rank).toBe(30);
    // Normalization: rank-1 entry keeps (1/1) / sum(1/r for r=1..30).
    const expectedTotal = Array.from({ length: 30 }, (_, index) => 1 / (index + 1)).reduce(
      (sum, value) => sum + value,
      0
    );
    expect(artist[0].weight).toBeCloseTo(1 / expectedTotal, 12);
  });

  it("breaks weight ties by entityId ascending", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "ccc", rank: 1, affinity: 0.2 },
          { entityId: "aaa", rank: 2, affinity: 0.2 },
          { entityId: "bbb", rank: 3, affinity: 0.2 }
        ]
      }
    ]);
    const artist = neighborhoods[0].domains.artist;
    expect(artist.map((entry) => entry.entityId)).toEqual(["aaa", "bbb", "ccc"]);
    for (const entry of artist) {
      expect(entry.weight).toBeCloseTo(1 / 3, 12);
    }
  });

  it("sum-normalizes weights within each domain block", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "a", rank: 1, affinity: 2 },
          { entityId: "b", rank: 2, affinity: 2 },
          { entityId: "c", rank: 3, affinity: 4 }
        ]
      },
      {
        componentId: "c1",
        domain: "movie",
        signals: [{ entityId: "m", rank: 1, affinity: 3 }]
      }
    ]);
    const artist = neighborhoods[0].domains.artist;
    // raw: c=4, a=2, b=2 (sorted desc); total 8 → 0.5, 0.25, 0.25.
    expect(artist.map((entry) => [entry.entityId, entry.weight])).toEqual([
      ["c", 0.5],
      ["a", 0.25],
      ["b", 0.25]
    ]);
    // movie domain normalized independently to sum 1.
    expect(neighborhoods[0].domains.movie[0].weight).toBe(1);
    const total = artist.reduce((sum, entry) => sum + entry.weight, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("treats empty domains as empty and classifies neighborhood state", () => {
    const pool = makePool(["c1", "c2", "c3"]);
    const neighborhoods = buildNeighborhoods(pool, [
      { componentId: "c1", domain: "artist", signals: [{ entityId: "a", rank: 1 }] },
      { componentId: "c1", domain: "movie", signals: [{ entityId: "m", rank: 1 }] },
      { componentId: "c1", domain: "brand", signals: [{ entityId: "b", rank: 1 }] }
    ]);
    const byId = new Map(neighborhoods.map((entry) => [entry.componentId, entry]));
    expect(byId.get("c1")?.state).toBe("measured");
    // c2 has no inputs at all → all domains empty → "not measured".
    expect(byId.get("c2")?.state).toBe("not measured");
    expect(byId.get("c2")?.domains).toEqual({ artist: [], movie: [], brand: [] });
    // c3 gets only one domain → "incomplete".
    const partial = buildNeighborhoods(pool, [
      { componentId: "c3", domain: "brand", signals: [{ entityId: "b", rank: 1 }] }
    ]).find((entry) => entry.componentId === "c3");
    expect(partial?.state).toBe("incomplete");
  });

  it("returns neighborhoods sorted by component id regardless of pool order", () => {
    const pool = makePool(["c3", "c1", "c2"]);
    const neighborhoods = buildNeighborhoods(pool, []);
    expect(neighborhoods.map((entry) => entry.componentId)).toEqual(["c1", "c2", "c3"]);
  });

  it("rejects signal inputs for unknown components and duplicate component/domain pairs", () => {
    const pool = makePool(["c1"]);
    expectEngineError(
      () =>
        buildNeighborhoods(pool, [
          { componentId: "ghost", domain: "artist", signals: [{ entityId: "e", rank: 1 }] }
        ]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
    const inputs: NeighborhoodSignalInput[] = [
      { componentId: "c1", domain: "artist", signals: [{ entityId: "e", rank: 1 }] },
      { componentId: "c1", domain: "artist", signals: [{ entityId: "f", rank: 1 }] }
    ];
    expectEngineError(() => buildNeighborhoods(pool, inputs), "INVALID_NEIGHBORHOOD_SIGNAL");
  });

  it("keeps the highest-weight occurrence when an entityId repeats within a domain", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "dup", rank: 5, affinity: 0.1 },
          { entityId: "dup", rank: 1, affinity: 0.9 },
          { entityId: "other", rank: 2, affinity: 0.5 }
        ]
      }
    ]);
    const artist = neighborhoods[0].domains.artist;
    expect(artist).toHaveLength(2);
    // dup kept with weight 0.9 (highest), other 0.5; total 1.4 → 0.9/1.4, 0.5/1.4.
    expect(artist[0]).toEqual({ entityId: "dup", rank: 1, weight: 0.9 / 1.4, affinityUsed: true });
    expect(artist[1]).toEqual({ entityId: "other", rank: 2, weight: 0.5 / 1.4, affinityUsed: true });
  });

  it("carries the entity name through to entries, trimmed, and rejects non-string names", () => {
    const pool = makePool(["c1"]);
    const neighborhoods = buildNeighborhoods(pool, [
      {
        componentId: "c1",
        domain: "artist",
        signals: [
          { entityId: "e1", rank: 1, affinity: 0.7, name: "  Alice Coltrane  " },
          { entityId: "e2", rank: 2, affinity: 0.3, name: "   " },
          { entityId: "e3", rank: 3, affinity: 0.2 }
        ]
      }
    ]);
    const artist = neighborhoods[0].domains.artist;
    expect(artist.find((entry) => entry.entityId === "e1")?.name).toBe("Alice Coltrane");
    expect(artist.find((entry) => entry.entityId === "e2")?.name).toBeUndefined();
    expect(artist.find((entry) => entry.entityId === "e3")?.name).toBeUndefined();
    expectEngineError(
      () =>
        buildNeighborhoods(pool, [
          {
            componentId: "c1",
            domain: "artist",
            signals: [{ entityId: "e4", rank: 1, name: 42 as unknown as string }]
          }
        ]),
      "INVALID_NEIGHBORHOOD_SIGNAL"
    );
  });
});
