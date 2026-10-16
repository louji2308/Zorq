/*
 * S4 Challenge the Plan (Product Spec §7 S4; Final Design §7.4).
 *
 * Renders ONLY the persisted challengeReport via S4Model — no optimistic
 * verdicts, no invented attack results (AGENTS §12). Pre-verdict the banner
 * slot holds the question at the same size (no layout shift is a credibility
 * rule). Shape carries meaning: square solid/half-hatched/crossed for the
 * verdict, circle filled/half/crossed/empty for attack state — never colour
 * alone. A failed probe stays visible with its "not completed" sentence.
 */
import type { S4Model } from "./s4Model.js";
import { PRE_VERDICT_QUESTION } from "./s4Model.js";

export interface ChallengePanelProps {
  model: S4Model;
  challenging: boolean;
  challengeError: string | null;
  onChallenge: () => void;
  onOpenBlueprint: () => void;
}

function VerdictSquare({ shape }: { shape: "solid" | "half-hatched" | "crossed" }) {
  return (
    <svg
      className={`s4-verdict-square is-${shape}`}
      width="34"
      height="34"
      viewBox="0 0 34 34"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="s4-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2.5" stroke="currentColor" />
        </pattern>
      </defs>
      <rect x="3" y="3" width="28" height="28" fill={shape === "solid" ? "currentColor" : shape === "half-hatched" ? "url(#s4-hatch)" : "none"} strokeWidth="2" />
      {shape === "crossed" && (
        <>
          <line x1="5" y1="5" x2="29" y2="29" strokeWidth="2.5" />
          <line x1="29" y1="5" x2="5" y2="29" strokeWidth="2.5" />
        </>
      )}
    </svg>
  );
}

function AttackCircle({ state }: { state: "filled" | "half" | "crossed" | "empty" }) {
  return (
    <svg
      className={`s4-attack-circle is-${state}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="1.75" />
      {state === "filled" && <circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" />}
      {state === "half" && <path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor" stroke="none" />}
      {state === "crossed" && (
        <>
          <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" strokeWidth="1.75" />
          <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" strokeWidth="1.75" />
        </>
      )}
    </svg>
  );
}

export function ChallengePanel({
  model,
  challenging,
  challengeError,
  onChallenge,
  onOpenBlueprint
}: ChallengePanelProps) {
  return (
    <section className="s4" aria-label="Challenge the Plan">
      <header className="s4-banner">
        {model.hasVerdict ? (
          <>
            <div className="s4-banner-line">
              <VerdictSquare shape={model.verdictSquare ?? "solid"} />
              <h2 className="s4-verdict-word">{model.verdictWord}</h2>
            </div>
            <p className="s4-verdict-reason">{model.verdictSentence}</p>
            <p className="s4-banner-meta zq-nums">
              {model.rounds} stress round{model.rounds === 1 ? "" : "s"} · {model.mutationCount} mutation
              {model.mutationCount === 1 ? "" : "s"} · attack order{" "}
              {model.attackOrderSource === "llm" ? "chosen by the agent" : "diagnostic fallback"}
              {model.gradeCap === "B" ? " · evidence grade capped at B" : ""}
            </p>
          </>
        ) : (
          <>
            <div className="s4-banner-line">
              <h2 className="s4-verdict-word">{PRE_VERDICT_QUESTION}</h2>
            </div>
            <p className="s4-verdict-reason">
              {model.blockedReason ??
                "The agent will stress the leader with five attacks, then commit to a verdict."}
            </p>
            <div className="s4-banner-actions">
              <button
                type="button"
                className="s4-primary"
                onClick={onChallenge}
                disabled={challenging || !model.challengeReady}
              >
                {challenging ? "Challenging…" : "Challenge the plan"}
              </button>
              <span className="s4-live" role="status" aria-live="polite">
                {challenging ? "Stressing the leader against five attacks…" : ""}
              </span>
            </div>
            {challengeError !== null && (
              <p className="s4-error" role="alert">
                {challengeError}
              </p>
            )}
          </>
        )}
      </header>

      <div className="s4-grid">
        <div className="s4-attacks">
          <h3 className="s4-column-title">
            {model.hasVerdict ? "Five attacks" : "What will be attacked"}
          </h3>
          {model.attacks.length === 0 ? (
            <p className="s4-empty">
              The attack rows appear here once the challenge has run. Nothing has been stressed yet.
            </p>
          ) : (
            <ol className="s4-attack-list">
              {model.attacks.map((attack) => (
                <li key={attack.kind} className={`s4-attack is-${attack.status.replace(" ", "-")}`}>
                  <div className="s4-attack-head">
                    <AttackCircle state={attack.circle} />
                    <span className="s4-attack-name">{attack.name}</span>
                    {attack.status === "not completed" && (
                      <span className="s4-attack-flag">not completed</span>
                    )}
                    {attack.status === "skipped" && (
                      <span className="s4-attack-flag">skipped</span>
                    )}
                  </div>
                  <p className="s4-attack-asks">{attack.asks}</p>
                  <p className="s4-attack-result">{attack.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="s4-leader">
          <h3 className="s4-column-title">The leader, as drawn</h3>
          {model.leaderRows.length === 0 ? (
            <p className="s4-empty">The leader appears here once the challenge has run.</p>
          ) : (
            <ul className="s4-leader-list">
              {model.leaderRows.map((row) => (
                <li key={row.key} className={row.struck ? "s4-leader-row is-struck" : "s4-leader-row"}>
                  <span className={row.struck ? "s4-leader-name is-struck" : "s4-leader-name"}>
                    {row.name}
                  </span>
                  {row.struck && <span className="s4-leader-note">removed</span>}
                  {row.replacement !== null && (
                    <span className="s4-leader-replacement">{row.replacement}</span>
                  )}
                  {row.added && <span className="s4-leader-note">added</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="s4-leader-actions">
            {model.hasVerdict && (
              <button type="button" className="s4-primary" onClick={onOpenBlueprint}>
                Open blueprint
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
