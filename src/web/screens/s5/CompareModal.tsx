/*
 * Without-Qloo compare modal (Final Design §7.5; Plan lines 796–805).
 *
 * Left column: the frozen Prior plus the LLM-only polish generated during
 * prior generation — the honest no-cultural-evidence control. Right column:
 * Zorq's final composition from the blueprint. Differences are the SERVER's
 * whatQlooChanged arrays (never re-derived, never manufactured): changed
 * members carry the L4 rule and the inverted "changed" tag. The confident-
 * empty case opens with the exact line and is visually as confident as a
 * success. Closes with Esc or the visible Close button.
 */
import { useEffect, useRef } from "react";
import type { S5CompareModel } from "../s5/s5Model.js";

export interface CompareModalProps {
  compare: S5CompareModel;
  onClose: () => void;
}

export function CompareModal({ compare, onClose }: CompareModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="s5-modal-overlay" role="presentation">
      <div
        className="s5-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="s5-compare-title"
      >
        <header className="s5-modal-header">
          <h2 id="s5-compare-title" className="s5-modal-title">
            Without Qloo
          </h2>
          <button type="button" className="s5-tertiary" onClick={onClose} ref={closeRef}>
            Close
          </button>
        </header>

        {compare.state === "neutral" && (
          <p className="s5-modal-neutral">{compare.neutralLine}</p>
        )}
        {compare.state === "no-prior" && (
          <p className="s5-modal-neutral">
            No comparable Prior members were recorded for this run, so there is nothing to contrast.
          </p>
        )}

        <div className="s5-modal-columns">
          <section className="s5-modal-column" aria-label="With no cultural evidence">
            <h3 className="s5-modal-column-title">
              What the agent would have recommended with no cultural evidence
            </h3>
            {compare.polish === null ? (
              <p className="s5-modal-note">
                No polish paragraph was generated for this run — the frozen Prior is shown alone.
              </p>
            ) : (
              <p className="s5-modal-polish">{compare.polish}</p>
            )}
            {compare.priorMembers.length === 0 ? (
              <p className="s5-modal-note">The frozen Prior records no named members.</p>
            ) : (
              <ul className="s5-modal-list">
                {compare.priorMembers.map((member) => (
                  <li key={`prior:${member.name}`} className="s5-modal-item">
                    {member.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="s5-modal-column" aria-label="Zorq's final composition">
            <h3 className="s5-modal-column-title">Zorq&rsquo;s final</h3>
            {compare.finalMembers.length === 0 ? (
              <p className="s5-modal-note">The blueprint carries no final members.</p>
            ) : (
              <ul className="s5-modal-list">
                {compare.finalMembers.map((member) => (
                  <li
                    key={`final:${member.name}`}
                    className={member.changed ? "s5-modal-item is-changed" : "s5-modal-item"}
                  >
                    <span>{member.name}</span>
                    {member.changed && <span className="s5-changed-tag">changed</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
