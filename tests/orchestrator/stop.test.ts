import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmCompletionRequest, LlmCompletionResult } from "../../src/server/agent/llm.js";
import { RunBusyError, createOrchestrator } from "../../src/server/orchestrator/index.js";
import { RunNotFound, createMemoryStore } from "../../src/server/persistence/index.js";
import type { RunState } from "../../src/shared/run.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE, completion, deferred } from "./support.js";

function gatedLlm(gate: Promise<void>, onInvestigate?: () => void): LlmClient {
  return {
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
      if (request.label.startsWith("prior")) return completion(PRIOR_RESPONSE);
      onInvestigate?.();
      await gate;
      return completion(FINAL_TURN.content);
    }
  };
}

describe("orchestrator stopRun", () => {
  it("stops mid-investigation with a single run.stopped marker and keeps the Prior", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const gate = deferred();
    const reached = deferred();
    const llm = gatedLlm(gate.promise, reached.resolve);
    const firstState = deferred<RunState>();
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm,
      now: () => TEST_NOW,
      eventSink: (event) => {
        if (event.type === "state") firstState.resolve(event.payload as RunState);
      }
    });

    const runPromise = orchestrator.startRun({ brief: TEST_BRIEF });
    const started = await firstState.promise;
    await reached.promise;

    const stopped = await orchestrator.stopRun(started.id, "judge pressed stop");
    expect(stopped.status).toBe("stopped");
    expect(stopped.phase).toBe("investigation");
    expect(stopped.prior?.qlooUsed).toBe(false);
    expect(Object.isFrozen(stopped.prior)).toBe(true);

    gate.resolve();
    const final = await runPromise;
    expect(final.status).toBe("stopped");
    expect(final.phase).toBe("investigation");

    const ledger = await store.listLedgerEvents(started.id);
    const stoppedEntries = ledger.filter((entry) => entry.event.label === "run.stopped");
    expect(stoppedEntries).toHaveLength(1);
    expect(stoppedEntries[0]?.event.kind).toBe("Compute");
    expect(stoppedEntries[0]?.event.summary).toContain("judge pressed stop");
    expect(ledger.some((entry) => entry.event.label === "measure.compose")).toBe(false);

    const again = await orchestrator.stopRun(started.id, "second stop");
    expect(again.status).toBe("stopped");
    const afterDouble = await store.listLedgerEvents(started.id);
    expect(afterDouble.filter((entry) => entry.event.label === "run.stopped")).toHaveLength(1);
  });

  it("is a no-op on a terminal run and rejects unknown runs", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const done = await orchestrator.startRun({ brief: TEST_BRIEF });
    expect(done.status).toBe("complete");
    const before = await store.listLedgerEvents(done.id);

    const late = await orchestrator.stopRun(done.id, "late stop");
    expect(late.status).toBe("complete");
    const after = await store.listLedgerEvents(done.id);
    expect(after.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));

    await expect(orchestrator.stopRun(randomUUID(), "unknown")).rejects.toThrow(RunNotFound);
  });

  it("rejects concurrent resume/retry with RunBusyError", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const gate = deferred();
    const reached = deferred();
    const llm = gatedLlm(gate.promise, reached.resolve);
    const firstState = deferred<RunState>();
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm,
      now: () => TEST_NOW,
      eventSink: (event) => {
        if (event.type === "state") firstState.resolve(event.payload as RunState);
      }
    });

    const runPromise = orchestrator.startRun({ brief: TEST_BRIEF });
    const started = await firstState.promise;
    await reached.promise;

    await expect(orchestrator.resumeRun(started.id)).rejects.toThrow(RunBusyError);
    await expect(orchestrator.retryRun(started.id)).rejects.toThrow(RunBusyError);

    gate.resolve();
    await runPromise;
  });
});
