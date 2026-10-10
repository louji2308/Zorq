import { ApiError, type ApiErrorDetail } from "../../shared/errors.js";

export class OrchestratorStateError extends ApiError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super("CONFLICT", message, details);
    this.name = "OrchestratorStateError";
  }
}

export class RunBusyError extends ApiError {
  constructor(runId: string) {
    super("CONFLICT", `run ${runId} already has an active orchestration pass in this process`, [
      { path: "runId", message: "wait for the active pass to finish before resuming or retrying" }
    ]);
    this.name = "RunBusyError";
  }
}
