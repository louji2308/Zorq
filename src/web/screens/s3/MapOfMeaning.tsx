import { useMemo } from "react";
import type { S3NodeModel, S3PairModel } from "./s3Model.js";

export interface MapOfMeaningProps {
  nodes: readonly S3NodeModel[];
  edges: readonly S3PairModel[];
  pulse: boolean;
  selectedPairKey: string | null;
  onSelectPair: (key: string) => void;
  onSelectNode: (id: string) => void;
}

interface LineHit {
  key: string;
  left: number;
  top: number;
  width: number;
  angle: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MapOfMeaning({
  nodes,
  edges,
  pulse,
  selectedPairKey,
  onSelectPair,
  onSelectNode
}: MapOfMeaningProps) {
  const positionById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const lineHits = useMemo<LineHit[]>(() => {
    return edges.map((edge) => {
      const a = positionById.get(edge.a);
      const b = positionById.get(edge.b);
      const x1 = (a?.x ?? 0.5) * 100;
      const y1 = (a?.y ?? 0.5) * 100;
      const x2 = (b?.x ?? 0.5) * 100;
      const y2 = (b?.y ?? 0.5) * 100;
      return {
        key: edge.key,
        left: (x1 + x2) / 2,
        top: (y1 + y2) / 2,
        width: Math.hypot(x2 - x1, y2 - y1),
        angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
      };
    });
  }, [edges, positionById]);

  const pulseActive = pulse && !prefersReducedMotion();

  return (
    <div className="s3-map">
      <svg className="s3-map-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {edges.map((edge) => {
          const a = positionById.get(edge.a);
          const b = positionById.get(edge.b);
          if (a === undefined || b === undefined) {
            return null;
          }
          const x1 = a.x * 100;
          const y1 = a.y * 100;
          const x2 = b.x * 100;
          const y2 = b.y * 100;
          const selected = selectedPairKey === edge.key;
          return (
            <g key={edge.key}>
              {selected && (
                <line
                  className={`s3-line s3-line-halo s3-line-${edge.style.widthClass}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                />
              )}
              <line
                className={[
                  "s3-line",
                  `s3-line-${edge.style.widthClass}`,
                  `s3-tone-${edge.style.tone}`,
                  selected ? "s3-line-selected" : "",
                  pulseActive && edge.isWeakest ? "s3-pulse" : ""
                ]
                  .filter((name) => name !== "")
                  .join(" ")}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeDasharray={edge.style.dash ?? undefined}
              />
              {edge.isWeakest && (
                <path
                  className="s3-break"
                  d="M-5 0 L-1.5 0 L0 -2.6 L1.5 2.6 L3 0 L5 0"
                  transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI})`}
                />
              )}
            </g>
          );
        })}
        {nodes.map((node) => {
          const size = node.member ? 4 : 2;
          return (
            <g key={node.id}>
              {node.member ? (
                <rect
                  className="s3-node-member"
                  x={node.x * 100 - size / 2}
                  y={node.y * 100 - size / 2}
                  width={size}
                  height={size}
                />
              ) : (
                <rect
                  className="s3-node-other"
                  x={node.x * 100 - size / 2}
                  y={node.y * 100 - size / 2}
                  width={size}
                  height={size}
                />
              )}
              <text
                className={node.member ? "s3-node-label" : "s3-node-label s3-node-label-dim"}
                x={node.x * 100}
                y={node.y * 100 + (node.member ? 5.5 : 4)}
                textAnchor="middle"
              >
                {node.letter !== null ? `${node.letter} ${node.name}` : node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="s3-hits">
        {lineHits.map((hit) => (
          <button
            key={hit.key}
            type="button"
            className={`s3-hit s3-hit-line${selectedPairKey === hit.key ? " s3-hit-active" : ""}`}
            style={{
              left: `${hit.left}%`,
              top: `${hit.top}%`,
              width: `max(44px, ${hit.width}%)`,
              transform: `translate(-50%, -50%) rotate(${hit.angle}deg)`
            }}
            title={(() => {
              const pair = edges.find((edge) => edge.key === hit.key);
              if (pair === undefined) {
                return "Pair";
              }
              const a = positionById.get(pair.a);
              const b = positionById.get(pair.b);
              return `${a?.name ?? pair.a} and ${b?.name ?? pair.b}`;
            })()}
            aria-label={(() => {
              const pair = edges.find((edge) => edge.key === hit.key);
              if (pair === undefined) {
                return "Pair";
              }
              const a = positionById.get(pair.a);
              const b = positionById.get(pair.b);
              return `Pair ${a?.name ?? pair.a} and ${b?.name ?? pair.b}, ${pair.displayState}`;
            })()}
            onClick={() => onSelectPair(hit.key)}
          />
        ))}
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className="s3-hit s3-hit-node"
            style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }}
            title={node.name}
            aria-label={`Component ${node.name}${node.letter !== null ? `, composition ${node.letter}` : ""}`}
            onClick={() => onSelectNode(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
