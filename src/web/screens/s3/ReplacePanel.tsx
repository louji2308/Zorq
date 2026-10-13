import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { RunState } from "../../../shared/run.js";
import type { ReplaceRequest } from "../../../shared/routes.js";
import { ApiClientError, replaceComponent } from "../../lib/api.js";
import { useRunStore } from "../../store/runStore.js";
import { formatCoherence } from "../s2/s2Model.js";
import {
  buildReplaceModel,
  readReplaceSuccess,
  signedDelta,
  type ReplaceAlternative,
  type ReplaceSuccess
} from "./replaceModel.js";

export interface ReplacePanelProps {
  run: RunState;
  memberId: string;
  compositionKey: string | null;
  onClose: () => void;
}

interface AlternativeRowProps {
  alternative: ReplaceAlternative;
  selected: boolean;
  disabled: boolean;
  barCoherenceMax: number;
  barDistinctivenessMax: number;
  onSelect: (id: string) => void;
}

function barPercent(value: number | null, max: number): number {
  if (value === null || max <= 0) {
    return 0;
  }
  return Math.round((Math.abs(value) / max) * 100);
}

function deltaSentence(alternative: ReplaceAlternative): string {
  if (!alternative.measurable) {
    return "No ranked reading exists for this swap.";
  }
  return `Δ coherence ${signedDelta(alternative.deltaCoherence ?? 0)}, Δ distinctiveness ${signedDelta(
    alternative.deltaDistinctiveness ?? 0
  )}`;
}

