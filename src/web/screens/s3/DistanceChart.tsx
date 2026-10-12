import { useMemo } from "react";
import type { S3ChartCell, S3NodeModel, S3PairModel } from "./s3Model.js";

export interface DistanceChartProps {
  nodes: readonly S3NodeModel[];
  cells: readonly S3ChartCell[];
  pairs: readonly S3PairModel[];
  selectedPairKey: string | null;
  onSelectPair: (key: string) => void;
}

const VIEW_W = 830;
const VIEW_H = 760;
const GRID_X = 150;
const GRID_Y = 20;
const GRID = 660;

const DOT_RADIUS: Record<string, number> = {
  confirmed: 22,
  strong: 22,
  typical: 14,
  measured: 14,
  contested: 14,
  weak: 8,
  thin: 8,
  failed: 14
};

function isHollow(state: string): boolean {
  return state === "thin" || state === "contested" || state === "failed";
}

export function DistanceChart({
  nodes,
  cells,
  pairs,
  selectedPairKey,
  onSelectPair
}: DistanceChartProps) {
  const count = nodes.length;
  const cellSize = count > 0 ? GRID / count : GRID;

  const nameById = useMemo(() => new Map(nodes.map((node) => [node.id, node.name])), [nodes]);

  return (
    <div className="s3-chart">
      <svg
        className="s3-chart-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern id="s3-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="none" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--zq-ink)" strokeWidth="1" />
          </pattern>
        </defs>
        {cells.map((cell) => {
          const cx = GRID_X + (cell.col + 0.5) * cellSize;
          const cy = GRID_Y + (cell.row + 0.5) * cellSize;
          const selected = selectedPairKey === cell.pairKey;
          const radius = DOT_RADIUS[cell.displayState] ?? 14;
          return (
            <g key={cell.pairKey}>
              <rect
                className={[
                  "s3-cell",
                  cell.inComposition ? "s3-cell-in" : "",
                  selected ? "s3-cell-selected" : ""
                ]
                  .filter((name) => name !== "")
                  .join(" ")}
                x={GRID_X + cell.col * cellSize}
                y={GRID_Y + cell.row * cellSize}
                width={cellSize}
                height={cellSize}
              />
              {cell.displayState === "unmeasured" ? (
                <rect
                  className="s3-cell-hatch"
                  x={GRID_X + cell.col * cellSize + 4}
                  y={GRID_Y + cell.row * cellSize + 4}
                  width={cellSize - 8}
                  height={cellSize - 8}
                />
              ) : (
                <circle
                  className={[
                    "s3-dot",
                    isHollow(cell.displayState) ? "s3-dot-hollow" : "s3-dot-solid",
                    `s3-tone-${cell.style.tone}`
                  ]
                    .filter((name) => name !== "")
                    .join(" ")}
                  cx={cx}
                  cy={cy}
                  r={radius}
                />
              )}
              {cell.isWeakest && (
                <path
                  className="s3-break"
                  d="M-7 0 L-2 0 L0 -3.6 L2 3.6 L4 0 L7 0"
                  transform={`translate(${cx} ${cy})`}
                />
              )}
            </g>
          );
        })}
        {nodes.map((node, index) => {
          const cx = GRID_X + (index + 0.5) * cellSize;
          const cy = GRID_Y + (index + 0.5) * cellSize;
          return (
            <text
              key={node.id}
              className="s3-diagonal"
              x={cx}
              y={cy}
              transform={`rotate(-45 ${cx} ${cy})`}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {node.letter !== null ? `${node.letter} ${node.name}` : node.name}
            </text>
          );
        })}
      </svg>
      <p className="s3-list-heading" id="s3-pairs-heading">
        Every pair, closest first
      </p>
      <ul className="s3-pair-list" aria-labelledby="s3-pairs-heading">
        {pairs.map((pair) => (
          <li key={pair.key}>
            <button
              type="button"
              className={`s3-pair-button${selectedPairKey === pair.key ? " s3-pair-active" : ""}`}
              onClick={() => onSelectPair(pair.key)}
            >
              <span className="s3-pair-names">
                {nameById.get(pair.a) ?? pair.a} ↔ {nameById.get(pair.b) ?? pair.b}
              </span>
              <span className={`s3-chip s3-chip-${pair.displayState}`}>{pair.displayState}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
