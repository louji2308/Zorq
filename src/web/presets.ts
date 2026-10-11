/*
 * S0 preset sites (Final Design §7.0 "Preset selection"; Product Spec §7 S0).
 *
 * A preset seeds a Brief only. It never injects evidence, scores or a Prior —
 * POST /api/runs builds the frozen Prior server-side (Prior-before-Qloo,
 * ARCH §16), and no preset value reaches the ledger or measurement kernels.
 *
 * PROVISIONAL SELECTION (documented deviation): the spec wants these picked by
 * the Day-1 spike (Product Spec §18 Spike 5 / Final Design §7.0) — two sites
 * where Qloo diverges most from the Prior, one honest control. That spike has
 * not run, so these three are provisional stand-ins chosen to exercise the same
 * shape (a broadly checkable city site, a venue-led entertainment district, and
 * a well-covered mainstream food hall). They are NOT labelled by role on S0 —
 * the Blueprint reveals the control case itself (Final Design §7.0).
 *
 * Coordinates are real: MapTiler forward geocoding results captured 2026-10-10
 * (`/geocoding/{query}.json`), not invented numbers. Areas and objectives are
 * plausible brief inputs written by us; they are user intent, not measurements.
 */
import type { Brief } from "../shared/brief.js";

export interface PresetSite {
  /** Stable id stored as Brief.presetId (briefSchema.presetId). */
  readonly id: string;
  /** Card headline, e.g. "Crosby Street, SoHo". */
  readonly name: string;
  /** Brief.location — the canonical address string the site was geocoded from. */
  readonly location: string;
  readonly areaSqFt: number;
  /** One-line goal shown on the card; also Brief.objective (<= 200 chars). */
  readonly objective: string;
  readonly coordinates: { readonly lat: number; readonly lon: number };
  /** Search radius in metres; drives the dashed/chain ring on the S0/S1 map. */
  readonly radiusM: number;
}

/** Default S0 search radius (metres) — matches the design's "400 m" reference scale. */
export const PRESET_RADIUS_M = 400;

export const PRESETS: readonly PresetSite[] = [
  {
    id: "preset-soho-crosby",
    name: "Crosby Street, SoHo",
    location: "Crosby Street, Manhattan, New York 10012, United States",
    areaSqFt: 28_000,
    objective: "A ground-floor place where downtown locals and visitors both feel they belong.",
    coordinates: { lat: 40.72466201611901, lon: -73.9963011816144 },
    radiusM: PRESET_RADIUS_M
  },
  {
    id: "preset-lower-broadway",
    name: "Lower Broadway, Nashville",
    location: "Broadway, Nashville, Tennessee 37203, United States",
    areaSqFt: 42_000,
    objective: "A live-music block that stays busy between headline shows.",
    coordinates: { lat: 36.15660997174945, lon: -86.78749613463879 },
    radiusM: PRESET_RADIUS_M
  },
  {
    id: "preset-reading-terminal",
    name: "Reading Terminal Market",
    location:
      "Reading Terminal Market, 1136 Arch Street, Philadelphia, Pennsylvania 19107, United States",
    areaSqFt: 31_000,
    objective: "Keep the market's regulars while pulling a younger weekday crowd.",
    coordinates: { lat: 39.953707, lon: -75.159092 },
    radiusM: PRESET_RADIUS_M
  }
] as const;

/** Card display for an area, e.g. 28000 -> "28,000 sq ft". */
export function presetAreaLabel(preset: PresetSite): string {
  return `${preset.areaSqFt.toLocaleString("en-US")} sq ft`;
}

/** Build the complete Brief a preset card submits (includes presetId). */
export function briefFromPreset(preset: PresetSite): Brief {
  return {
    location: preset.location,
    coordinates: { lat: preset.coordinates.lat, lon: preset.coordinates.lon },
    radius: preset.radiusM,
    areaSqFt: preset.areaSqFt,
    objective: preset.objective,
    presetId: preset.id
  };
}

export function getPreset(id: string): PresetSite | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