function AlternativeRow({
  alternative,
  selected,
  disabled,
  barCoherenceMax,
  barDistinctivenessMax,
  onSelect
}: AlternativeRowProps) {
  return (
    <li>
      <button
        type="button"
        className={`s3-replace-option${selected ? " s3-replace-option-active" : ""}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSelect(alternative.id)}
        title={deltaSentence(alternative)}
      >
        <span className="s3-replace-option-name">{alternative.name}</span>
        {alternative.measurable ? (
          <span className="s3-replace-bars" aria-hidden="true">
            <span className="s3-replace-bar-row">
              <span className="s3-replace-bar-label">Coherence</span>
              <span className="s3-replace-bar-track">
                <span
                  className="s3-replace-bar-fill"
                  style={{ width: `${barPercent(alternative.deltaCoherence, barCoherenceMax)}%` }}
                />
              </span>
            </span>
            <span className="s3-replace-bar-row">
              <span className="s3-replace-bar-label">Distinct.</span>
              <span className="s3-replace-bar-track">
                <span
                  className="s3-replace-bar-fill"
                  style={{
                    width: `${barPercent(alternative.deltaDistinctiveness, barDistinctivenessMax)}%`
                  }}
                />
              </span>
            </span>
          </span>
        ) : (
          <span className="s3-replace-option-note">{alternative.blockedNote}</span>
        )}
        <span className="s3-replace-option-deltas">
          {alternative.measurable
            ? `ΔC ${signedDelta(alternative.deltaCoherence ?? 0)} · ΔD ${signedDelta(
                alternative.deltaDistinctiveness ?? 0
              )}`
            : "Not ranked"}
        </span>
      </button>
    </li>
  );
}

export function ReplacePanel({ run, memberId, compositionKey, onClose }: ReplacePanelProps) {
  const result = useMemo(
    () => buildReplaceModel(run, memberId, compositionKey),
    [run, memberId, compositionKey]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<ReplaceSuccess | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const restore = returnFocusRef;
    return () => {
      restore.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (pending) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  useEffect(() => {
    if (success === null) {
      return;
    }
    const timer = window.setTimeout(() => onClose(), 1600);
    return () => window.clearTimeout(timer);
  }, [onClose, success]);

  const runReplace = useCallback(
    (request: ReplaceRequest): void => {
      if (pending) {
        return;
      }
      setPending(true);
      setFailure(null);
      void (async () => {
        try {
          const response = await replaceComponent(run.id, request);
          useRunStore.getState().applyState(response.run);
          setSuccess(
            readReplaceSuccess(response.run) ?? {
              verdict: "Recorded",
              reason: "The replacement was measured and saved to this run.",
              rows: []
            }
          );
        } catch (error) {
          setFailure(
            error instanceof ApiClientError
              ? error.message
              : "The replacement could not be completed, and nothing was changed."
          );
        } finally {
          setPending(false);
        }
      })();
    },
    [pending, run.id]
  );

  const customTrimmed = customQuery.trim();

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && !pending) {
      onClose();
    }
  };

  if (success !== null) {
    return (
      <div className="s3-replace-backdrop" onClick={handleBackdrop} role="presentation">
        <aside
          className="s3-replace"
          role="dialog"
          aria-modal="true"
          aria-label="Replacement recorded"
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="s3-replace-header">
            <h2 className="s3-replace-title">Replacement recorded</h2>
            <button type="button" className="s1-tertiary" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="s3-replace-body" aria-live="polite">
            <p className="s3-replace-verdict">{success.verdict}</p>
            <p className="s3-replace-note">{success.reason}</p>
            {success.rows.length > 0 && (
              <ul className="s3-replace-attacks">
                {success.rows.map((row) => (
                  <li key={`${row.kind}-${row.summary}`} className="s3-replace-attack">
                    <span className="s3-replace-attack-kind">
                      {row.kind === "ablation"
                        ? "Drop-one ablation"
                        : row.kind === "rival"
                          ? "Rival weighting"
                          : row.kind}
                      {row.status === "skipped" ? " · skipped" : ""}
                    </span>
                    <span className="s3-replace-attack-summary">{row.summary}</span>
                    <span className="s3-replace-attack-detail">{row.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="s3-replace-backdrop" onClick={handleBackdrop} role="presentation">
        <aside
          className="s3-replace"
          role="dialog"
          aria-modal="true"
          aria-label="Replace a component"
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="s3-replace-header">
            <h2 className="s3-replace-title">Replace a component</h2>
            <button type="button" className="s1-tertiary" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="s3-replace-body">
            <p className="s3-replace-empty">{result.reason}</p>
          </div>
        </aside>
      </div>
    );
  }

  const model = result.model;
  const selected =
    model.alternatives.find((alternative) => alternative.id === selectedId) ?? null;

  const handleConfirmCandidate = (): void => {
    if (selected === null || !selected.measurable || pending) {
      return;
    }
    runReplace({
      targetComponentId: memberId,
      candidateId: selected.id,
      ...(compositionKey === null ? {} : { compositionKey })
    });
  };

  const handleConfirmCustom = (): void => {
    if (customTrimmed === "" || model.customBlockedReason !== null || pending) {
      return;
    }
    runReplace({
      targetComponentId: memberId,
      customQuery: customTrimmed,
      ...(compositionKey === null ? {} : { compositionKey })
    });
  };

  return (
    <div className="s3-replace-backdrop" onClick={handleBackdrop} role="presentation">
      <aside
        className="s3-replace"
        role="dialog"
        aria-modal="true"
        aria-label={`Replace ${model.memberName}`}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="s3-replace-header">
          <h2 className="s3-replace-title">Replace {model.memberName}</h2>
          <button type="button" className="s1-tertiary" onClick={onClose} disabled={pending}>
            Close
          </button>
        </div>
        <div className="s3-replace-body">
          <p className="s3-replace-role">Keeps the role: {model.role}.</p>
          <p className="s3-replace-context">
            Current composition coherence {formatCoherence(model.coherenceBefore)} · percentile{" "}
            {model.percentileBefore === null ? "unavailable" : model.percentileBefore.toFixed(1)}
          </p>

          {model.emptyReason !== null ? (
            <p className="s3-replace-empty">{model.emptyReason}</p>
          ) : (
            <ul className="s3-replace-options">
              {model.alternatives.map((alternative) => (
                <AlternativeRow
                  key={alternative.id}
                  alternative={alternative}
                  selected={alternative.id === selectedId}
                  disabled={pending || !alternative.measurable}
                  barCoherenceMax={model.barCoherenceMax}
                  barDistinctivenessMax={model.barDistinctivenessMax}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          )}

          {selected !== null && selected.measurable && (
            <button
              type="button"
              className="s1-primary"
              onClick={handleConfirmCandidate}
              disabled={pending}
            >
              {pending ? "Replacing…" : `Replace with ${selected.name}`}
            </button>
          )}

          <div className="s3-replace-custom">
            <p className="s3-replace-heading">Custom Qloo query</p>
            {model.customBlockedReason !== null ? (
              <p className="s3-replace-note">{model.customBlockedReason}</p>
            ) : (
              <>
                <label className="s3-replace-label" htmlFor="s3-replace-query">
                  Describe the replacement in a few words; Qloo resolves it to a tag and exemplars.
                </label>
                <input
                  id="s3-replace-query"
                  className="s3-replace-input"
                  type="text"
                  maxLength={200}
                  value={customQuery}
                  onChange={(event) => setCustomQuery(event.target.value)}
                  disabled={pending}
                />
                <button
                  type="button"
                  className="s1-primary"
                  onClick={handleConfirmCustom}
                  disabled={pending || customTrimmed === ""}
                >
                  {pending
                    ? "Replacing…"
                    : `Replace with “${customTrimmed === "" ? "…" : customTrimmed}”`}
                </button>
              </>
            )}
          </div>

          {failure !== null && (
            <p className="s3-replace-failure" role="alert">
              {failure}
            </p>
          )}

          {model.revisions.length > 0 && (
            <div className="s3-replace-revisions">
              <p className="s3-replace-heading">Revisions on this run</p>
              <ol className="s3-replace-revision-list">
                {model.revisions.map((revision) => (
                  <li key={revision.rev} className="s3-replace-revision">
                    R{revision.rev}: {revision.replacedName} → {revision.newName} ({revision.role}) ·
                    ΔC {signedDelta(revision.deltaCoherence)}
                    {revision.custom ? " · custom" : ""}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
