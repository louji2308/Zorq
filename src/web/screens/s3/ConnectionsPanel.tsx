import { useCallback, useEffect, useMemo, useState } from "react";
import type { RunState } from "../../../shared/run.js";
import { DistanceChart } from "./DistanceChart.js";
import { EvidenceDrawer } from "./EvidenceDrawer.js";
import { MapOfMeaning } from "./MapOfMeaning.js";
import {
  buildNodeSheet,
  buildPairEvidence,
  pairKey,
  type S3Model
} from "./s3Model.js";

export interface ConnectionsPanelProps {
  run: RunState | null;
  model: S3Model;
  initialPairKey?: string | null;
  onBack: () => void;
  onSelectComposition: (key: string) => void;
  onOpenLedger?: (evidenceId: string) => void;
  onReplace?: (memberId: string, compositionKey: string | null) => void;
  onChallenge?: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function defaultView(): "map" | "chart" {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(min-width: 1200px)").matches ? "map" : "chart";
  }
  return "map";
}

export function ConnectionsPanel({
  run,
  model,
  initialPairKey,
  onBack,
  onSelectComposition,
  onOpenLedger,
  onReplace,
  onChallenge
}: ConnectionsPanelProps) {
  const [view, setView] = useState<"map" | "chart">(defaultView);
  const [selectedPairKey, setSelectedPairKey] = useState<string | null>(
    initialPairKey ?? null
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const selectionKey = model.selected?.key ?? "";

  useEffect(() => {
    if (!model.pulse || prefersReducedMotion()) {
      setPulse(false);
      return;
    }
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 600);
    return () => window.clearTimeout(timer);
  }, [selectionKey, model.pulse]);

  const edgeIndex = useMemo(() => {
    const index = new Map(
      (run?.graph?.edges ?? []).map((edge) => [pairKey(edge.a, edge.b), edge])
    );
    return index;
  }, [run]);

  const triIndex = useMemo(() => {
    const index = new Map(
      (run?.compositions?.triangulation ?? []).map((entry) => [
        pairKey(entry.a, entry.b),
        entry
      ])
    );
    return index;
  }, [run]);

  const selectedPair = useMemo(
    () =>
      selectedPairKey === null
        ? null
        : (model.pairs.find((pair) => pair.key === selectedPairKey) ?? null),
    [model.pairs, selectedPairKey]
  );

  const evidence = useMemo(() => {
    if (run === null || selectedPair === null) {
      return null;
    }
    return buildPairEvidence(
      run,
      selectedPair.a,
      selectedPair.b,
      edgeIndex.get(selectedPair.key),
      triIndex.get(selectedPair.key)
    );
  }, [run, selectedPair, edgeIndex, triIndex]);

  const sheet = useMemo(
    () => (run === null || selectedNodeId === null ? null : buildNodeSheet(run, selectedNodeId)),
    [run, selectedNodeId]
  );

  const handleSelectPair = useCallback((key: string) => {
    setSelectedNodeId(null);
    setSelectedPairKey((current) => (current === key ? null : key));
  }, []);

  const handleSelectNode = useCallback((id: string) => {
    setSelectedPairKey(null);
    setSelectedNodeId((current) => (current === id ? null : id));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedPairKey(null);
    setSelectedNodeId(null);
  }, []);

  const hasSelection = selectedPairKey !== null || selectedNodeId !== null;

  return (
    <section className="s3-panel" aria-label="Connections">
      <header className="s3-panel-header">
        <h2 className="s3-panel-title">Connections</h2>
        <button type="button" className="s1-tertiary" onClick={onBack}>
          Back to compositions
        </button>
      </header>
      <div className="s3-toolbar">
        <div className="s3-selector" role="group" aria-label="Composition">
          {model.options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`s3-option${model.selected?.key === option.key ? " s3-option-active" : ""}`}
              aria-pressed={model.selected?.key === option.key}
              title={option.label}
              onClick={() => onSelectComposition(option.key)}
            >
              <span className="s3-option-letter">{option.letter}</span>
              <span className="s3-option-members">{option.label}</span>
            </button>
          ))}
        </div>
        <div className="s3-views" role="group" aria-label="View">
          <button
            type="button"
            className={`s3-view-toggle s3-view-mapbtn${view === "map" ? " s3-view-active" : ""}`}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Map of meaning
          </button>
          <button
            type="button"
            className={`s3-view-toggle${view === "chart" ? " s3-view-active" : ""}`}
            aria-pressed={view === "chart"}
            onClick={() => setView("chart")}
          >
            Distance chart
          </button>
        </div>
      </div>
      <div className="s3-body">
        <div className="s3-main">
          {!hasSelection && (
            <p className="s3-hint" role="status">
              Choose a line to see the culture its two audiences share.
            </p>
          )}
          <div
            className={`s3-pane s3-pane-map${view === "map" ? "" : " s3-pane-hidden"}`}
          >
            <MapOfMeaning
              nodes={model.nodes}
              edges={model.mapEdges}
              pulse={pulse}
              selectedPairKey={selectedPairKey}
              onSelectPair={handleSelectPair}
              onSelectNode={handleSelectNode}
            />
            <p className="s3-note">{model.scaleNote}</p>
            <p className="s3-note">{model.stressSentence}</p>
          </div>
          <div
            className={`s3-pane s3-pane-chart${view === "chart" ? "" : " s3-pane-hidden"}`}
          >
            <DistanceChart
              nodes={model.nodes}
              cells={model.chartCells}
              pairs={model.pairs}
              selectedPairKey={selectedPairKey}
              onSelectPair={handleSelectPair}
            />
          </div>
          {model.weakest !== null && (
            <p className="s3-weakest">
              <span className="s3-weakest-head">{model.weakest.headline}</span>{" "}
              {model.weakest.sentence}
            </p>
          )}
          {onChallenge !== undefined && (
            <div className="s3-cta-row">
              <button type="button" className="s1-primary" onClick={onChallenge}>
                Challenge the plan
              </button>
            </div>
          )}
        </div>
        {hasSelection && (
          <EvidenceDrawer
            evidence={evidence}
            sheet={sheet}
            hasSelection={hasSelection}
            onOpenLedger={onOpenLedger}
            onReplace={
              onReplace === undefined
                ? undefined
                : (memberId) => onReplace(memberId, model.selected?.key ?? null)
            }
            onClose={handleClose}
          />
        )}
      </div>
    </section>
  );
}
