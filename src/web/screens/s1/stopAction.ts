/*
 * Stop action for the S1 ledger (Final Design §7.1: tertiary
 * "Stop and show best so far"). A thin, injectable wrapper over the REAL
 * POST /api/runs/:id/stop client (src/web/lib/api.ts) — the store receives
 * only the server-returned RunState projection.
 */
import { stopRun as stopRunClient, type ApiCallOptions } from "../../lib/api.js";
import type { RunState } from "../../../shared/run.js";

export interface StopDeps {
  stopRun?: (id: string, reason?: string, options?: ApiCallOptions) => Promise<RunState>;
}

export const STOP_REASON = "stopped by the user from the S1 ledger";

/** Calls the real stop route and returns the server's stopped projection. */
export async function stopRunAction(runId: string, deps?: StopDeps): Promise<RunState> {
  const impl = deps?.stopRun ?? stopRunClient;
  return impl(runId, STOP_REASON);
}
