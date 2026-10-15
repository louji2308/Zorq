import { createClient, type Client } from "@libsql/client";
import type { LedgerEntry } from "../agent/ledger.js";
import type { LedgerEvent } from "../../shared/events.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { RunState } from "../../shared/run.js";
import type { Blueprint } from "../../shared/routes.js";
import { EvidenceConflict, LedgerEventConflict, RunConflict, RunNotFound } from "./errors.js";
import type { BlueprintSnapshot, RunStore, StoredRun } from "./store.js";

export interface TursoStoreOptions {
  url: string;
  authToken?: string | undefined;
  now?: () => Date;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    phase TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ledger_events (
    run_id TEXT NOT NULL,
    id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    summary TEXT NOT NULL,
    duration REAL NOT NULL,
    cache_state TEXT NOT NULL,
    result_count INTEGER NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (run_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS evidence (
    run_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    record_json TEXT NOT NULL,
    PRIMARY KEY (run_id, evidence_id)
  )`,
  `CREATE TABLE IF NOT EXISTS blueprint_snapshots (
    run_id TEXT PRIMARY KEY,
    share_token TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    blueprint_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_events_run_sequence ON ledger_events (run_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS idx_blueprint_snapshots_share ON blueprint_snapshots (share_token)`
];

function isConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; extendedCode?: unknown };
  for (const value of [candidate.code, candidate.extendedCode]) {
    if (typeof value === "string" && value.toUpperCase().includes("CONSTRAINT")) {
      return true;
    }
  }
  return false;
}

function readText(row: Record<string, unknown>, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`unexpected column type for ${column}`);
  }
  return value;
}

function readNumber(row: Record<string, unknown>, column: string): number {
  const value = row[column];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  throw new Error(`unexpected column type for ${column}`);
}

function parseState(stateJson: string): RunState {
  return JSON.parse(stateJson) as RunState;
}

function parseEvent(eventJson: string): LedgerEvent {
  return JSON.parse(eventJson) as LedgerEvent;
}

function parseRecord(recordJson: string): EvidenceRecord {
  return JSON.parse(recordJson) as EvidenceRecord;
}

function parseBlueprintSnapshot(row: Record<string, unknown>): BlueprintSnapshot {
  return {
    runId: readText(row, "run_id"),
    shareToken: readText(row, "share_token"),
    fingerprint: readText(row, "fingerprint"),
    blueprint: parseBlueprint(readText(row, "blueprint_json")),
    createdAt: readText(row, "created_at"),
    expiresAt: readText(row, "expires_at")
  };
}

function parseBlueprint(blueprintJson: string): Blueprint {
  return JSON.parse(blueprintJson) as Blueprint;
}

async function requireRun(client: Client, runId: string): Promise<void> {
  const result = await client.execute({
    sql: "SELECT id FROM runs WHERE id = ?",
    args: [runId]
  });
  if (result.rows.length === 0) {
    throw new RunNotFound(runId);
  }
}

async function listLedger(client: Client, runId: string, afterSequence?: number): Promise<LedgerEntry[]> {
  const result =
    afterSequence === undefined
      ? await client.execute({
          sql: "SELECT id, sequence, event_json FROM ledger_events WHERE run_id = ? ORDER BY sequence ASC",
          args: [runId]
        })
      : await client.execute({
          sql: "SELECT id, sequence, event_json FROM ledger_events WHERE run_id = ? AND sequence > ? ORDER BY sequence ASC",
          args: [runId, afterSequence]
        });
  return result.rows.map((row) => {
    const record = row as unknown as Record<string, unknown>;
    return {
      id: readText(record, "id"),
      sequence: readNumber(record, "sequence"),
      event: parseEvent(readText(record, "event_json"))
    };
  });
}

async function listEvidenceRecords(client: Client, runId: string): Promise<EvidenceRecord[]> {
  const result = await client.execute({
    sql: "SELECT record_json FROM evidence WHERE run_id = ? ORDER BY evidence_id ASC",
    args: [runId]
  });
  return result.rows.map((row) => parseRecord(readText(row as unknown as Record<string, unknown>, "record_json")));
}

export async function createTursoStore(options: TursoStoreOptions): Promise<RunStore> {
  const client = createClient({ url: options.url, authToken: options.authToken });
  const now = options.now ?? ((): Date => new Date());

  for (const statement of SCHEMA_STATEMENTS) {
    await client.execute(statement);
  }

  const store: RunStore = {
    kind: "turso",

    async createRun(input) {
      const timestamp = iso(now());
      try {
        await client.execute({
          sql: "INSERT INTO runs (id, status, phase, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [input.id, input.state.status, input.state.phase, JSON.stringify(input.state), timestamp, timestamp]
        });
      } catch (error) {
        if (isConstraintError(error)) {
          throw new RunConflict(input.id);
        }
        throw error;
      }
    },

    async loadRun(id) {
      const result = await client.execute({
        sql: "SELECT id, status, phase, state_json, created_at, updated_at FROM runs WHERE id = ?",
        args: [id]
      });
      const row = result.rows[0];
      if (row === undefined) {
        return null;
      }
      const record = row as unknown as Record<string, unknown>;
      const ledger = await listLedger(client, id);
      const evidenceRecords = await listEvidenceRecords(client, id);
      return {
        id: readText(record, "id"),
        status: readText(record, "status"),
        phase: readText(record, "phase"),
        state: parseState(readText(record, "state_json")),
        createdAt: readText(record, "created_at"),
        updatedAt: readText(record, "updated_at"),
        ledger,
        evidence: evidenceRecords
      } satisfies StoredRun;
    },

    async saveRunState(id, state) {
      const result = await client.execute({
        sql: "UPDATE runs SET status = ?, phase = ?, state_json = ?, updated_at = ? WHERE id = ?",
        args: [state.status, state.phase, JSON.stringify(state), iso(now()), id]
      });
      if (result.rowsAffected === 0) {
        throw new RunNotFound(id);
      }
    },

    async appendLedgerEvent(runId, entry) {
      await requireRun(client, runId);
      try {
        await client.execute({
          sql: `INSERT INTO ledger_events (
            run_id, id, sequence, kind, label, summary, duration, cache_state, result_count, event_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            runId,
            entry.id,
            entry.sequence,
            entry.event.kind,
            entry.event.label,
            entry.event.summary,
            entry.event.duration,
            entry.event.cacheState,
            entry.event.resultCount,
            JSON.stringify(entry.event)
          ]
        });
      } catch (error) {
        if (isConstraintError(error)) {
          throw new LedgerEventConflict(runId, entry.id);
        }
        throw error;
      }
    },

