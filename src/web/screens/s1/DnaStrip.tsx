/*
 * S1 Cultural DNA strip (Final Design §7.1 "The DNA strip"): three
 * side-by-side groups (Artists, Films, Brands) with dumbbell dot plots —
 * solid dot = local affinity, hollow dot = city — on a shared 0..1 track;
 * the gap IS distinctiveness. 220 px high, collapsible. Entities render
 * only from real DNA data (parseCulturalDna); otherwise an honest empty
 * state. Full Evidence drawer is Phase 7 — rows do not open it yet.
 */
import { describeDnaEmpty, type DnaGroup } from "./s1Model.js";

export interface DnaStripProps {
  groups: readonly DnaGroup[];
  /** Current run status, so an empty strip never implies work is ongoing. */
  status: string;
  collapsed: boolean;
  onToggle: () => void;
}

const TRACK_WIDTH = 120;

function Dumbbell({ local, city }: { local: number; city: number }) {
  const localX = Math.min(Math.max(local, 0), 1) * TRACK_WIDTH;
  const cityX = Math.min(Math.max(city, 0), 1) * TRACK_WIDTH;
  return (
    <svg
      className="s1-dumbbell"
      width={TRACK_WIDTH + 16}
      height="16"
      viewBox={`0 0 ${TRACK_WIDTH + 16} 16`}
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1={8 + Math.min(localX, cityX)}
        y1="8"
        x2={8 + Math.max(localX, cityX)}
        y2="8"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx={8 + cityX} cy="8" r="4" fill="var(--zq-paper)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={8 + localX} cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

function percent(value: number): string {
  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}`;
}

function Group({ group }: { group: DnaGroup }) {
  return (
    <section className="s1-dna-group" aria-label={group.domain}>
      <h3 className="s1-dna-domain">{group.domain}</h3>
      <ul className="s1-dna-list">
        {group.entities.map((entity) => (
          <li key={entity.name} className="s1-dna-entity">
            <span className="s1-dna-name">{entity.name}</span>
            <Dumbbell local={entity.local} city={entity.city} />
            <span className="s1-dna-nums zq-nums">
              {percent(entity.local)} / {percent(entity.city)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DnaStrip({ groups, status, collapsed, onToggle }: DnaStripProps) {
  return (
    <section className={collapsed ? "s1-dna is-collapsed" : "s1-dna"} aria-label="Cultural DNA">
      <header className="s1-dna-header">
        <h2 className="s1-dna-title">Cultural DNA</h2>
        <span className="s1-dna-legend" aria-hidden="true">
          ● local&nbsp;&nbsp;○ city
        </span>
        <button type="button" className="s1-tertiary" aria-expanded={!collapsed} onClick={onToggle}>
          {collapsed ? "Show DNA" : "Collapse"}
        </button>
      </header>
      {!collapsed && (
        <div className="s1-dna-body">
          {groups.length === 0 ? (
            <p className="s1-dna-empty">{describeDnaEmpty(status)}</p>
          ) : (
            <div className="s1-dna-groups">
              {groups.map((group) => (
                <Group key={group.domain} group={group} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
