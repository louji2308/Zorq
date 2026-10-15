import { afterEach, describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../../src/shared/errors.js";
import type { LedgerEvent } from "../../src/shared/events.js";
import type { RunEvidenceNode, RunState } from "../../src/shared/run.js";
import { useRunStore } from "../../src/web/store/runStore.js";

const TEST_RUN_STATE: RunState = {
  id: "run-1",
  status: "investigating",
  phase: "investigation"
};

const SECOND_RUN_STATE: RunState = {
  id: "run-1",
  status: "complete",
  phase: "measurement"
};

function ledgerEvent(label: string): LedgerEvent {
  return {
    kind: "Qloo",
    label,
    summary: `summary for ${label}`,
    duration: 12,
    cacheState: "live",
    resultCount: 3
  };
}

afterEach(() => {
  useRunStore.getState().reset();
});

describe("run store", () => {
  it("starts as an empty projection", () => {
    const state = useRunStore.getState();

    expect(state.run).toBeNull();
    expect(state.connection).toBe("closed");
    expect(state.ledgerRows).toEqual([]);
    expect(state.evidence).toEqual([]);
    expect(state.apiError).toBeNull();
  });

  it("applyState replaces the run wholesale with exactly the server-sent object", () => {
    useRunStore.getState().applyState(TEST_RUN_STATE);
    expect(useRunStore.getState().run).toEqual(TEST_RUN_STATE);

    useRunStore.getState().applyState(SECOND_RUN_STATE);
    const run = useRunStore.getState().run;
    expect(run).toEqual(SECOND_RUN_STATE);
    expect(run).not.toEqual(TEST_RUN_STATE);
    expect(Object.keys(run ?? {}).sort()).toEqual(Object.keys(SECOND_RUN_STATE).sort());
  });

  it("applyState preserves accumulated ledger rows", () => {
    useRunStore.getState().applyLedger(ledgerEvent("one"), 1);
    useRunStore.getState().applyState(SECOND_RUN_STATE);

    expect(useRunStore.getState().run).toEqual(SECOND_RUN_STATE);
    expect(useRunStore.getState().ledgerRows.map((row) => row.sequence)).toEqual([1]);
  });

  it("applyEvidence holds the server's evidence projection across state reconciles", () => {
    const nodes: RunEvidenceNode[] = [
      { id: "ev-1", kind: "insights", summary: "Qloo insights observation - shared affinities" }
    ];
    useRunStore.getState().applyState(TEST_RUN_STATE);
    useRunStore.getState().applyEvidence(nodes);
    expect(useRunStore.getState().evidence).toEqual(nodes);

    // An SSE state frame carries RunState without the evidence projection;
    // the wholesale replace may swap `run` but must not destroy the slot.
    useRunStore.getState().applyState(SECOND_RUN_STATE);
    expect(useRunStore.getState().run).toEqual(SECOND_RUN_STATE);
    expect(useRunStore.getState().run?.evidence).toBeUndefined();
    expect(useRunStore.getState().evidence).toEqual(nodes);

    const refreshed: RunEvidenceNode[] = [
      { id: "ev-1", kind: "insights", summary: "Qloo insights observation - shared affinities" },
      { id: "ev-2", kind: "search", summary: "Qloo search observation - candidate places" }
    ];
    useRunStore.getState().applyEvidence(refreshed);
    expect(useRunStore.getState().evidence).toEqual(refreshed);
  });

  it("applyLedger appends the server-sent event with its sequence and fabricates nothing", () => {
    const event = ledgerEvent("reading local affinities");
    useRunStore.getState().applyLedger(event, 4);

    const rows = useRunStore.getState().ledgerRows;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sequence).toBe(4);
    expect(rows[0]?.event).toEqual(event);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["event", "sequence"]);
    expect(Object.keys(rows[0]?.event ?? {}).sort()).toEqual([
      "cacheState",
      "duration",
      "kind",
      "label",
      "resultCount",
      "summary"
    ]);
  });

  it("applyLedger drops stale and duplicate sequences (monotonic guard)", () => {
    const store = useRunStore.getState();

    store.applyLedger(ledgerEvent("five"), 5);
    useRunStore.getState().applyLedger(ledgerEvent("five-again"), 5);
    useRunStore.getState().applyLedger(ledgerEvent("four"), 4);
    useRunStore.getState().applyLedger(ledgerEvent("six"), 6);

    expect(useRunStore.getState().ledgerRows.map((row) => row.sequence)).toEqual([5, 6]);
  });

  it("applyLedger accepts a strictly increasing jump; contiguity is the SSE layer's job", () => {
    useRunStore.getState().applyLedger(ledgerEvent("one"), 1);
    useRunStore.getState().applyLedger(ledgerEvent("nine"), 9);

    expect(useRunStore.getState().ledgerRows.map((row) => row.sequence)).toEqual([1, 9]);
  });

  it("setConnection tracks the stream status", () => {
    useRunStore.getState().setConnection("connecting");
    expect(useRunStore.getState().connection).toBe("connecting");

    useRunStore.getState().setConnection("open");
    expect(useRunStore.getState().connection).toBe("open");
  });

  it("setError stores a server-sent error body and clears only when told", () => {
    const error: ApiErrorBody = {
      error: { code: "DEPENDENCY_UNAVAILABLE", message: "cultural data service down", requestId: "req-1" }
    };

    useRunStore.getState().setError(error);
    expect(useRunStore.getState().apiError).toEqual(error);

    // A later state reconcile must not silently erase a surfaced error.
    useRunStore.getState().applyState(TEST_RUN_STATE);
    expect(useRunStore.getState().apiError).toEqual(error);

    useRunStore.getState().setError(null);
    expect(useRunStore.getState().apiError).toBeNull();
  });

  it("reset restores the initial projection", () => {
    useRunStore.getState().applyState(TEST_RUN_STATE);
    useRunStore.getState().applyLedger(ledgerEvent("one"), 1);
    useRunStore.getState().applyEvidence([{ id: "ev-1", kind: "insights", summary: "observed" }]);
    useRunStore.getState().setConnection("open");

    useRunStore.getState().reset();

    const state = useRunStore.getState();
    expect(state.run).toBeNull();
    expect(state.connection).toBe("closed");
    expect(state.ledgerRows).toEqual([]);
    expect(state.evidence).toEqual([]);
    expect(state.apiError).toBeNull();
  });
});
