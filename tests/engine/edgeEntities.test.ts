import { describe, expect, it } from "vitest";
import { sharedEntitiesForEdge, type TasteNeighborhood } from "../../src/server/engine/index.js";

function neighborhood(
  componentId: string,
  entries: Partial<Record<"artist" | "movie" | "brand", Array<{ entityId: string; weight: number }>>>
): TasteNeighborhood {
  const toEntries = (list: Array<{ entityId: string; weight: number }> | undefined): TasteNeighborhood["domains"]["artist"] =>
    (list ?? []).map((entry) => ({
      entityId: entry.entityId,
      rank: 1,
      weight: entry.weight,
      affinityUsed: true
    }));
  return {
    componentId,
    domains: {
      artist: toEntries(entries.artist),
      movie: toEntries(entries.movie),
      brand: toEntries(entries.brand)
    },
    state: "measured"
  };
}

const IDF: Record<string, number> = {
  "urn:entity:artist-a": 0.5,
  "urn:entity:artist-b": 0.2,
  "urn:entity:artist-rare": 1.0,
  "urn:entity:film-x": 0.7
};

describe("sharedEntitiesForEdge", () => {
  it("keeps only entities present in both neighborhoods and computes aWeight * idf * bWeight * idf", () => {
    const a = neighborhood("a", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 0.9 },
        { entityId: "urn:entity:artist-rare", weight: 0.1 }
      ]
    });
    const b = neighborhood("b", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 0.4 },
        { entityId: "urn:entity:artist-b", weight: 0.8 }
      ]
    });
    const shared = sharedEntitiesForEdge(a, b, IDF);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.entityId).toBe("urn:entity:artist-a");
    expect(shared[0]?.dotContribution).toBeCloseTo(0.9 * 0.5 * 0.4 * 0.5, 10);
  });

  it("sorts by dotContribution desc, then entityId asc, then domain asc", () => {
    const a = neighborhood("a", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 0.9 },
        { entityId: "urn:entity:artist-b", weight: 0.5 }
      ],
      movie: [{ entityId: "urn:entity:film-x", weight: 0.9 }],
      brand: [{ entityId: "urn:entity:artist-a", weight: 0.5 }]
    });
    const b = neighborhood("b", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 0.9 },
        { entityId: "urn:entity:artist-b", weight: 0.5 }
      ],
      movie: [{ entityId: "urn:entity:film-x", weight: 0.5 }],
      brand: [{ entityId: "urn:entity:artist-a", weight: 0.9 }]
    });
    const shared = sharedEntitiesForEdge(a, b, IDF);
    const keys = shared.map((entry) => `${entry.domain}:${entry.entityId}`);
    expect(keys).toEqual(["movie:urn:entity:film-x", "artist:urn:entity:artist-a", "brand:urn:entity:artist-a", "artist:urn:entity:artist-b"]);
  });

  it("returns an empty list when no entity overlaps", () => {
    const a = neighborhood("a", { artist: [{ entityId: "urn:entity:artist-a", weight: 1 }] });
    const b = neighborhood("b", { artist: [{ entityId: "urn:entity:artist-b", weight: 1 }] });
    expect(sharedEntitiesForEdge(a, b, IDF)).toEqual([]);
  });

  it("respects a custom cap and a non-finite cap falls back to the default", () => {
    const a = neighborhood("a", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 1 },
        { entityId: "urn:entity:artist-b", weight: 1 }
      ]
    });
    const b = neighborhood("b", {
      artist: [
        { entityId: "urn:entity:artist-a", weight: 1 },
        { entityId: "urn:entity:artist-b", weight: 1 }
      ]
    });
    expect(sharedEntitiesForEdge(a, b, IDF, 1)).toHaveLength(1);
    expect(sharedEntitiesForEdge(a, b, IDF, Number.NaN)).toHaveLength(2);
  });

  it("treats a missing idf lookup as 0", () => {
    const a = neighborhood("a", { artist: [{ entityId: "unknown-entity", weight: 1 }] });
    const b = neighborhood("b", { artist: [{ entityId: "unknown-entity", weight: 1 }] });
    const shared = sharedEntitiesForEdge(a, b, IDF);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.idf).toBe(0);
    expect(shared[0]?.dotContribution).toBe(0);
  });
});
