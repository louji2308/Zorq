/*
 * S1 retry action: a thin wrapper around the real retry route. The server owns
 * the status transition and the resumed run; the browser only applies the
 * returned RunState projection.
 */
import { retryRun as retryRunClient, type ApiCallOptions } from "../../lib/api.js";
import type { RunState } from "../../../shared/run.js";

export interface RetryDeps {
  retryRun?: (id: string, options?: ApiCallOptions) => Promise<RunState>;
}

export function retryRunAction(runId: string, deps?: RetryDeps): Promise<RunState> {
  const impl = deps?.retryRun ?? retryRunClient;
  return impl(runId);
}
