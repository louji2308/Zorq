import { describe, expect, it } from "vitest";
import {
  FORMAT_LIBRARY_HEURISTIC,
  FORMAT_TYPES,
  formatLibrarySize,
  resolveFormatType
} from "../../src/server/engine/formats.js";
import { fitConstraints, parseFitConstraints } from "../../src/server/engine/fit.js";

const role = "Social" as const;

describe("format library", () => {
  it("carries the heuristic marker and at least 25 types", () => {
    expect(FORMAT_LIBRARY_HEURISTIC).toBe("[Zorq heuristic]");
    expect(FORMAT_TYPES.length).toBeGreaterThanOrEqual(25);
    expect(formatLibrarySize()).toBeGreaterThanOrEqual(50);
  });

  it("gives every type 2-3 formats with finite non-negative footprints", () => {
    for (const type of FORMAT_TYPES) {
      expect(type.formats.length).toBeGreaterThanOrEqual(2);
      expect(type.formats.length).toBeLessThanOrEqual(3);
      for (const format of type.formats) {
        expect(format.footprintSqFtMin).toBeGreaterThan(0);
        expect(format.footprintSqFtMax).toBeGreaterThanOrEqual(format.footprintSqFtMin);
      }
    }
  });

  it("resolves a tag match by longest keyword", () => {
    const match = resolveFormatType({
      id: "comp-blue-note",
      role,
      tags: ["jazz club"],
      exemplarNames: ["Blue Note Corner"]
    });
    expect(match.type.typeKey).toBe("music-venue");
    expect(match.mapped).toBe(true);
  });

  it("falls back to the role default when nothing matches", () => {
    const match = resolveFormatType({ id: "comp-mystery", role: "Night", tags: ["zzz-unmapped"] });
    expect(match.mapped).toBe(false);
    expect(match.type.typeKey).toBe("unmapped-night");
  });

  it("resolves the cinema micro-screening downshift chain by keyword", () => {
    const match = resolveFormatType({ id: "comp-nitehawk", role: "Discovery", tags: ["film"] });
    expect(match.type.typeKey).toBe("cinema");
    expect(match.type.formats[0]!.name).toBe("Cinema");
    expect(match.type.formats[1]!.name).toBe("Micro-screening");
  });
});

describe("parseFitConstraints", () => {
  it("reads late-night, quiet, and nightclub chips", () => {
    const parsed = parseFitConstraints([
      "no large nightclub",
      "active after 10 PM restricted",
      "keep it quiet",
      "unmapped chip stays raw"
    ]);
    expect(parsed.lateNightRestricted).toBe(true);
    expect(parsed.quietPreferred).toBe(true);
    expect(parsed.noLargeNightclub).toBe(true);
    expect(parsed.reads.map((read) => read.key)).toEqual([
      "noLargeNightclub",
      "lateNight",
      "quiet",
      "raw"
    ]);
  });
});

describe("fitConstraints", () => {
  it("fits a small site by downshifting the cinema, preserving its role", () => {
    const result = fitConstraints(
      { areaSqFt: 3000, constraints: [] },
      [
        { id: "comp-nitehawk", name: "Nitehawk Cinema", role: "Discovery", tags: ["film"] },
        { id: "comp-devocion", name: "Devoción", role: "Anchor", tags: ["coffee"] },
        { id: "comp-clay", name: "Clay Collective", role: "Social", tags: ["gallery"] }
      ]
    );
    expect(result.heuristic).toBe("[Zorq heuristic]");
    expect(result.usableSqFt).toBe(2550);
    expect(result.feasible).toBe(true);
    const cinema = result.choices.find((choice) => choice.memberId === "comp-nitehawk");
    expect(cinema?.downshiftedFrom).toBe("Cinema");
    expect(["Micro-screening", "Screening series"]).toContain(cinema?.formatName);
    expect(result.downshifts[0]?.sentence).toBe(
      "Cinema becomes micro-screening. Role preserved: Discovery."
    );
    expect(result.totalFootprintSqFt).toBeLessThanOrEqual(2550);
  });

  it("drops a loud nightclub under a late-night constraint before touching anchors", () => {
    const result = fitConstraints(
      { areaSqFt: 6000, constraints: ["active after 10 PM restricted"] },
      [
        { id: "comp-club", name: "Voltage", role: "Night", tags: ["nightclub"] },
        { id: "comp-devocion", name: "Devoción", role: "Anchor", tags: ["coffee"] },
        { id: "comp-clay", name: "Clay Collective", role: "Discovery", tags: ["gallery"] }
      ]
    );
    expect(result.drops.some((drop) => drop.memberId === "comp-club")).toBe(true);
    expect(result.choices.some((choice) => choice.memberId === "comp-devocion")).toBe(true);
  });

  it("downshifts loud formats when quiet is preferred", () => {
    const result = fitConstraints(
      { areaSqFt: 8000, constraints: ["quiet preferred"] },
      [
        { id: "comp-venue", name: "Blue Note", role: "Anchor", tags: ["jazz"] },
        { id: "comp-cafe", name: "Corner Cafe", role: "Social", tags: ["coffee"] }
      ]
    );
    const venue = result.choices.find((choice) => choice.memberId === "comp-venue");
    expect(venue?.noiseClass).not.toBe("loud");
    expect(venue?.downshiftedFrom).toBe("Music venue");
  });

  it("marks infeasible honestly when only anchors remain over the usable area", () => {
    const result = fitConstraints(
      { areaSqFt: 1000, constraints: [] },
      [
        { id: "comp-a", name: "Big Anchor A", role: "Anchor", tags: ["museum"] },
        { id: "comp-b", name: "Big Anchor B", role: "Anchor", tags: ["library"] }
      ]
    );
    expect(result.feasible).toBe(false);
    expect(result.reasons.join(" ")).toContain("exceeds");
    expect(result.choices.length).toBe(2);
  });

  it("measures constraint fit without a footprint when area is absent", () => {
    const result = fitConstraints({ constraints: [] }, [
      { id: "comp-cafe", name: "Corner Cafe", role: "Social", tags: ["coffee"] }
    ]);
    expect(result.areaSqFt).toBeNull();
    expect(result.usableSqFt).toBeNull();
    expect(result.totalFootprintSqFt).toBeNull();
    expect(result.feasible).toBe(true);
    expect(result.reasons.join(" ")).toContain("not measured");
  });

  it("is deterministic for identical inputs", () => {
    const brief = { areaSqFt: 3000, constraints: ["no large nightclub", "active after 10 PM restricted"] };
    const members = [
      { id: "comp-club", name: "Voltage", role: "Night" as const, tags: ["nightclub"] },
      { id: "comp-devocion", name: "Devoción", role: "Anchor" as const, tags: ["coffee"] },
      { id: "comp-nitehawk", name: "Nitehawk", role: "Discovery" as const, tags: ["film"] },
      { id: "comp-clay", name: "Clay", role: "Social" as const, tags: ["gallery"] }
    ];
    const first = fitConstraints(brief, members);
    const second = fitConstraints(brief, members);
    expect(second).toStrictEqual(first);
  });
});
