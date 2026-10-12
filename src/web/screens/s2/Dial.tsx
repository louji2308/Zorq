import { DEFAULT_DIAL_WEIGHT } from "./s2Model.js";

export interface DialProps {
  weight: number;
  onChange: (weight: number) => void;
}

function weightLabel(weight: number): string {
  const fixed = weight.toFixed(2);
  if (Math.abs(weight - DEFAULT_DIAL_WEIGHT) < 0.005) {
    return `${fixed}, default`;
  }
  return fixed;
}

export function Dial({ weight, onChange }: DialProps) {
  return (
    <div className="s2-dial">
      <div className="s2-dial-row">
        <label className="s2-dial-end" htmlFor="s2-dial">
          Familiar
        </label>
        <input
          id="s2-dial"
          className="s2-dial-input"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={weight}
          aria-valuetext={weightLabel(weight)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="s2-dial-end">Distinctive</span>
        <output className="s2-dial-value zq-nums" htmlFor="s2-dial" aria-live="polite">
          {weightLabel(weight)}
        </output>
      </div>
      <p className="s2-dial-note">
        Weighs coherence against distinctiveness. The cards re-rank from the stored readings — no new
        measurement happens here.
      </p>
    </div>
  );
}
