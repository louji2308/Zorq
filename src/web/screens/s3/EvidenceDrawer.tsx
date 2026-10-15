import { useState } from "react";
import { NodeSheet } from "./NodeSheet.js";
import { VISIBLE_TILES, type S3NodeSheet, type S3PairEvidence } from "./s3Model.js";

export interface EvidenceDrawerProps {
  evidence: S3PairEvidence | null;
  sheet: S3NodeSheet | null;
  hasSelection: boolean;
  onOpenLedger?: (evidenceId: string) => void;
  onReplace?: (memberId: string) => void;
  onClose: () => void;
}

function TriangulationShape({ shape }: { shape: "solid" | "half" | "hollow" | null }) {
  if (shape === null) {
    return null;
  }
  if (shape === "solid") {
    return <span className="s3-tri-shape s3-tri-solid" aria-hidden="true" />;
  }
  if (shape === "half") {
    return <span className="s3-tri-shape s3-tri-half" aria-hidden="true" />;
  }
  return <span className="s3-tri-shape s3-tri-hollow" aria-hidden="true" />;
}

export function EvidenceDrawer({
  evidence,
  sheet,
  hasSelection,
  onOpenLedger,
  onReplace,
  onClose
}: EvidenceDrawerProps) {
  const [showAll, setShowAll] = useState(false);

  if (sheet !== null) {
    return (
      <aside className="s3-drawer" aria-label="Component sheet">
        <button type="button" className="s1-tertiary s3-drawer-close" onClick={onClose}>
          Close
        </button>
        <NodeSheet sheet={sheet} onReplace={onReplace} />
      </aside>
    );
  }

  if (evidence === null) {
    return (
      <aside className="s3-drawer" aria-label="Evidence">
        <p className="s3-drawer-empty" role="status">
          {hasSelection
            ? "No evidence is recorded for this selection."
            : "Choose a line to see the culture its two audiences share."}
        </p>
      </aside>
    );
  }

  const visible = showAll ? evidence.tiles : evidence.tiles.slice(0, VISIBLE_TILES);
  const hiddenCount = evidence.tiles.length - VISIBLE_TILES;

  return (
    <aside className="s3-drawer" aria-label="Evidence">
      <button type="button" className="s1-tertiary s3-drawer-close" onClick={onClose}>
        Close
      </button>
      {evidence.emptyReason !== null ? (
        <p className="s3-drawer-empty" role="status">
          {evidence.emptyReason}
        </p>
      ) : (
        <>
          {evidence.claim !== null && <p className="s3-claim">{evidence.claim}</p>}
          {evidence.provenance !== null && (
            <span className="s3-provenance">{evidence.provenance}</span>
          )}
          <p className="s3-drawer-heading">Shared by both audiences</p>
          {evidence.tiles.length === 0 ? (
            <p className="s3-drawer-note">No shared entities were measured for this pair.</p>
          ) : (
            <>
              <ul className="s3-tiles">
                {visible.map((tile) => (
                  <li key={tile.entityId} className="s3-tile">
                    <span className="s3-tile-name">{tile.name}</span>
                    <span className="s3-tile-meta">
                      <span className="s3-tile-domain">{tile.domain}</span>
                      <span className="s3-tile-rank">#{tile.rank}</span>
                    </span>
                    <span
                      className="s3-tile-bar"
                      style={{ width: `${Math.max(4, Math.round(tile.fraction * 100))}%` }}
                    />
                  </li>
                ))}
              </ul>
              {!showAll && hiddenCount > 0 && (
                <button type="button" className="s1-tertiary" onClick={() => setShowAll(true)}>
                  Show all {evidence.tiles.length}
                </button>
              )}
            </>
          )}
          <div className="s3-tri-line">
            <TriangulationShape shape={evidence.triangulation.shape} />
            <p className="s3-tri-sentence">{evidence.triangulation.sentence}</p>
          </div>
          <p className="s3-how">
            <span className="s3-how-label">How this was computed: </span>
            {evidence.howComputed}
          </p>
          {evidence.links.length > 0 && onOpenLedger !== undefined ? (
            <>
              <p className="s3-drawer-heading">See the lookups</p>
              <ul className="s3-links">
                {evidence.links.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      className="s1-tertiary s3-link"
                      onClick={() => onOpenLedger(link.id)}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="s3-drawer-note">
              Lookups for this pair are recorded in the full ledger.
            </p>
          )}
        </>
      )}
    </aside>
  );
}
