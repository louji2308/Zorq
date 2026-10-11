/*
 * S1 stop flow — the ledger's only mutation goes through the REAL
 * POST /api/runs/:id/stop client (src/web/lib/api.ts). stopRunAction is a
 * thin injectable wrapper; the store only ever receives the server's own
 * stopped RunState projection (AGENTS §12/§13: the client never authors
 * numbers or fabricates a terminal state).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import { STOP_REASON, stopRunAction } from "../../src/web/screens/s1/stopAction.js";
import { describeRunStatus, isRunActive } from "../../src/web/screens/s1/s1Model.js";

const BRIEF = briefSchema.parse({
  location: "Crosby Street, Manhattan, New York 10012, United States",
  coordinates: { lat: 40.72466201611901, lon: -73.9963011816144 },
  radius: 400,
  objective: "A ground-floor place where downtown locals and visitors both feel they belong."
});

function stoppedRun(): RunState {
  return runStateSchema.parse({
    id: "run-stop-1",
    status: "stopped",
    phase: "investigation",
    brief: BRIEF,
    evidence: [{ id: "ev-1", kind: "qloo", label: "insights" }]
  });
}

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("stopRunAction", () => {
  it("calls the injected stop client with the run id and a stated reason", async () => {
    const stopped = stoppedRun();
    const stopRun = vi.fn(async (): Promise<RunState> => stopped);

    const result = await stopRunAction("run-stop-1", { stopRun });

    expect(stopRun).toHaveBeenCalledTimes(1);
    expect(stopRun).toHaveBeenCalledWith("run-stop-1", STOP_REASON);
    expect(result).toBe(stopped);
  });

  it("returns the server projection unchanged — the store never gets a client-authored state", async () => {
    const stopped = stoppedRun();

    const result = await stopRunAction("run-stop-1", { stopRun: async () => stopped });

    expect(result).toEqual(runStateSchema.parse(stopped));
    expect(Object.keys(result).sort()).toEqual(Object.keys(stopped).sort());
    expect(result.status).toBe("stopped");
  });

  it("propagates a failed stop so the route can surface the honest banner", async () => {
    await expect(
      stopRunAction("run-stop-1", {
        stopRun: async () => {
          throw new Error("network request failed");
        }
      })
    ).rejects.toThrow("network request failed");
  });

  it("POSTs the real stop route with the reason body when no client is injected", async () => {
    const stopped = stoppedRun();
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(JSON.stringify({ run: stopped }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await stopRunAction("run-stop-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(String(target)).toBe("/api/runs/run-stop-1/stop");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ reason: STOP_REASON });
    expect(result).toEqual(stopped);
  });
});

describe("stop visibility gating (what the route renders from)", () => {
  it("keeps the stop control only for resumable statuses", () => {
    expect(isRunActive("prior_pending")).toBe(true);
    expect(isRunActive("investigating")).toBe(true);
    expect(isRunActive("stopped")).toBe(false);
    expect(isRunActive("complete")).toBe(false);
    expect(isRunActive("partial")).toBe(false);
    expect(isRunActive("failed")).toBe(false);
  });

  it("describes every terminal status in honest plain language", () => {
    expect(describeRunStatus("stopped")).toBe("Stopped — showing the best so far");
    expect(describeRunStatus("partial")).toBe("Stopped early — partial results");
    expect(describeRunStatus("failed")).toBe("The investigation failed");
    expect(describeRunStatus("complete")).toBe("Investigation complete");
  });
});
