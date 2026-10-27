import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmCompletionRequest, LlmCompletionResult } from "../../src/server/agent/llm.js";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import { createOrchestrator, rehydrateRun } from "../../src/server/orchestrator/index.js";
import { RunNotFound, type RunStore, createMemoryStore } from "../../src/server/persistence/index.js";
import type { RunState } from "../../src/shared/run.js";
import { TEST_BRIEF, TEST_NOW, TEST_PRIOR, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import {
  FINAL_TURN,
  PRIOR_RESPONSE,
  TURN_ONE,
  completion,
  deferred,
  retryWhenIdle,
  waitForTerminalRun
} from "./support.js";

type ScriptStep = (request: LlmCompletionRequest) => Promise<LlmCompletionResult> | LlmCompletionResult;

interface ScriptLlm {
  client: LlmClient;
  calls: LlmCompletionRequest[];
}

function scriptLlm(steps: readonly ScriptStep[]): ScriptLlm {
  const calls: LlmCompletionRequest[] = [];
  const client: LlmClient = {
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
      const index = calls.length;
      calls.push({ ...request, messages: [...request.messages] });
      const step = steps[index];
      if (step === undefined) {
        throw new Error(`script llm: unexpected call #${index + 1} ("${request.label}") with no scripted step`);
      }
      return await step(request);
    }
  };
  return { client, calls };
}

function seededEntry(sequence: number, label: string, kind: "Compute" | "LLM" = "Compute"): LedgerEntry {
  return {
    id: randomUUID(),
    sequence,
    event: { kind, label, summary: `seeded ${label}`, duration: 0, cacheState: "n/a", resultCount: 0 }
  };
}

async function craftRun(
  store: RunStore,
  options: { status: string; phase: string; ledger?: readonly LedgerEntry[] }
): Promise<string> {
  const id = randomUUID();
  await store.createRun({
    id,
    state: { id, status: options.status, phase: options.phase, brief: TEST_BRIEF, prior: TEST_PRIOR }
  });
  for (const entry of options.ledger ?? []) {
    await store.appendLedgerEvent(id, entry);
  }
  return id;
}

function expectStrictlyIncreasingUnique(ledger: readonly LedgerEntry[]): void {
  for (let i = 1; i < ledger.length; i += 1) {
    expect(ledger[i]!.sequence).toBeGreaterThan(ledger[i - 1]!.sequence);
  }
  expect(new Set(ledger.map((entry) => entry.id)).size).toBe(ledger.length);
  expect(new Set(ledger.map((entry) => entry.sequence)).size).toBe(ledger.length);
}

