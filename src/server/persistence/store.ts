import type { LedgerEntry } from "../agent/ledger.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { RunState } from "../../shared/run.js";

export type RunStoreKind = "memory" | "turso";

export interface StoredRun {
  id: string;
  status: string;
  phase: string;
  state: RunState;
  createdAt: string;
  updatedAt: string;
  ledger: LedgerEntry[];
  evidence: EvidenceRecord[];
}

export interface CreateRunInput {
  id: string;
  state: RunState;
}

export interface RunStore {
  readonly kind: RunStoreKind;
  createRun(input: CreateRunInput): Promise<void>;
  loadRun(id: string): Promise<StoredRun | null>;
  saveRunState(id: string, state: RunState): Promise<void>;
  appendLedgerEvent(runId: string, entry: LedgerEntry): Promise<void>;
  appendEvidence(runId: string, record: EvidenceRecord): Promise<void>;
  listLedgerEvents(runId: string, afterSequence?: number): Promise<LedgerEntry[]>;
  listEvidence(runId: string): Promise<EvidenceRecord[]>;
  close?(): Promise<void>;
}
