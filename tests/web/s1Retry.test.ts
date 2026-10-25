import { afterEach, describe, expect, it, vi } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import { retryRunAction } from "../../src/web/screens/s1/retryAction.js";
import { buildRunRecoveryModel, isRunRetryable, RETRY_COPY } from "../../src/web/screens/s1/s1Model.js";

const BRIEF = briefSchema.parse({
  location: "Crosby Street, Manhattan, New York 10012, United States",
  coordinates: { lat: 40.72466201611901, lon: -73.9963011816144 },
  radius: 400,
  objective: "A ground-floor place where downtown locals and visitors both feel they belong."
});

function stoppedRun(): RunState {
  return runStateSchema.parse({
    id: "run-retry-1",
    status: "stopped",
    phase: "investigation",
    brief: BRIEF,
    prior: {
      composition: { thesis: "from brief" },
      generatedAt: "2026-10-25T00:00:00.000Z",
      model: "qwen/qwen3.7-flash-2026-07-15",
      qlooUsed: false
    }
  });
}

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("S1 retry recovery model", () => {
  it("offers recovery copy only for retryable terminal statuses", () => {
    expect(isRunRetryable("stopped")).toBe(true);
    expect(isRunRetryable("partial")).toBe(true);
    expect(isRunRetryable("failed")).toBe(true);
    expect(isRunRetryable("complete")).toBe(false);
    expect(buildRunRecoveryModel("partial")?.message).toBe(RETRY_COPY.partial);
    expect(buildRunRecoveryModel("complete")).toBeNull();
  });
});

describe("retryRunAction", () => {
  it("calls the injected retry client with only the run id", async () => {
    const retried = runStateSchema.parse({ ...stoppedRun(), status: "investigating" });
    const retryRun = vi.fn(async (): Promise<RunState> => retried);

    const result = await retryRunAction("run-retry-1", { retryRun });

    expect(retryRun).toHaveBeenCalledTimes(1);
    expect(retryRun).toHaveBeenCalledWith("run-retry-1");
    expect(result).toEqual(retried);
  });
});
