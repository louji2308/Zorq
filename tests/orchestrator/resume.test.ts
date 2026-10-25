import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LlmBudget } from "../../src/server/agent/budget.js";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import { createOrchestrator } from "../../src/server/orchestrator/index.js";
import { RunNotFound, type RunStore, createMemoryStore } from "../../src/server/persistence/index.js";
import type { RunState } from "../../src/shared/run.js";
import { TEST_BRIEF, TEST_NOW, TEST_PRIOR, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, TURN_ONE } from "./support.js";

const PRIOR_EVENT: LedgerEntry = {
  id: randomUUID(),
  sequence: 1,
  event: {
    kind: "LLM",
    label: "prior:generate attempt 1",
    summary: "model qwen/qwen3.7-flash-2026-07-15 | 1200 in / 480 out",
    duration: 12,
    cacheState: "n/a",
    resultCount: 1
  }
};

const STOPPED_EVENT: LedgerEntry = {
  id: randomUUID(),
  sequence: 2,
  event: {
    kind: "Compute",
    label: "run.stopped",
    summary: "run stopped: operator request",
    duration: 0,
    cacheState: "n/a",
    resultCount: 0
  }
};

async function craftRun(store: RunStore, status: string, phase: string, ledger: LedgerEntry[]): Promise<string> {
  const id = randomUUID();
  const state: RunState = { id, status, phase, brief: TEST_BRIEF, prior: TEST_PRIOR };
  await store.createRun({ id, state });
  for (const entry of ledger) {
    await store.appendLedgerEvent(id, entry);
  }
  return id;
}

describe("orchestrator resumeRun / retryRun", () => {
  it("resumes an in-flight investigation to a terminal run without regenerating the Prior", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([TURN_ONE, FINAL_TURN]);
    const gateway = fakeGateway();
    const id = await craftRun(store, "investigating", "investigation", [PRIOR_EVENT]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const state = await orchestrator.resumeRun(id);
    expect(state.status).toBe("complete");
    expect(state.phase).toBe("measurement");
    expect(Object.isFrozen(state.prior)).toBe(true);
    expect(Object.isFrozen(state.prior?.composition)).toBe(true);

    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0]?.label).toBe("investigate:turn 1/3");
    expect(llm.calls.map((call) => call.label)).not.toContain("prior:generate attempt 1");

    const ledger = await store.listLedgerEvents(id);
    expect(ledger.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(ledger[0]?.event.label).toBe("prior:generate attempt 1");
    expect(ledger.at(-1)?.event.label).toBe("measure.compose");
  });

  it("resume and retry of a terminal run are no-ops with no LLM spend", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([]);
    const gateway = fakeGateway();
    const id = await craftRun(store, "complete", "measurement", [PRIOR_EVENT]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const resumed = await orchestrator.resumeRun(id);
    expect(resumed.status).toBe("complete");
    expect(Object.isFrozen(resumed.prior)).toBe(true);
    expect(llm.calls).toHaveLength(0);

    const retried = await orchestrator.retryRun(id);
    expect(retried.status).toBe("complete");
    expect(llm.calls).toHaveLength(0);

    const ledger = await store.listLedgerEvents(id);
    expect(ledger.map((entry) => entry.id)).toEqual([PRIOR_EVENT.id]);
  });

  it("retry after stop re-enters investigation without regenerating the Prior", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([TURN_ONE, FINAL_TURN]);
    const gateway = fakeGateway();
    const id = await craftRun(store, "stopped", "investigation", [PRIOR_EVENT, STOPPED_EVENT]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const state = await orchestrator.retryRun(id);
    expect(state.status).toBe("complete");
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0]?.label).toBe("investigate:turn 1/3");

    const ledger = await store.listLedgerEvents(id);
    expect(ledger.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ledger[1]?.event.label).toBe("run.stopped");
    expect(ledger.at(-1)?.event.label).toBe("measure.compose");
  });

  it("retry with an exhausted LLM budget returns an honest partial with zero spend", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([]);
    const gateway = fakeGateway();
    const exhausted = new LlmBudget({ ceilingUsd: 0, now: () => TEST_NOW });
    const id = await craftRun(store, "failed", "investigation", [PRIOR_EVENT]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      budget: exhausted,
      now: () => TEST_NOW
    });

    const state = await orchestrator.retryRun(id);
    expect(state.status).toBe("partial");
    expect(llm.calls).toHaveLength(0);
    expect(gateway.calls).toHaveLength(0);

    const ledger = await store.listLedgerEvents(id);
    expect(ledger.some((entry) => entry.event.label === "measure.compose")).toBe(true);
  });

  it("resume and retry of unknown runs reject with RunNotFound", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    await expect(orchestrator.resumeRun(randomUUID())).rejects.toThrow(RunNotFound);
    await expect(orchestrator.retryRun(randomUUID())).rejects.toThrow(RunNotFound);
  });
});
