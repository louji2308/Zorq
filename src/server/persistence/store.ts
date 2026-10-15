import type { LedgerEntry } from "../agent/ledger.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { RunState } from "../../shared/run.js";
import type { Blueprint } from "../../shared/routes.js";

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

export interface BlueprintSnapshot {
  runId: string;
  shareToken: string;
  fingerprint: string;
  blueprint: Blueprint;
  createdAt: string;
  expiresAt: string;
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
  saveBlueprintSnapshot(snapshot: BlueprintSnapshot): Promise<void>;
  findBlueprintSnapshot(runId: string): Promise<BlueprintSnapshot | null>;
  findBlueprintSnapshotByShare(runId: string, shareToken: string): Promise<BlueprintSnapshot | null>;
  close?(): Promise<void>;
}