describe("orchestrator recovery", () => {
  it("stops mid-investigation, then retries to a terminal run with a frozen Prior and an append-only ledger", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const gate = deferred();
    const investigating = deferred();
    const firstState = deferred<RunState>();
    const llm = scriptLlm([
      () => completion(PRIOR_RESPONSE),
      async () => {
        investigating.resolve();
        await gate.promise;
        return completion(FINAL_TURN.content);
      },
      () => completion(TURN_ONE.content ?? "", TURN_ONE.toolCalls ?? []),
      () => completion(FINAL_TURN.content)
    ]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW,
      eventSink: (event) => {
        if (event.type === "state") {
          firstState.resolve(event.payload as RunState);
        }
      }
    });

    void orchestrator.startRun({ brief: TEST_BRIEF });
    const started = await firstState.promise;
    await investigating.promise;

    const stopped = await orchestrator.stopRun(started.id, "judge pressed stop");
    expect(stopped.status).toBe("stopped");
    expect(stopped.phase).toBe("investigation");
    expect(Object.isFrozen(stopped.prior)).toBe(true);
    const priorSnapshot = JSON.parse(JSON.stringify(stopped.prior)) as unknown;

    gate.resolve();
    const afterGate = await waitForTerminalRun(store, started.id);
    expect(afterGate.status).toBe("stopped");

    const retried = await retryWhenIdle(orchestrator, started.id);
    expect(retried.status).toBe("complete");
    expect(retried.phase).toBe("measurement");
    expect(retried.id).toBe(started.id);

    const stored = await store.loadRun(started.id);
    expect(stored).not.toBeNull();
    if (stored === null) {
      return;
    }
    expect(stored.state.status).toBe("complete");
    expect(stored.state.prior).toEqual(priorSnapshot);
    const rehydrated = rehydrateRun(stored);
    expect(Object.isFrozen(rehydrated.prior)).toBe(true);
    expect(Object.isFrozen(rehydrated.prior?.composition)).toBe(true);

    const ledger = await store.listLedgerEvents(started.id);
    const stoppedMarkers = ledger.filter((entry) => entry.event.label === "run.stopped");
    expect(stoppedMarkers).toHaveLength(1);
    expect(stoppedMarkers[0]?.event.summary).toContain("judge pressed stop");
    expectStrictlyIncreasingUnique(ledger);

    const evidence = await store.listEvidence(started.id);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps a double stop idempotent: one marker, same status", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });
    const id = await craftRun(store, {
      status: "investigating",
      phase: "investigation",
      ledger: [seededEntry(1, "prior:generate attempt 1", "LLM")]
    });

    const first = await orchestrator.stopRun(id, "operator pressed stop");
    expect(first.status).toBe("stopped");
    const second = await orchestrator.stopRun(id, "operator pressed stop again");
    expect(second.status).toBe("stopped");
    expect(second.id).toBe(id);

    const stored = await store.loadRun(id);
    expect(stored?.state.status).toBe("stopped");
    const ledger = await store.listLedgerEvents(id);
    const stoppedMarkers = ledger.filter((entry) => entry.event.label === "run.stopped");
    expect(stoppedMarkers).toHaveLength(1);
    expect(stoppedMarkers[0]?.event.summary).toContain("operator pressed stop");
    expectStrictlyIncreasingUnique(ledger);
  });

  it("treats a stop after completion as a no-op and appends no marker", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const created = await orchestrator.startRun({ brief: TEST_BRIEF });
    const done = await waitForTerminalRun(store, created.id);
    expect(done.status).toBe("complete");
    const before = await store.listLedgerEvents(done.id);

    const late = await orchestrator.stopRun(done.id, "late stop");
    expect(late.status).toBe("complete");
    const after = await store.listLedgerEvents(done.id);
    expect(after.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
    expect(after.filter((entry) => entry.event.label === "run.stopped")).toHaveLength(0);
  });

  it("resumes a crafted in-flight run to a terminal state, keeping the frozen Prior and the old ledger intact", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([TURN_ONE, FINAL_TURN]);
    const seeded = [
      seededEntry(1, "prior:generate attempt 1", "LLM"),
      seededEntry(2, "investigate:turn 1/3", "LLM")
    ];
    const id = await craftRun(store, {
      status: "investigating",
      phase: "investigation",
      ledger: seeded
    });
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const resumed = await orchestrator.resumeRun(id);
    expect(resumed.status).toBe("complete");
    expect(resumed.phase).toBe("measurement");
    expect(resumed.prior).toEqual(TEST_PRIOR);
    expect(Object.isFrozen(resumed.prior)).toBe(true);

    const ledger = await store.listLedgerEvents(id);
    for (const old of seeded) {
      expect(ledger.find((entry) => entry.id === old.id)).toEqual(old);
    }
    expectStrictlyIncreasingUnique(ledger);
    expect(ledger.at(-1)?.event.label).toBe("measure.compose");

    const stored = await store.loadRun(id);
    expect(stored).not.toBeNull();
    if (stored === null) {
      return;
    }
    expect(stored.state.status).toBe("complete");
    expect(stored.state.prior).toEqual(TEST_PRIOR);
    const rehydrated = rehydrateRun(stored);
    expect(Object.isFrozen(rehydrated.prior)).toBe(true);
    expect(Object.isFrozen(rehydrated.prior?.composition)).toBe(true);
  });

  it("retries after a forced failure as a new attempt with an unchanged Prior and append-only history", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([
      { content: PRIOR_RESPONSE },
      () => {
        throw new Error("simulated mid-investigation crash");
      },
      TURN_ONE,
      FINAL_TURN
    ]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const created = await orchestrator.startRun({ brief: TEST_BRIEF });
    const failed = await waitForTerminalRun(store, created.id);
    expect(failed.status).toBe("failed");
    const priorSnapshot = JSON.parse(JSON.stringify(failed.prior)) as unknown;
    const before = await store.listLedgerEvents(failed.id);
    expect(before.some((entry) => entry.event.label === "run.error")).toBe(true);

    const retried = await retryWhenIdle(orchestrator, failed.id);
    expect(retried.status).toBe("complete");
    expect(JSON.parse(JSON.stringify(retried.prior))).toEqual(priorSnapshot);

    const after = await store.listLedgerEvents(failed.id);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.slice(0, before.length).map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
    expectStrictlyIncreasingUnique(after);
    expect(after.filter((entry) => entry.event.label === "run.error")).toHaveLength(1);

    const stored = await store.loadRun(failed.id);
    expect(stored?.state.status).toBe("complete");
    expect(stored?.state.prior).toEqual(priorSnapshot);
  });

  it("makes zero new LLM calls when resuming a completed run", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    const created = await orchestrator.startRun({ brief: TEST_BRIEF });
    const done = await waitForTerminalRun(store, created.id);
    expect(done.status).toBe("complete");
    expect(llm.calls).toHaveLength(3);
    const before = await store.listLedgerEvents(done.id);

    const resumed = await orchestrator.resumeRun(done.id);
    expect(resumed.status).toBe("complete");
    expect(llm.calls).toHaveLength(3);

    const after = await store.listLedgerEvents(done.id);
    expect(after.map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
  });

  it("rejects stop, resume and retry of an unknown run id with RunNotFound", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    const llm = fakeLlm([]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    await expect(orchestrator.stopRun(randomUUID())).rejects.toThrow(RunNotFound);
    await expect(orchestrator.resumeRun(randomUUID())).rejects.toThrow(RunNotFound);
    await expect(orchestrator.retryRun(randomUUID())).rejects.toThrow(RunNotFound);
  });
});
