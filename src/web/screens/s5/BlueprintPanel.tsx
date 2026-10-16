/*
 * S5 Place Blueprint (Product Spec §7 S5; Final Design §7.5).
 *
 * The reading screen: a full-width Tufte-style document with margin receipts.
 * Owns its fetch (GET /api/runs/:id/blueprint, optional ?share=) and renders
 * ONLY the server-authored blueprint via S5Model — numbers are formatted,
 * never recomputed (AGENTS §13). Unknown citation tokens never render (the
 * model drops them). Errors are honest: expired snapshots get the spec line
 * and a re-run path; guard refusals surface the server's typed copy.
 * Copy as Markdown is deterministic from the blueprint; Print uses the
 * landscape stylesheet in s5.css.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError, getBlueprint } from "../../lib/api.js";
import { describeLoadFailure } from "../s1/s1Model.js";
import type { Blueprint } from "../../../shared/routes.js";
import type { RunState } from "../../../shared/run.js";
import { blueprintToMarkdown, buildS5Model } from "./s5Model.js";
import { CompareModal } from "./CompareModal.js";

export interface BlueprintPanelProps {
  run: RunState | null;
  runId: string;
  /** Share token when rendering the read-only snapshot route. */
  share?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (globalThis.navigator?.clipboard?.writeText !== undefined) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

const COPY_RESET_MS = 2000;

