/*
 * Run-state store: a Zustand projection of the server's RunState (ARCH §17) —
 * a view, never a second source of truth.
 *
 * Rules:
 *  - `applyState` replaces `run` wholesale with the server-sent projection; it
 *    never merges, never derives, never fills gaps. Ledger history survives
 *    state reconciles (the ledger is durable server-side and streamed
 *    separately; RunState does not contain it).
 *  - `applyEvidence` replaces the evidence projection wholesale with the
 *    server's list from GET /api/runs/:id (the authoritative replay source).
 *    Evidence survives state reconciles for the same reason ledger history
 *    does: SSE state frames and mutation responses (replace/stop) return
 *    RunState without the evidence projection, so a state frame must never be
 *    able to destroy what a GET returned. Views prefer a server-sent
 *    `run.evidence` when a frame carries one and fall back to this slot.
 *  - `applyLedger` appends a server-sent ledger event under a monotonic guard:
 *    only sequences strictly greater than the last stored row are accepted, so
 *    replayed duplicates and stale frames cannot double-render. Contiguity
 *    enforcement lives in lib/sse.ts (the stream owner); the store guard is the
 *    second line of defence.
 *  - No numeric derivations: every number on screen comes from the server.
 *    `LedgerRow.sequence` is the server's own frame id, not a client invention.
 *  - `apiError` is only ever set from a server-sent typed error body; it is
 *    cleared explicitly (setError(null)) or by reset, never by guessing.
 *
 * Intended wiring (W-6.3): createRunEventStream({ onState: applyState,
 * onLedger: applyLedger, onErrorFrame: setError, onConnection: setConnection,
 * onTerminal: refresh from GET then applyState + applyEvidence }). Evidence is
 * seeded by the route after every GET /api/runs/:id, never derived locally.
 */
import { create } from "zustand";
import type { ApiErrorBody } from "../../shared/errors.js";
import type { LedgerEvent } from "../../shared/events.js";
import type { RunEvidenceNode, RunState } from "../../shared/run.js";
import type { ConnectionStatus } from "../lib/sse.js";

export interface LedgerRow {
  readonly sequence: number;
  readonly event: LedgerEvent;
}

export interface RunStoreState {
  run: RunState | null;
  connection: ConnectionStatus;
  ledgerRows: LedgerRow[];
  evidence: RunEvidenceNode[];
  apiError: ApiErrorBody | null;
}

export interface RunStoreActions {
  applyState(run: RunState): void;
  applyLedger(event: LedgerEvent, sequence: number): void;
  applyEvidence(evidence: RunEvidenceNode[]): void;
  setConnection(status: ConnectionStatus): void;
  setError(error: ApiErrorBody | null): void;
  reset(): void;
}

export type RunStore = RunStoreState & RunStoreActions;

function initialState(): RunStoreState {
  return {
    run: null,
    connection: "closed",
    ledgerRows: [],
    evidence: [],
    apiError: null
  };
}

export const useRunStore = create<RunStore>()((set) => ({
  ...initialState(),

  applyState(run) {
    set({ run });
  },

  applyLedger(event, sequence) {
    set((state) => {
      const lastRow = state.ledgerRows[state.ledgerRows.length - 1];
      if (lastRow !== undefined && sequence <= lastRow.sequence) {
        return state;
      }
      return { ledgerRows: [...state.ledgerRows, { sequence, event }] };
    });
  },

  applyEvidence(evidence) {
    set({ evidence });
  },

  setConnection(status) {
    set({ connection: status });
  },

  setError(error) {
    set({ apiError: error });
  },

  reset() {
    set(initialState());
  }
}));
