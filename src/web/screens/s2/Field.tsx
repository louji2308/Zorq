import type { S2FieldModel, S2FieldMark } from "./s2Model.js";

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 150;
const PLOT_LEFT = 36;
const PLOT_RIGHT = 12;
const PLOT_WIDTH = VIEW_WIDTH - PLOT_LEFT - PLOT_RIGHT;
const BASELINE_Y = 100;
const BAR_MAX_HEIGHT = 64;
const MARK_TOP = 16;

export interface FieldProps {
  field: S2FieldModel;
  selectedKey: string | null;
}

function markX(mark: S2FieldMark): number {
  return PLOT_LEFT + mark.position * PLOT_WIDTH;
}

export function Field({ field, selectedKey }: FieldProps) {
  const barSlot = field.binCount > 0 ? PLOT_WIDTH / field.binCount : PLOT_WIDTH;
  const barWidth = Math.max(2, barSlot - 4);
  return (
    <figure className="s2-field">
      <figcaption className="s2-field-caption">
        <span className="s2-field-title">The field</span>
        <span className="s2-field-sub">all {field.totalValid} valid combinations from this pool, by coherence</span>
      </figcaption>
      <svg
        className="s2-field-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={field.summary}
        preserveAspectRatio="xMidYMid meet"
      >
        {field.bins.map((bin, index) => {
          const height = bin.fraction * BAR_MAX_HEIGHT;
          const x = PLOT_LEFT + index * barSlot + 2;
          return (
            <rect
              key={`${bin.start}-${index}`}
              className="s2-field-bar"
              x={x}
              y={BASELINE_Y - height}
              width={barWidth}
              height={Math.max(bin.count > 0 ? 1 : 0, height)}
            />
          );
        })}
        <line className="s2-field-axis" x1={PLOT_LEFT} y1={BASELINE_Y} x2={PLOT_LEFT + PLOT_WIDTH} y2={BASELINE_Y} />
        {field.ticks.map((tick) => {
          const x = PLOT_LEFT + tick.position * PLOT_WIDTH;
          return (
            <g key={tick.label}>
              <line className="s2-field-tick" x1={x} y1={BASELINE_Y} x2={x} y2={BASELINE_Y + 6} />
              <text className="s2-field-tick-label zq-nums" x={x} y={BASELINE_Y + 18} textAnchor="middle">
                {tick.label}
              </text>
            </g>
          );
        })}
        {field.marks.map((mark) => {
          const x = markX(mark);
          const emphasized = selectedKey !== null && mark.key === selectedKey;
          return (
            <g key={mark.key}>
              <line
                className={
                  mark.dashed
                    ? "s2-field-mark is-prior"
                    : emphasized
                      ? "s2-field-mark is-selected"
                      : "s2-field-mark"
                }
                x1={x}
                y1={MARK_TOP}
                x2={x}
                y2={BASELINE_Y}
              />
              <text className="s2-field-mark-label zq-nums" x={x} y={MARK_TOP - 4} textAnchor="middle">
                {mark.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="s2-field-summary">{field.summary}</p>
    </figure>
  );
}
