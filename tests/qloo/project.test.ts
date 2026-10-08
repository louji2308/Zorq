import { describe, expect, it } from "vitest";
import {
  capabilitiesResult,
  projectCapabilities,
  projectCompareResults,
  projectEntities,
  projectHeatmapCells,
  projectResolution,
  projectTags
} from "../../src/server/qloo/project.js";

const ENTITY = {
  entity_id: "e-1",
  name: "Blue Note",
  type: "urn:entity:place",
  affinity: 0.91,
  popularity: 0.72,
  distance_meters: 140,
  location: { lat: 40.7306, lon: -74.0005, geohash: "dr5ru9" },
  address: "131 W 3rd St, New York, NY",
  properties: {
    city: "New York",
    country: "US",
    description: "Greenwich Village jazz club",
    image: { url: "https://images.example/blue-note.jpg" }
  },
  query: {
    measurements: { reach: 0.4, "fit.score": 12 },
    explainability: { "e-1": [{ entity_id: "signal-9", score: 0.55 }] }
  }
};

describe("qloo projections", () => {
  it("projects entities from nested results and from a bare array", () => {
    const nested = projectEntities({ results: { entities: [ENTITY] } });
    const bare = projectEntities([ENTITY]);
    expect(nested).toEqual(bare);
    expect(nested).toHaveLength(1);
    const projected = nested[0];
    expect(projected.entityId).toBe("e-1");
    expect(projected.type).toBe("place");
    expect(projected.affinity).toBe(0.91);
    expect(projected.popularity).toBe(0.72);
    expect(projected.distanceMeters).toBe(140);
    expect(projected.location).toEqual({ lat: 40.7306, lon: -74.0005, geohash: "dr5ru9" });
    expect(projected.address).toBe("131 W 3rd St, New York, NY");
    expect(projected.city).toBe("New York");
    expect(projected.country).toBe("US");
    expect(projected.imageUrl).toBe("https://images.example/blue-note.jpg");
    expect(projected.description).toBe("Greenwich Village jazz club");
    expect(projected.measurements).toEqual({ reach: 0.4, "fit.score": 12 });
    expect(projected.explainability).toEqual({ "e-1": [{ entityId: "signal-9", score: 0.55 }] });
  });

  it("drops rows without an identity instead of inventing one", () => {
    expect(projectEntities({ results: { entities: [{ name: "anonymous" }, { id: "fallback-id" }] } })).toEqual([
      { entityId: "fallback-id" }
    ]);
    expect(projectTags([{ name: "nameless" }, { tag_id: "t-7", name: "jazz" }])).toEqual([{ id: "t-7", name: "jazz" }]);
    expect(projectHeatmapCells([{ latitude: 40.7 }, { latitude: 40.7, longitude: -74, affinity: 0.5 }])).toEqual([
      { latitude: 40.7, longitude: -74, affinity: 0.5 }
    ]);
  });

  it("reads tags from either shape and scores them", () => {
    expect(projectTags({ results: { tags: [{ id: "t-1", name: "Jazz", score: 0.88 }] } })).toEqual([
      { id: "t-1", name: "Jazz", score: 0.88 }
    ]);
    expect(projectTags({ results: [{ tag_id: "t-2", affinity: 0.4 }] })).toEqual([{ id: "t-2", score: 0.4 }]);
  });

  it("projects heatmap cells with ranks and geohash", () => {
    const cells = projectHeatmapCells({
      results: {
        heatmap: [
          { latitude: 40.7, longitude: -74, geohash: "dr5", affinity: 0.6, affinity_rank: 3, popularity: 0.2 }
        ]
      }
    });
    expect(cells).toEqual([
      {
        latitude: 40.7,
        longitude: -74,
        geohash: "dr5",
        affinity: 0.6,
        affinityRank: 3,
        popularity: 0.2
      }
    ]);
  });

  it("projects compare groups as tags and matched rows as entities", () => {
    const projected = projectCompareResults({
      results: {
        tags: [{ id: "shared-1" }],
        a: [{ id: "a-1" }],
        b: [{ id: "b-1" }],
        matchEntities: [
          { entity_id: "e-10", name: "Venue A" },
          { id: "inline-tag", score: 0.3 }
        ]
      }
    });
    expect(projected.tags).toEqual([{ id: "shared-1" }, { id: "inline-tag", score: 0.3 }]);
    expect(projected.a).toEqual([{ id: "a-1" }]);
    expect(projected.b).toEqual([{ id: "b-1" }]);
    expect(projected.matchEntities).toEqual([{ entityId: "e-10", name: "Venue A" }]);
  });

  it("projects resolution issues and outcomes with their candidates", () => {
    const resolution = projectResolution({
      issues: [{ input: "Blue Nte", kind: "ambiguous", candidates: [{ id: "e-1", name: "Blue Note" }] }],
      outcomes: [{ input: "Blue Nte", status: "resolved", selected: { id: "e-1", name: "Blue Note" } }]
    });
    expect(resolution).toBeDefined();
    expect(resolution?.issues?.[0]).toEqual({
      input: "Blue Nte",
      kind: "ambiguous",
      candidates: [{ id: "e-1", name: "Blue Note" }]
    });
    expect(resolution?.outcomes?.[0]).toEqual({
      input: "Blue Nte",
      status: "resolved",
      selected: { id: "e-1", name: "Blue Note" }
    });
    expect(projectResolution({})).toBeUndefined();
    expect(projectResolution(undefined)).toBeUndefined();
  });

  it("projects MCP capability payloads", () => {
    expect(
      projectCapabilities({
        contract_version: "2025-06",
        contract_checksum: "sha256:abc",
        adapter: {
          ready: true,
          compatibility: "compatible",
          supported_operation_ids: ["capabilities", "resolveTags"]
        }
      })
    ).toEqual({
      contractVersion: "2025-06",
      contractChecksum: "sha256:abc",
      ready: true,
      compatibility: "compatible",
      supportedOperationIds: ["capabilities", "resolveTags"]
    });
    expect(projectCapabilities("not an object")).toEqual({});
  });

  it("builds capability envelopes with readiness, checksum flags and counts", () => {
    const rest = capabilitiesResult("rest", "https://hackathon.api.qloo.com", {}, undefined);
    expect(rest).toEqual({ transport: "rest", endpoint: "https://hackathon.api.qloo.com", ready: true });

    const mcp = capabilitiesResult(
      "mcp",
      "stdio:harness",
      { ready: true, contractChecksum: "sha256:abc", supportedOperationIds: ["capabilities", "search"] },
      true
    );
    expect(mcp.ready).toBe(true);
    expect(mcp.contractChecksum).toBe("sha256:abc");
    expect(mcp.contractChecksumChanged).toBe(true);
    expect(mcp.supportedOperationIds).toEqual(["capabilities", "search"]);

    expect(capabilitiesResult("mcp", "stdio:harness", {}, undefined).ready).toBe(false);
    expect(capabilitiesResult("mcp", "stdio:harness", { ready: false }, undefined).contractChecksumChanged).toBeUndefined();
  });
});
