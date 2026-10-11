/*
 * S0 — the three preset sites seed a Brief and nothing else.
 *
 * A preset is user intent (location, area, goal) plus a presetId. It must never
 * carry evidence, scores or a Prior: POST /api/runs builds the frozen Prior
 * server-side before any Qloo call (Prior-before-Qloo, ARCH 16).
 */
import { describe, expect, it } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import {
  PRESETS,
  PRESET_RADIUS_M,
  briefFromPreset,
  getPreset,
  presetAreaLabel
} from "../../src/web/presets.js";

describe("S0 preset sites", () => {
  it("offers three presets with stable unique ids", () => {
    expect(PRESETS).toHaveLength(3);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(3);
  });

  it("builds a Brief that satisfies the shared briefSchema for every preset", () => {
    for (const preset of PRESETS) {
      const brief = briefFromPreset(preset);

      expect(() => briefSchema.parse(brief)).not.toThrow();
      expect(brief.location.trim().length).toBeGreaterThan(0);
      expect(brief.objective.length).toBeGreaterThan(0);
      expect(brief.objective.length).toBeLessThanOrEqual(200);
      expect(brief.areaSqFt).toBeGreaterThan(0);
      expect(brief.presetId).toBe(preset.id);
      expect(brief.radius).toBe(PRESET_RADIUS_M);
      expect(brief.coordinates?.lat).toBeCloseTo(preset.coordinates.lat, 6);
      expect(brief.coordinates?.lon).toBeCloseTo(preset.coordinates.lon, 6);
    }
  });

  it("keeps preset coordinates inside real WGS84 bounds", () => {
    for (const preset of PRESETS) {
      expect(preset.coordinates.lat).toBeGreaterThanOrEqual(-90);
      expect(preset.coordinates.lat).toBeLessThanOrEqual(90);
      expect(preset.coordinates.lon).toBeGreaterThanOrEqual(-180);
      expect(preset.coordinates.lon).toBeLessThanOrEqual(180);
      expect(Number.isFinite(preset.coordinates.lat)).toBe(true);
      expect(Number.isFinite(preset.coordinates.lon)).toBe(true);
      expect(preset.radiusM).toBeGreaterThan(0);
    }
  });

  it("seeds only brief fields — no evidence, score, prior or ledger keys", () => {
    const preset = PRESETS[0];
    const brief = briefFromPreset(preset);

    expect(Object.keys(brief).sort()).toEqual([
      "areaSqFt",
      "coordinates",
      "location",
      "objective",
      "presetId",
      "radius"
    ]);
  });

  it("resolves a preset by id and formats its area label", () => {
    const preset = PRESETS[0];
    expect(getPreset(preset.id)).toBe(preset);
    expect(getPreset("preset-does-not-exist")).toBeUndefined();
    expect(presetAreaLabel(preset)).toBe(`${preset.areaSqFt.toLocaleString("en-US")} sq ft`);
  });
});