export function BlueprintPanel({ run, runId, share }: BlueprintPanelProps) {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [markdownState, setMarkdownState] = useState<"idle" | "copied" | "failed">("idle");
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (runId === "") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const fetched = await getBlueprint(runId, share);
        if (!cancelled) {
          setBlueprint(fetched);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setBlueprint(null);
          setError(caught instanceof ApiClientError ? caught : null);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, share, attempt]);

  const model = useMemo(() => buildS5Model(run, blueprint), [run, blueprint]);

  const handleShare = useCallback(() => {
    if (blueprint === null) {
      return;
    }
    void copyText(blueprint.shareUrl).then((ok) => {
      setShareState(ok ? "copied" : "failed");
      window.setTimeout(() => setShareState("idle"), COPY_RESET_MS);
    });
  }, [blueprint]);

  const handleCopyMarkdown = useCallback(() => {
    if (blueprint === null) {
      return;
    }
    void copyText(blueprintToMarkdown(blueprint, runId)).then((ok) => {
      setMarkdownState(ok ? "copied" : "failed");
      window.setTimeout(() => setMarkdownState("idle"), COPY_RESET_MS);
    });
  }, [blueprint, runId]);

  const handlePrint = useCallback(() => {
    globalThis.window.print();
  }, []);

  if (loading) {
    return (
      <section className="s5 s5-status" aria-label="Place Blueprint">
        <p className="s5-loading">Composing the Place Blueprint from the run&rsquo;s evidence…</p>
      </section>
    );
  }

  if (error !== null || model === null) {
    const expired = error?.code === "SNAPSHOT_EXPIRED";
    return (
      <section className="s5 s5-status" aria-label="Place Blueprint">
        {expired ? (
          <>
            <p className="s5-error-line">This snapshot has expired. Re-run the same brief.</p>
            <Link to="/" className="s4-primary">
              Start a new investigation
            </Link>
          </>
        ) : (
          <>
            <p className="s5-error-line" role="alert">
              {error === null
                ? "The blueprint is unavailable right now."
                : describeLoadFailure(error.code)}
            </p>
            <button type="button" className="s5-tertiary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="s5" aria-label="Place Blueprint">
      <div className="s5-doc">
        <div className="s5-titleblock" role="group" aria-label="Blueprint title block">
          <span>
            <b>Project</b> {model.titleBlock.project}
          </span>
          <span>
            <b>Site</b> {model.titleBlock.site}
          </span>
          <span>
            <b>Area</b> {model.titleBlock.area}
          </span>
          <span>
            <b>Constraints</b> {model.titleBlock.constraints}
          </span>
          <span>
            <b>Grade</b> {model.titleBlock.grade}
          </span>
          <span>
            <b>Revision</b> {model.titleBlock.revision}
          </span>
          <span>
            <b>Date</b> {model.titleBlock.date}
          </span>
          <span>
            <b>Run</b> <code className="s5-mono">{model.titleBlock.runId}</code>
          </span>
        </div>

        <div className="s5-heading-row">
          <h2 className="s5-title">{model.title}</h2>
          <span
            className={
              model.narrativeSource === "llm" ? "s5-source-pill is-llm" : "s5-source-pill"
            }
          >
            {model.narrativeSource === "llm" ? "LLM" : "Deterministic"}
          </span>
        </div>

        <p className="s5-rationale">
          {model.rationaleSegments.map((segment, index) =>
            segment.kind === "text" ? (
              <span key={index}>{segment.text}</span>
            ) : (
              <sup key={index} className="s5-sup">
                {segment.ref}
              </sup>
            )
          )}
        </p>

        <h3 className="s5-section-title">Composition by role</h3>
        <ul className="s5-members">
          {model.memberRows.map((row) => (
            <li key={row.key} className="s5-member">
              <div className="s5-member-role">{row.role}</div>
              <div className="s5-member-body">
                <div className="s5-member-name">
                  {row.name}
                  {row.receiptIndexes.map((index) => (
                    <sup key={index} className="s5-sup">
                      {index}
                    </sup>
                  ))}
                </div>
                {row.formatLabel !== null && (
                  <div className="s5-member-format">{row.formatLabel}</div>
                )}
                {row.footprintLabel !== null && (
                  <div className="s5-member-footprint">
                    <span className="s5-member-footprint-label">{row.footprintLabel}</span>
                    {row.footprintFraction !== null && (
                      <span
                        className="s5-footprint-bar"
                        style={{ width: `${Math.round(row.footprintFraction * 100)}%` }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
                {row.hoursLabel !== null && (
                  <div className="s5-member-hours">Open {row.hoursLabel}</div>
                )}
                {row.downshiftSentence !== null && (
                  <div className="s5-member-downshift">{row.downshiftSentence}</div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <h3 className="s5-section-title">Fit to site</h3>
        <div className="s5-fit">
          <div className="s5-fit-footprint">
            <div className="s5-fit-line">
              <span className="s5-fit-label">Footprint</span>
              <span className="s5-fit-value">
                {model.fit.totalLabel} of {model.fit.areaLabel}
                {model.fit.withinUsable ? " — within usable area" : " — exceeds usable area"}
              </span>
            </div>
            <p className="s5-fit-rule">{model.fit.rule}</p>
          </div>
          {model.fit.hoursRows.length > 0 && (
            <div className="s5-fit-hours">
              <span className="s5-fit-label">Hours</span>
              {model.fit.hoursRows.map((row) => (
                <div key={row.name} className="s5-hours-row">
                  <span className="s5-hours-name">{row.name}</span>
                  <span className="s5-hours-track" aria-hidden="true">
                    {row.segments.map((segment, index) => (
                      <span
                        key={index}
                        className="s5-hours-bar"
                        style={{
                          left: `${(segment.from / 24) * 100}%`,
                          width: `${((segment.to - segment.from) / 24) * 100}%`
                        }}
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          {model.fit.constraintReads.length > 0 && (
            <ul className="s5-constraints">
              {model.fit.constraintReads.map((entry) => (
                <li key={`${entry.label}:${entry.source}`} className="s5-constraint-chip">
                  {entry.label} — {entry.source}
                </li>
              ))}
            </ul>
          )}
          {model.fit.downshiftSentences.map((sentence) => (
            <p key={sentence} className="s5-downshift">
              {sentence}
            </p>
          ))}
        </div>

        <h3 className="s5-section-title">What Qloo changed</h3>
        <div className="s5-slope" role="img" aria-label={model.diffSentence}>
          <div className="s5-slope-head">
            <span>Prior</span>
            <span />
            <span>Final</span>
          </div>
          {model.slope.map((row) => (
            <div key={`slope:${row.kind}:${row.member}`} className={`s5-slope-row is-${row.kind}`}>
              <span className="s5-slope-name is-prior">
                {row.onPrior ? row.member : ""}
              </span>
              <span className="s5-slope-line" aria-hidden="true" />
              <span className="s5-slope-name is-final">
                {row.onFinal ? row.member : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="s5-slope-foot">
          <p className="s5-diff-sentence">{model.diffSentence}</p>
          <button type="button" className="s5-secondary" onClick={() => setCompareOpen(true)}>
            Without Qloo
          </button>
        </div>

        <h3 className="s5-section-title">Risks</h3>
        {model.risks.length === 0 ? (
          <p className="s5-note">No risks were flagged for this composition.</p>
        ) : (
          <ul className="s5-risks">
            {model.risks.map((risk) => (
              <li key={`${risk.kind}:${risk.text}`} className="s5-risk">
                {risk.text}
              </li>
            ))}
          </ul>
        )}

        <h3 className="s5-section-title">Evidence grade</h3>
        <div className="s5-grade">
          <span className="s5-grade-square" aria-label={`Evidence grade ${model.evidenceGrade.grade}`}>
            {model.evidenceGrade.grade}
          </span>
          <p className="s5-grade-rule">{model.evidenceGrade.rule}</p>
          <a className="s5-method-link" href={model.methodUrl}>
            How this was measured
          </a>
        </div>

        <h3 className="s5-section-title">Revision block</h3>
        {model.revisions.length === 0 ? (
          <p className="s5-note">No replacements have been recorded for this run.</p>
        ) : (
          <ul className="s5-revisions">
            {model.revisions.map((revision) => (
              <li key={revision.rev} className="s5-revision">
                {revision.sentence}
              </li>
            ))}
          </ul>
        )}

        <div className="s5-actions">
          <button type="button" className="s4-primary" onClick={handleShare}>
            {shareState === "copied" ? "Link copied" : "Share blueprint"}
          </button>
          <button type="button" className="s5-secondary" onClick={handleCopyMarkdown}>
            {markdownState === "copied" ? "Markdown copied" : "Copy as Markdown"}
          </button>
          <button type="button" className="s5-secondary" onClick={handlePrint}>
            Print
          </button>
        </div>
        <p className="s5-share-status" role="status" aria-live="polite">
          {shareState === "copied"
            ? "Anyone with the link can read this snapshot."
            : shareState === "failed"
              ? "Copying the link failed — select and copy the address from your browser instead."
              : ""}
        </p>
      </div>

      <aside className="s5-margin" aria-label="Evidence receipts">
        <h3 className="s5-margin-title">Receipts</h3>
        {model.receipts.length === 0 ? (
          <p className="s5-note">No evidence receipts were recorded.</p>
        ) : (
          <ol className="s5-receipt-list">
            {model.receipts.map((receipt) => (
              <li key={receipt.index} className="s5-receipt">
                <span className="s5-receipt-head">
                  <span className="s5-receipt-index">{receipt.index}</span>
                  <span className="s5-evidence-pill">Qloo</span>
                </span>
                <span className="s5-receipt-member">{receipt.memberName}</span>
                <span className="s5-receipt-text">{receipt.text}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>

      {compareOpen && (
        <CompareModal compare={model.compare} onClose={() => setCompareOpen(false)} />
      )}
    </section>
  );
}
