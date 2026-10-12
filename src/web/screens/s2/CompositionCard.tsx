import type { S2CardModel, S2MemberModel, S2PriorCardModel } from "./s2Model.js";
import { BreakMark, MemberRow } from "./Marks.js";

export interface CompositionCardProps {
  card: S2CardModel;
  letter: string;
  selected: boolean;
  onSelect: (key: string) => void;
  onEdgeClick?: (a: string, b: string) => void;
}

export function CompositionCard({ card, letter, selected, onSelect, onEdgeClick }: CompositionCardProps) {
  const weakest = card.readings.weakestLink;
  const handleWeakestClick = (): void => {
    if (weakest === null || onEdgeClick === undefined) {
      return;
    }
    onEdgeClick(weakest.a, weakest.b);
  };
  return (
    <article
      className={selected ? "s2-card is-selected" : "s2-card"}
      data-card-key={card.key}
      aria-label={`Composition ${letter}, grade ${card.grade}`}
    >
      <header className="s2-card-header">
        <button
          type="button"
          className="s2-card-select"
          aria-pressed={selected}
          onClick={() => onSelect(card.key)}
        >
          <span className="s2-card-letter zq-nums" aria-hidden="true">
            {letter}
          </span>
          <span className="s2-card-grade zq-nums" aria-label={`Evidence grade ${card.grade}`}>
            {card.grade}
          </span>
          <span className="s2-card-title">Composition {letter}</span>
        </button>
      </header>
      <ul className="s2-members">
        {card.roleGroups.map((group) => (
          <MemberRows key={group.role} role={group.role} members={group.members} />
        ))}
      </ul>
      <p className="s2-member-legend">■ over-indexes locally · □ does not · ⬚ not measured</p>
      <dl className="s2-readings">
        <div>
          <dt>Coherence</dt>
          <dd className="zq-nums">{card.readings.percentile.sentence}</dd>
        </div>
        <div>
          <dt>Distinctiveness</dt>
          <dd className="zq-nums">{card.readings.distinctiveness.sentence}</dd>
        </div>
        <div>
          <dt>Weakest link</dt>
          <dd>
            {weakest === null ? (
              "Weakest link not measured."
            ) : onEdgeClick === undefined ? (
              <span className="s2-weakest">
                <BreakMark />
                <span className="zq-nums">{weakest.sentence}</span>
              </span>
            ) : (
              <button type="button" className="s2-edge-button" onClick={handleWeakestClick}>
                <BreakMark />
                <span className="zq-nums">{weakest.sentence}</span>
              </button>
            )}
          </dd>
        </div>
      </dl>
      {card.gradeReasons.length > 0 && (
        <ul className="s2-grade-reasons">
          {card.gradeReasons.slice(0, 6).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function MemberRows({ role, members }: { role: string; members: readonly S2MemberModel[] }) {
  return (
    <>
      {members.map((member, index) => (
        <MemberRow key={member.id} member={member} role={role} showRole={index === 0} />
      ))}
    </>
  );
}

export interface PriorCompositionCardProps {
  prior: S2PriorCardModel;
}

export function PriorCompositionCard({ prior }: PriorCompositionCardProps) {
  return (
    <article className="s2-card is-prior" aria-label="Prior composition, before looking">
      <header className="s2-card-header">
        <span className="s2-prior-lock" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" focusable="false">
            <rect x="2.5" y="6" width="9" height="6.5" fill="none" strokeWidth="1.5" />
            <path d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0 V6" fill="none" strokeWidth="1.5" />
          </svg>
        </span>
        <span className="s2-card-title">Before looking</span>
      </header>
      {prior.state === "not measured" ? (
        <p className="s2-prior-reason">{prior.reason}</p>
      ) : (
        <>
          <ul className="s2-members">
            {prior.members.map((member, index) => (
              <MemberRow key={member.id} member={member} role={member.role ?? "Unassigned"} showRole={index === 0 || prior.members[index - 1]?.role !== member.role} />
            ))}
          </ul>
          <p className="s2-member-legend">■ over-indexes locally · □ does not · ⬚ not measured</p>
          <dl className="s2-readings">
            <div>
              <dt>Coherence</dt>
              <dd className="zq-nums">{prior.reading}</dd>
            </div>
            {prior.distinctiveness !== null && (
              <div>
                <dt>Distinctiveness</dt>
                <dd className="zq-nums">{prior.distinctiveness.sentence}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      <p className="s2-prior-footer">No cultural data used at lock time.</p>
    </article>
  );
}
