/*
 * S1 Agent Ledger (Final Design §7.1 "The Agent Ledger"): the right column.
 * Header "What Zorq is doing" + tertiary "Stop and show best so far" (wired
 * to the real stop route by the route). Rows appear ONLY from real SSE/state
 * data via LedgerRowModel — no artificial delay, no fabricated rows
 * (AGENTS §12). Expansion shows the fields the event schema actually carries
 * (technical call, summary, result count, live-or-cached, duration) with any
 * parameters-shaped data passed through redactSensitive by the model.
 * Auto-scrolls to the latest row; a "Jump to latest" tertiary appears when
 * the user has scrolled up. Dashed circles mark degraded/rate-limited rows —
 * meaning is carried by shape and words, never colour alone.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LedgerRowModel } from "./s1Model.js";

export interface LedgerPanelProps {
  rows: readonly LedgerRowModel[];
  stopVisible: boolean;
  stopping: boolean;
  onStop: () => void;
  /** Rendered docked at the bottom edge (the single primary action slot). */
  docked?: ReactNode;
}

const STICKY_BOTTOM_PX = 48;

/** The state circle is drawn as SVG — the s1 files avoid the CSS radius
 *  property entirely: solid = normal, dashed outline = degraded. Shape plus
 *  the row's own words carry the meaning, never colour alone. */
function RowCircle({ dashed }: { dashed: boolean }) {
  return (
    <svg
      className={dashed ? "s1-row-circle is-dashed" : "s1-row-circle"}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="7"
        cy="7"
        r="5.25"
        strokeWidth="1.5"
        strokeDasharray={dashed ? "3 2" : undefined}
      />
    </svg>
  );
}

/** The proof-of-integration expansion: exactly the fields the event schema
 *  actually carries (call, summary, result count, live-or-cached, duration)
 *  plus any parameters-shaped data the model already redacted. Nothing here
 *  is derived or invented. */
export function LedgerRowExpansion({ row }: { row: LedgerRowModel }) {
  return (
    <dl className="s1-row-expansion">
      <div>
        <dt>Call</dt>
        <dd className="s1-mono">{row.technicalLabel}</dd>
      </div>
      <div>
        <dt>Result</dt>
        <dd>{row.summary}</dd>
      </div>
      <div>
        <dt>Results</dt>
        <dd className="zq-nums">{row.resultCount}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{row.cacheLabel ?? "Not recorded"}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd className="zq-nums">{row.durationLabel}</dd>
      </div>
      {row.parameters !== null && (
        <div>
          <dt>Parameters (redacted)</dt>
          <dd className="s1-mono">{JSON.stringify(row.parameters)}</dd>
        </div>
      )}
    </dl>
  );
}

function LedgerRowView({ row }: { row: LedgerRowModel }) {
  const [expanded, setExpanded] = useState(false);
  const expansionId = `s1-ledger-expansion-${row.sequence}`;
  return (
    <li className={row.dashed ? "s1-row is-flagged" : "s1-row"}>
      <button
        type="button"
        className="s1-row-button"
        aria-expanded={expanded}
        aria-controls={expansionId}
        onClick={() => setExpanded((current) => !current)}
      >
        <RowCircle dashed={row.dashed} />
        <span className="s1-row-main">
          <span className="s1-row-label">{row.label}</span>
          {row.note !== null && <span className="s1-row-note">{row.note}</span>}
        </span>
        <span className="s1-row-kind">{row.kind}</span>
        <span className="s1-row-duration zq-nums">{row.durationLabel}</span>
      </button>
      {expanded && (
        <div id={expansionId}>
          <LedgerRowExpansion row={row} />
        </div>
      )}
    </li>
  );
}

export function LedgerPanel({ rows, stopVisible, stopping, onStop, docked }: LedgerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const lastSequence = rows.length > 0 ? (rows[rows.length - 1]?.sequence ?? 0) : 0;

  useEffect(() => {
    if (!atBottom) {
      return;
    }
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    scroll.scrollTop = scroll.scrollHeight;
  }, [lastSequence, atBottom]);

  function handleScroll(): void {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    const distance = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
    setAtBottom(distance <= STICKY_BOTTOM_PX);
  }

  function jumpToLatest(): void {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    setAtBottom(true);
    scroll.scrollTop = scroll.scrollHeight;
  }

  return (
    <section className="s1-ledger" aria-label="Agent Ledger">
      <header className="s1-ledger-header">
        <h2 className="s1-ledger-title">What Zorq is doing</h2>
        {stopVisible && (
          <button type="button" className="s1-tertiary" onClick={onStop} disabled={stopping}>
            {stopping ? "Stopping…" : "Stop and show best so far"}
          </button>
        )}
      </header>
      <div className="s1-ledger-scroll" ref={scrollRef} onScroll={handleScroll}>
        {rows.length === 0 ? (
          <p className="s1-ledger-empty">
            Rows appear here as each real call finishes. Nothing has completed yet.
          </p>
        ) : (
          <ul className="s1-ledger-list">
            {rows.map((row) => (
              <LedgerRowView key={row.sequence} row={row} />
            ))}
          </ul>
        )}
        {!atBottom && rows.length > 0 && (
          <button type="button" className="s1-tertiary s1-jump" onClick={jumpToLatest}>
            Jump to latest
          </button>
        )}
      </div>
      {docked !== undefined && <div className="s1-ledger-docked">{docked}</div>}
    </section>
  );
}
