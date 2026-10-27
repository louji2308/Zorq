import { describe, expect, it } from "vitest";
import { createOrchestrator, type OrchestratorEvent } from "../../src/server/orchestrator/index.js";
import { RunConflict, type RunStore, createMemoryStore } from "../../src/server/persistence/index.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE, waitForTerminalRun } from "./support.js";

describe("orchestrator idempotency", () => {
  it("duplicate createRun surfaces RUN_CONFLICT once with a failure event", async () => {
    const store = createMemoryStore();
    const conflicting: RunStore = {
      ...store,
      async createRun(input) {
        await store.createRun(input);
        await store.createRun(input);
      }
    };
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, { content: PRIOR_RESPONSE }]);
    const gateway = fakeGateway();
    const events: OrchestratorEvent[] = [];
    const orchestrator = createOrchestrator({
      store: conflicting,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW,
      eventSink: (event) => events.push(event)
    });

    await expect(orchestrator.startRun({ brief: TEST_BRIEF })).rejects.toThrow(RunConflict);

    const failures = events.filter((event) => event.type === "error");
    expect(failures).toHaveLength(1);
    expect((failures[0]?.payload as { code?: string }).code).toBe("RUN_CONFLICT");
    expect(gateway.calls).toHaveLength(0);
  });

  it("two startRun calls create distinct runs", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      FINAL_TURN,
      { content: PRIOR_RESPONSE },
      TURN_ONE,
      FINAL_TURN
    ]);
    const gateway = fakeGateway();
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const a = await orchestrator.startRun({ brief: TEST_BRIEF });
    const aDone = await waitForTerminalRun(store, a.id);
    const b = await orchestrator.startRun({ brief: TEST_BRIEF });
    const bDone = await waitForTerminalRun(store, b.id);
    expect(a.id).not.toBe(b.id);
    expect(aDone.status).toBe("complete");
    expect(bDone.status).toBe("complete");
  });

  it("no-op resume/retry on a completed run append no ledger entries and spend no LLM", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const gateway = fakeGateway();
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const created = await orchestrator.startRun({ brief: TEST_BRIEF });
    const state = await waitForTerminalRun(store, created.id);
    expect(llm.calls).toHaveLength(3);
    const before = await store.listLedgerEvents(state.id);

    const resumed = await orchestrator.resumeRun(state.id);
    expect(resumed.status).toBe("complete");
    const afterResume = await store.listLedgerEvents(state.id);
    expect(afterResume.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));

    const retried = await orchestrator.retryRun(state.id);
    expect(retried.status).toBe("complete");
    const afterRetry = await store.listLedgerEvents(state.id);
    expect(afterRetry.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
    expect(llm.calls).toHaveLength(3);
  });
});