    async appendEvidence(runId, record) {
      await requireRun(client, runId);
      try {
        await client.execute({
          sql: "INSERT INTO evidence (run_id, evidence_id, record_json) VALUES (?, ?, ?)",
          args: [runId, record.id, JSON.stringify(record)]
        });
      } catch (error) {
        if (isConstraintError(error)) {
          throw new EvidenceConflict(runId, record.id);
        }
        throw error;
      }
    },

    async listLedgerEvents(runId, afterSequence) {
      return listLedger(client, runId, afterSequence);
    },

    async listEvidence(runId) {
      return listEvidenceRecords(client, runId);
    },

    async saveBlueprintSnapshot(snapshot) {
      await client.execute({
        sql: `INSERT INTO blueprint_snapshots (run_id, share_token, fingerprint, blueprint_json, created_at, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (run_id) DO UPDATE SET
                share_token = excluded.share_token,
                fingerprint = excluded.fingerprint,
                blueprint_json = excluded.blueprint_json,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at`,
        args: [
          snapshot.runId,
          snapshot.shareToken,
          snapshot.fingerprint,
          JSON.stringify(snapshot.blueprint),
          snapshot.createdAt,
          snapshot.expiresAt
        ]
      });
    },

    async findBlueprintSnapshot(runId) {
      const result = await client.execute({
        sql: "SELECT run_id, share_token, fingerprint, blueprint_json, created_at, expires_at FROM blueprint_snapshots WHERE run_id = ?",
        args: [runId]
      });
      const row = result.rows[0];
      return row === undefined ? null : parseBlueprintSnapshot(row as unknown as Record<string, unknown>);
    },

    async findBlueprintSnapshotByShare(runId, shareToken) {
      const result = await client.execute({
        sql: `SELECT run_id, share_token, fingerprint, blueprint_json, created_at, expires_at
              FROM blueprint_snapshots WHERE run_id = ? AND share_token = ?`,
        args: [runId, shareToken]
      });
      const row = result.rows[0];
      return row === undefined ? null : parseBlueprintSnapshot(row as unknown as Record<string, unknown>);
    },

    async close() {
      client.close();
    }
  };

  return store;
}

function iso(date: Date): string {
  return date.toISOString();
}
