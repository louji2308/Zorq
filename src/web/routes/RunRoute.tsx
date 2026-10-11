/*
 * S1 Investigate — route /run/:id (Product Spec §7 S1; Final Design §7.1).
 *
 * Wiring (ARCH §17; D-5.3):
 *  - On mount the REAL run is fetched via the typed client (getRun), then the
 *    SSE stream opens; frames project into the Zustand store (state replaces,
 *    ledger appends contiguously). The store is a projection of Run — never a
 *    second source of truth, never a fabrication site (AGENTS §12/§13).
 *  - The Prior card renders ONLY the persisted server Prior; missing prior =
 *    honest loading state, never a guessed card. This is the Prior reveal.
 *  - The ledger renders ONLY real SSE/state rows; stop calls the REAL
 *    POST /api/runs/:id/stop route and applies the server's projection back.
 *  - Map site/ring come from the stored brief; anchors/heat render only if
 *    run.siteRead ever carries them (today it does not — never synthetic).
 *  - DNA strip renders only real culturalDna data; otherwise an honest empty
 *    state. Evidence drawer (Phase 7), feel-picks, unpin/replace/challenge
 *    are non-goals: those server routes are honest 503s (D-5.5).
 *  - "See compositions" docks only when the server actually delivered
 *    compositions; today it never does, so it stays absent honestly.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError, getRun } from "../lib/api.js";
import { createRunEventStream, type RunStreamHandle } from "../lib/sse.js";
import { useRunStore } from "../store/runStore.js";
import { DnaStrip } from "../screens/s1/DnaStrip.js";
import { InvestigateMap } from "../screens/s1/InvestigateMap.js";
import { LedgerPanel } from "../screens/s1/LedgerPanel.js";
import { PriorCard } from "../screens/s1/PriorCard.js";
import {
  anchorsFromRun,
  buildPriorModel,
  describeLedgerRows,
  describeLoadFailure,
  describeRunStatus,
  describeStreamNotice,
  hasCompositions,
  heatFromRun,
  isRunActive,
  parseCulturalDna,
  siteFromRun
} from "../screens/s1/s1Model.js";
import { stopRunAction } from "../screens/s1/stopAction.js";
import "../screens/s1/s1.css";

/** VITE_MAPTILER_KEY is public by design (D-6.1); never logged. */
function readMapApiKey(): string | null {
  const value: unknown = import.meta.env.VITE_MAPTILER_KEY;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const MAP_API_KEY = readMapApiKey();

export function RunRoute() {
  const params = useParams<{ id: string }>();
  const runId = params.id ?? "";

  const run = useRunStore((state) => state.run);
  const ledgerRows = useRunStore((state) => state.ledgerRows);
  const connection = useRunStore((state) => state.connection);
  const apiError = useRunStore((state) => state.apiError);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [priorCollapsed, setPriorCollapsed] = useState(false);
  const [dnaCollapsed, setDnaCollapsed] = useState(false);

  useEffect(() => {
    if (runId === "") {
      setLoadError(describeLoadFailure("RUN_NOT_FOUND"));
      return;
    }
    let cancelled = false;
    let stream: RunStreamHandle | null = null;
    const store = useRunStore.getState();
    store.reset();
    setLoadError(null);
    setStopError(null);

    void (async () => {
      try {
        const fetched = await getRun(runId);
        if (cancelled) {
          return;
        }
        useRunStore.getState().applyState(fetched);
        stream = createRunEventStream({
          runId,
          onState: (next) => useRunStore.getState().applyState(next),
          onLedger: (event, sequence) => useRunStore.getState().applyLedger(event, sequence),
          onErrorFrame: (error) => useRunStore.getState().setError(error),
          onConnection: (status) => useRunStore.getState().setConnection(status)
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const code = error instanceof ApiClientError ? error.code : "NETWORK_ERROR";
        setLoadError(describeLoadFailure(code));
      }
    })();

    return () => {
      cancelled = true;
      stream?.close();
      useRunStore.getState().reset();
    };
  }, [runId]);

  const priorModel = useMemo(() => buildPriorModel(run), [run]);
  const rows = useMemo(() => describeLedgerRows(ledgerRows), [ledgerRows]);
  const site = useMemo(() => siteFromRun(run), [run]);
  const anchors = useMemo(() => anchorsFromRun(run), [run]);
  const heat = useMemo(() => heatFromRun(run), [run]);
  const dnaGroups = useMemo(() => parseCulturalDna(run?.culturalDna), [run]);

  const statusCopy =
    run === null ? (loadError !== null ? "Unavailable" : "Opening…") : describeRunStatus(run.status);
  // The stop control stays available while the run is active even after a
  // failed attempt: a transient network error must not remove the only
  // recovery affordance (the error itself surfaces in the banner above).
  const stopVisible = run !== null && isRunActive(run.status);
  const streamNotice = describeStreamNotice(connection, run?.status ?? null);
  const ready = run !== null;

  const handleStop = useCallback(() => {
    if (runId === "" || stopping) {
      return;
    }
    setStopping(true);
    setStopError(null);
    void (async () => {
      try {
        const stopped = await stopRunAction(runId);
        useRunStore.getState().applyState(stopped);
      } catch {
        setStopError(
          "We couldn't stop the run just now — it may already be finishing. Reload to catch up."
        );
      } finally {
        setStopping(false);
      }
    })();
  }, [runId, stopping]);

  return (
    <div className="s1">
      <div className="s1-top">
        {(apiError !== null || streamNotice !== null || stopError !== null) && (
          <div className="s1-banner" role="alert">
            {apiError?.error.message ?? streamNotice ?? stopError}
          </div>
        )}
        <header className="s1-topbar">
          <h1 className="s1-wordmark">
            <Link to="/">Zorq</Link>
          </h1>
          <div className="s1-site-line">
            <span className="s1-site-location">{run?.brief?.location ?? "Investigation"}</span>
            <span className="zq-nums" role="status">
              {statusCopy}
            </span>
          </div>
        </header>
      </div>

      {loadError !== null ? (
        <div className="s1-fatal">
          <p>{loadError}</p>
          <Link to="/">Start a new investigation</Link>
        </div>
      ) : !ready ? (
        <div className="s1-loading">
          <h2>Opening the investigation…</h2>
          <p>Fetching the frozen Prior and the latest run state from the server.</p>
        </div>
      ) : (
        <>
          <div className="s1-map">
            <InvestigateMap apiKey={MAP_API_KEY} site={site} anchors={anchors} heat={heat} />
            <PriorCard
              model={priorModel}
              collapsed={priorCollapsed}
              onToggle={() => setPriorCollapsed((current) => !current)}
            />
            {priorModel === null && (
              <p className="s1-prior-wait">Waiting for the frozen Prior…</p>
            )}
          </div>

          <LedgerPanel
            rows={rows}
            stopVisible={stopVisible}
            stopping={stopping}
            onStop={handleStop}
            docked={
              hasCompositions(run) ? (
                <button type="button" className="s1-primary" disabled>
                  See compositions
                </button>
              ) : undefined
            }
          />
        </>
      )}

      {ready && (
        <DnaStrip
          groups={dnaGroups}
          collapsed={dnaCollapsed}
          onToggle={() => setDnaCollapsed((current) => !current)}
        />
      )}
    </div>
  );
}
