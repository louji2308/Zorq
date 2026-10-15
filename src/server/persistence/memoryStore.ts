import type { LedgerEntry } from "../agent/ledger.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { RunState } from "../../shared/run.js";
import { EvidenceConflict, LedgerEventConflict, RunConflict, RunNotFound } from "./errors.js";
import type { BlueprintSnapshot, RunStore, StoredRun } from "./store.js";

export interface MemoryStoreOptions {
  now?: () => Date;
}

interface MemoryRun {
  state: RunState;
  createdAt: string;
  updatedAt: string;
}

function iso(date: Date): string {
  return date.toISOString();
}

export function createMemoryStore(options: MemoryStoreOptions = {}): RunStore {
  const now = options.now ?? ((): Date => new Date());
  const runs = new Map<string, MemoryRun>();
  const ledger = new Map<string, Map<string, LedgerEntry>>();
  const evidence = new Map<string, Map<string, EvidenceRecord>>();
  const snapshots = new Map<string, BlueprintSnapshot>();

  const sortedLedger = (runId: string): LedgerEntry[] => {
    const entries = [...(ledger.get(runId)?.values() ?? [])];
    return entries.sort((a, b) => a.sequence - b.sequence);
  };

  return {
    kind: "memory",

    async createRun(input) {
      if (runs.has(input.id)) {
        throw new RunConflict(input.id);
      }
      const timestamp = iso(now());
      runs.set(input.id, {
        state: structuredClone(input.state),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    },

    async loadRun(id) {
      const run = runs.get(id);
      if (run === undefined) {
        return null;
      }
      return {
        id,
        status: run.state.status,
        phase: run.state.phase,
        state: structuredClone(run.state),
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        ledger: structuredClone(sortedLedger(id)),
        evidence: structuredClone([...(evidence.get(id)?.values() ?? [])])
      } satisfies StoredRun;
    },

    async saveRunState(id, state) {
      const run = runs.get(id);
      if (run === undefined) {
        throw new RunNotFound(id);
      }
      run.state = structuredClone(state);
      run.updatedAt = iso(now());
    },

    async appendLedgerEvent(runId, entry) {
      if (!runs.has(runId)) {
        throw new RunNotFound(runId);
      }
      const entries = ledger.get(runId) ?? new Map<string, LedgerEntry>();
      if (entries.has(entry.id)) {
        throw new LedgerEventConflict(runId, entry.id);
      }
      entries.set(entry.id, structuredClone(entry));
      ledger.set(runId, entries);
    },

    async appendEvidence(runId, record) {
      if (!runs.has(runId)) {
        throw new RunNotFound(runId);
      }
      const records = evidence.get(runId) ?? new Map<string, EvidenceRecord>();
      if (records.has(record.id)) {
        throw new EvidenceConflict(runId, record.id);
      }
      records.set(record.id, structuredClone(record));
      evidence.set(runId, records);
    },

    async listLedgerEvents(runId, afterSequence) {
      const entries = sortedLedger(runId);
      const filtered =
        afterSequence === undefined ? entries : entries.filter((entry) => entry.sequence > afterSequence);
      return structuredClone(filtered);
    },

    async listEvidence(runId) {
      return structuredClone([...(evidence.get(runId)?.values() ?? [])]);
    },

    async saveBlueprintSnapshot(snapshot) {
      if (!runs.has(snapshot.runId)) {
        throw new RunNotFound(snapshot.runId);
      }
      snapshots.set(snapshot.runId, structuredClone(snapshot));
    },

    async findBlueprintSnapshot(runId) {
      const snapshot = snapshots.get(runId);
      return snapshot === undefined ? null : structuredClone(snapshot);
    },

    async findBlueprintSnapshotByShare(runId, shareToken) {
      const snapshot = snapshots.get(runId);
      if (snapshot === undefined || snapshot.shareToken !== shareToken) {
        return null;
      }
      return structuredClone(snapshot);
    }
  };
}
