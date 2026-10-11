/*
 * S0 preset card — the one-click judge path (Final Design §7.0: presets are
 * the primary action, above the custom form). Hover or focus flies the map to
 * the site and draws the radius ring; activation submits the preset Brief.
 */
import type { PresetSite } from "../../presets.js";
import { presetAreaLabel } from "../../presets.js";

export interface PresetCardProps {
  preset: PresetSite;
  busy: boolean;
  onFocusSite: (preset: PresetSite) => void;
  onLeaveSite: () => void;
  onActivate: (preset: PresetSite) => void;
}

export function PresetCard({ preset, busy, onFocusSite, onLeaveSite, onActivate }: PresetCardProps) {
  return (
    <button
      type="button"
      className="s0-preset"
      disabled={busy}
      onMouseEnter={() => onFocusSite(preset)}
      onMouseLeave={onLeaveSite}
      onFocus={() => onFocusSite(preset)}
      onBlur={onLeaveSite}
      onClick={() => onActivate(preset)}
    >
      <span className="s0-preset-name">{preset.name}</span>
      <span className="s0-preset-area zq-nums">{presetAreaLabel(preset)}</span>
      <span className="s0-preset-goal">{preset.objective}</span>
    </button>
  );
}
