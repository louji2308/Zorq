export type RunStoreErrorCode =
  | "RUN_NOT_FOUND"
  | "RUN_CONFLICT"
  | "LEDGER_EVENT_CONFLICT"
  | "EVIDENCE_CONFLICT";

export class RunStoreError extends Error {
  readonly code: RunStoreErrorCode;

  constructor(code: RunStoreErrorCode, message: string) {
    super(message);
    this.name = "RunStoreError";
    this.code = code;
  }
}

export class RunNotFound extends RunStoreError {
  constructor(id: string) {
    super("RUN_NOT_FOUND", `run not found: ${id}`);
    this.name = "RunNotFound";
  }
}

export class RunConflict extends RunStoreError {
  constructor(id: string) {
    super("RUN_CONFLICT", `run already exists: ${id}`);
    this.name = "RunConflict";
  }
}

export class LedgerEventConflict extends RunStoreError {
  constructor(runId: string, entryId: string) {
    super("LEDGER_EVENT_CONFLICT", `ledger event already exists for run ${runId}: ${entryId}`);
    this.name = "LedgerEventConflict";
  }
}

export class EvidenceConflict extends RunStoreError {
  constructor(runId: string, evidenceId: string) {
    super("EVIDENCE_CONFLICT", `evidence already exists for run ${runId}: ${evidenceId}`);
    this.name = "EvidenceConflict";
  }
}
