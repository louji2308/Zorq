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
 *    state. Evidence drawer and role-preserving Replace (Phase 7) render from
 *    server state only; unpin/challenge/recompute/blueprint remain honest 503s
 *    (D-5.5).
 *  - "See compositions" docks only when the server actually delivered
 *    compositions, which Phase 7 measurement now does after a run completes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError, challengeRun, getRun, retryRun } from "../lib/api.js";
import { createRunEventStream, type RunStreamHandle } from "../lib/sse.js";
import { useRunStore } from "../store/runStore.js";
import { DnaStrip } from "../screens/s1/DnaStrip.js";
import { InvestigateMap, type S1MapStatus } from "../screens/s1/InvestigateMap.js";
import { LedgerPanel } from "../screens/s1/LedgerPanel.js";
import { PriorCard } from "../screens/s1/PriorCard.js";
import {
  anchorsFromRun,
  buildPriorModel,
  describeLedgerRows,
  describeLoadFailure,
  describeRunStatus,
  describeStreamNotice,
  buildRunRecoveryModel,
  hasCompositions,
  heatFromRun,
  isRunActive,
  isRunRetryable,
  parseCulturalDna,
  siteFromRun
} from "../screens/s1/s1Model.js";
import { stopRunAction } from "../screens/s1/stopAction.js";
import { retryRunAction } from "../screens/s1/retryAction.js";
import { CompositionsPanel } from "../screens/s2/CompositionsPanel.js";
import { buildS2Model } from "../screens/s2/s2Model.js";
import { ConnectionsPanel } from "../screens/s3/ConnectionsPanel.js";
import { ReplacePanel } from "../screens/s3/ReplacePanel.js";
import { buildS3Model, pairKey } from "../screens/s3/s3Model.js";
import { ChallengePanel } from "../screens/s4/ChallengePanel.js";
import { buildS4Model } from "../screens/s4/s4Model.js";
import { BlueprintPanel } from "../screens/s5/BlueprintPanel.js";
import { getRunTabReadiness } from "./runTabs.js";
import "../screens/s1/s1.css";
import "../screens/s2/s2.css";
import "../screens/s3/s3.css";
import "../screens/s4/s4.css";
import "../screens/s5/s5.css";

const RUN_TABS = [
  { id: "investigate", label: "Investigate" },
  { id: "compositions", label: "Compositions" },
  { id: "connections", label: "Connections" },
  { id: "challenge", label: "Challenge" },
  { id: "blueprint", label: "Blueprint" }
] as const;

