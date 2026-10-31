import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/shared/brief.js";
import { createLedger } from "../../src/server/agent/ledger.js";
import { createObservationIndex } from "../../src/server/agent/pool.js";
import { runSiteScan } from "../../src/server/agent/siteScan.js";
import { fakeGateway, okEnvelope, outageError } from "./support/fakes.js";

const BRIEF: Brief = {
  location: "Uthiramerur, Tamil Nadu",
  coordinates: { lat: 12.617045800147215, lon: 79.75984934717417 },
  radius: 400,
  objective: "Design a cultural anchor for the town"
};

function place(id: string, name: string, lat: number, lon: number) {
  return { entityId: id, name, type: "place", location: { lat, lon } };
}

describe("deterministic site scan", () => {
  it("escalates the radius until it has real places and labels the operational scope", async () => {
    const ledger = createLedger();
    const index = createObservationIndex();
    const radii: number[] = [];
    const gateway = fakeGateway({
      onCall: (call) => {
        const radius = (call.request as { location: { radiusM: number } }).location.radiusM;
        radii.push(radius);
        const count = radius <= 400 ? 1 : radius <= 2_000 ? 2 : 12;
        const entities = Array.from({ length: count }, (_, position) =>
          place(
            `urn:entity:place-${radius}-${position}`,
            `Place ${radius}-${position}`,
            12.617 + position * 0.001,
            79.759
          )
        );
        return Promise.resolve(
          okEnvelope("insights", {
            results: { entities },
            resultCount: entities.length
          })
        );
      }
    });

    const result = await runSiteScan({
      brief: BRIEF,
      gateway: gateway.gateway,
      ledger,
      index,
      now: () => Date.parse("2026-10-28T00:00:00.000Z")
    });

    expect(radii).toEqual([400, 2_000, 10_000]);
    expect(result.observations).toBe(3);
    expect(result.placeCount).toBe(15);
    expect(result.scope).toBe("district (<=10 km)");
    expect(result.evidence).toHaveLength(3);
    expect(result.message).toContain("real Qloo place insights, not a model guess");
    expect(result.message).toContain("Place 10000-0");
    expect(result.message).toContain("district (<=10 km)");
    expect(index.locatedEntities()).toHaveLength(15);
    expect(ledger.list().map((entry) => entry.event.label)).toContain("site.scan");
  });

  it("uses one location-query scan when the brief has no coordinates", async () => {
    const ledger = createLedger();
    const index = createObservationIndex();
    const queries: string[] = [];
    const gateway = fakeGateway({
      onCall: (call) => {
        queries.push((call.request as { location: { query: string } }).location.query);
        return Promise.resolve(
          okEnvelope("insights", {
            results: {
              entities: [place("urn:entity:place-a", "Alpha", 13.08, 80.27)]
            },
            resultCount: 1
          })
        );
      }
    });

    const result = await runSiteScan({
      brief: { ...BRIEF, coordinates: undefined },
      gateway: gateway.gateway,
      ledger,
      index,
      now: () => Date.parse("2026-10-28T00:00:00.000Z")
    });

    expect(queries).toEqual(["Uthiramerur, Tamil Nadu"]);
    expect(result.observations).toBe(1);
    expect(result.scope).toBe("location-query (radius not verified)");
    expect(result.message).toContain("Alpha");
  });

  it("returns an honest zero-place result when Qloo fails, without inventing coverage", async () => {
    const ledger = createLedger();
    const index = createObservationIndex();
    const gateway = fakeGateway({ onCall: () => Promise.reject(outageError()) });

    const result = await runSiteScan({
      brief: BRIEF,
      gateway: gateway.gateway,
      ledger,
      index,
      now: () => Date.parse("2026-10-28T00:00:00.000Z")
    });

    expect(result.observations).toBe(0);
    expect(result.placeCount).toBe(0);
    expect(result.evidence).toEqual([]);
    expect(result.scope).toBe("unscanned");
    expect(result.message).toContain("did not return usable places");
    expect(result.message).toContain("Do not invent local coverage");
    expect(index.observedEntities()).toEqual([]);
  });
});