type RunView = (typeof RUN_TABS)[number]["id"];

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
  const evidence = useRunStore((state) => state.evidence);
  const connection = useRunStore((state) => state.connection);
  const apiError = useRunStore((state) => state.apiError);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<S1MapStatus | null>(null);
  const [priorCollapsed, setPriorCollapsed] = useState(false);
  const [dnaCollapsed, setDnaCollapsed] = useState(false);
  const [view, setView] = useState<RunView>("investigate");
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [s3Pair, setS3Pair] = useState<{ a: string; b: string } | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{
    memberId: string;
    compositionKey: string | null;
  } | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const tabsRef = useRef<HTMLElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [panelMotion, setPanelMotion] = useState(false);
  const lastAnimatedView = useRef<RunView | null>(null);

  useEffect(() => {
    if (lastAnimatedView.current === null) {
      lastAnimatedView.current = view;
      return;
    }
    if (lastAnimatedView.current === view) return;
    lastAnimatedView.current = view;
    setPanelMotion(true);
    const timer = window.setTimeout(() => setPanelMotion(false), 180);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    const el = activeTabRef.current;
    if (el === null) {
      return;
    }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [view]);

  useEffect(() => {
    function measure(): void {
      const el = activeTabRef.current;
      if (el === null) {
        return;
      }
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
    globalThis.window.addEventListener("resize", measure);
    return () => globalThis.window.removeEventListener("resize", measure);
  }, []);

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
    setRefreshError(null);
    setStopError(null);
    setRetryError(null);
    setRetrying(false);
    setMapStatus(null);
    setView("investigate");
    setS3Key(null);
    setS3Pair(null);
    setReplaceTarget(null);
    setChallenging(false);
    setChallengeError(null);

    void (async () => {
      try {
        const fetched = await getRun(runId);
        if (cancelled) {
          return;
        }
        useRunStore.getState().applyState(fetched);
        useRunStore.getState().applyEvidence(fetched.evidence ?? []);
        stream = createRunEventStream({
          runId,
          onState: (next) => useRunStore.getState().applyState(next),
          onLedger: (event, sequence) => useRunStore.getState().applyLedger(event, sequence),
          onErrorFrame: (error) => useRunStore.getState().setError(error),
          onConnection: (status) => useRunStore.getState().setConnection(status),
          onTerminal: () => {
            if (cancelled) {
              return;
            }
            void (async () => {
              try {
                const latest = await getRun(runId);
                if (cancelled) {
                  return;
                }
                useRunStore.getState().applyState(latest);
                useRunStore.getState().applyEvidence(latest.evidence ?? []);
              } catch (error) {
                if (cancelled) {
                  return;
                }
                const code = error instanceof ApiClientError ? error.code : "NETWORK_ERROR";
                setRefreshError(describeLoadFailure(code));
              }
            })();
          }
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
  const s2Model = useMemo(() => buildS2Model(run), [run]);
  const graphRun = useMemo(
    () => (run === null ? null : { ...run, evidence: run.evidence ?? evidence }),
    [run, evidence]
  );
  const s3Model = useMemo(() => buildS3Model(graphRun, s3Key), [graphRun, s3Key]);
  const s4Model = useMemo(() => buildS4Model(run), [run]);
  const recoveryModel = useMemo(
    () => (run === null ? null : buildRunRecoveryModel(run.status)),
    [run]
  );

  const statusCopy =
    run === null ? (loadError !== null ? "Unavailable" : "Opening…") : describeRunStatus(run.status);
  // The stop control stays available while the run is active even after a
  // failed attempt: a transient network error must not remove the only
  // recovery affordance (the error itself surfaces in the banner above).
  const stopVisible = run !== null && isRunActive(run.status);
  const mapActive = run !== null && isRunActive(run.status);
  const streamNotice = describeStreamNotice(connection, run?.status ?? null);
  const ready = run !== null;
  const mapUnavailable = mapStatus === "failed" || mapStatus === "no-key";
  const mapFallback = view === "investigate" && mapUnavailable;
  const s2Available = s2Model !== null && hasCompositions(run);
  const s3Available = s3Model !== null;
  const tabReadiness = getRunTabReadiness({
    hasCompositions: s2Available,
    hasConnections: s3Available,
    challengeReady: s4Model?.challengeReady === true,
    hasChallengeReport: run?.challengeReport !== undefined
  });
  const showS2 = view === "compositions" && tabReadiness.compositions && s2Model !== null;
  const showS3 = view === "connections" && tabReadiness.connections && s3Model !== null;

  useEffect(() => {
    const viewAvailable =
      view === "investigate" ||
      (view === "compositions" && tabReadiness.compositions) ||
      (view === "connections" && tabReadiness.connections) ||
      (view === "challenge" && tabReadiness.challenge) ||
      (view === "blueprint" && tabReadiness.blueprint);
    if (!viewAvailable) {
      setView("investigate");
    }
  }, [
    tabReadiness.blueprint,
    tabReadiness.challenge,
    tabReadiness.compositions,
    tabReadiness.connections,
    view
  ]);

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

  const handleRetry = useCallback(() => {
    if (runId === "" || retrying || run === null || !isRunRetryable(run.status)) {
      return;
    }
    setRetrying(true);
    setRetryError(null);
    void (async () => {
      try {
        const retried = await retryRunAction(runId, { retryRun });
        useRunStore.getState().applyState(retried);
        const latest = await getRun(runId);
        useRunStore.getState().applyState(latest);
        useRunStore.getState().applyEvidence(latest.evidence ?? []);
      } catch (error) {
        setRetryError(
          error instanceof ApiClientError
            ? error.message
            : "We couldn't retry the investigation. Try again in a moment."
        );
      } finally {
        setRetrying(false);
      }
    })();
  }, [retrying, run, runId]);

  const handleChallenge = useCallback(() => {
    if (runId === "" || challenging) {
      return;
    }
    setChallenging(true);
    setChallengeError(null);
    void (async () => {
      try {
        const response = await challengeRun(runId);
        useRunStore.getState().applyState(response.run);
        try {
          const latest = await getRun(runId);
          useRunStore.getState().applyState(latest);
          useRunStore.getState().applyEvidence(latest.evidence ?? []);
        } catch {
          /* evidence refresh is best-effort; the report itself is already applied */
        }
      } catch (error) {
        setChallengeError(
          error instanceof ApiClientError
            ? error.message
            : "We couldn't reach the server to challenge the plan. Try again in a moment."
        );
      } finally {
        setChallenging(false);
      }
    })();
  }, [runId, challenging]);

  return (
    <div
      className={[
        "s1",
        view === "blueprint" ? "is-reading" : "",
        mapFallback ? "is-map-unavailable" : "",
        panelMotion ? "is-panel-motion" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="s1-top">
        {(apiError !== null || streamNotice !== null || stopError !== null || refreshError !== null) && (
          <div className="s1-banner" role="alert">
            {apiError?.error.message ?? streamNotice ?? stopError ?? refreshError}
          </div>
        )}
        <header className="s1-topbar">
          <h1 className="s1-wordmark">
            <Link to="/" viewTransition>
              Zorq
            </Link>
          </h1>
          {ready && (
            <nav className="s1-tabs" aria-label="Run views" ref={tabsRef}>
              {RUN_TABS.map((tab) => {
                const disabled =
                  (tab.id === "compositions" && !tabReadiness.compositions) ||
                  (tab.id === "connections" && !tabReadiness.connections) ||
                  (tab.id === "challenge" && !tabReadiness.challenge) ||
                  (tab.id === "blueprint" && !tabReadiness.blueprint);
                const tooltip = disabled
                  ? tab.id === "compositions"
                    ? "Compositions appear once the run measures the candidate pool."
                    : tab.id === "connections"
                      ? "Connections appear once compositions are measured."
                      : tab.id === "challenge"
                        ? (s4Model?.blockedReason ?? "Challenge appears once a ranked composition is ready.")
                        : "Blueprint appears after the plan has been challenged."
                  : undefined;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={view === tab.id ? "s1-tab is-active" : "s1-tab"}
                    aria-current={view === tab.id ? "page" : undefined}
                    disabled={disabled}
                    title={tooltip}
                    data-tooltip={tooltip}
                    onClick={() => setView(tab.id)}
                    ref={view === tab.id ? activeTabRef : undefined}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <span
                className="s1-tab-indicator"
                style={{
                  transform: `translateX(${indicator.left}px)`,
                  width: `${indicator.width}px`
                }}
                aria-hidden="true"
              />
            </nav>
          )}
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
          {view !== "blueprint" && (
            <div className={mapFallback ? "s1-map is-map-unavailable" : "s1-map"}>
              <InvestigateMap
                apiKey={MAP_API_KEY}
                site={site}
                anchors={anchors}
                heat={heat}
                active={mapActive}
                onStatusChange={setMapStatus}
              />
              {view === "investigate" && (
                <>
                  <PriorCard
                    model={priorModel}
                    collapsed={priorCollapsed}
                    onToggle={() => setPriorCollapsed((current) => !current)}
                  />
                  {priorModel === null && (
                    <p className="s1-prior-wait">Waiting for the frozen Prior…</p>
                  )}
                </>
              )}
            </div>
          )}

          {view === "blueprint" ? (
            <BlueprintPanel run={run} runId={runId} />
          ) : showS3 && s3Model !== null ? (
            <ConnectionsPanel
              run={graphRun}
              model={s3Model}
              initialPairKey={s3Pair === null ? null : pairKey(s3Pair.a, s3Pair.b)}
              onBack={() => setView("compositions")}
              onSelectComposition={(key) => setS3Key(key)}
              onOpenLedger={() => setView("investigate")}
              onReplace={(memberId, compositionKey) =>
                setReplaceTarget({ memberId, compositionKey })
              }
            />
          ) : showS2 && s2Model !== null ? (
            <CompositionsPanel
              model={s2Model}
              onBack={() => setView("investigate")}
              onShowGraph={(key, pair) => {
                setS3Key(key);
                setS3Pair(pair);
                setView("connections");
              }}
            />
          ) : view === "challenge" && tabReadiness.challenge && s4Model !== null ? (
            <ChallengePanel
              model={s4Model}
              challenging={challenging}
              challengeError={challengeError}
              onChallenge={handleChallenge}
              onOpenBlueprint={() => setView("blueprint")}
            />
          ) : (
            <LedgerPanel
              rows={rows}
              stopVisible={stopVisible}
              stopping={stopping}
              onStop={handleStop}
              recovery={
                recoveryModel === null
                  ? undefined
                  : {
                      message: recoveryModel.message,
                      retrying,
                      error: retryError,
                      onRetry: handleRetry
                    }
              }
              docked={
                s2Available ? (
                  <button type="button" className="s1-primary" onClick={() => setView("compositions")}>
                    See compositions
                  </button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      {ready && view !== "blueprint" && (
        <DnaStrip
          groups={dnaGroups}
          status={run?.status ?? "investigating"}
          collapsed={dnaCollapsed}
          onToggle={() => setDnaCollapsed((current) => !current)}
        />
      )}

      {ready && replaceTarget !== null && (
        <ReplacePanel
          run={run}
          memberId={replaceTarget.memberId}
          compositionKey={replaceTarget.compositionKey}
          onClose={() => setReplaceTarget(null)}
        />
      )}
    </div>
  );
}
