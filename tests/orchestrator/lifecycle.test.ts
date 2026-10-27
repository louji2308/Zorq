import { describe, expect, it } from "vitest";
import { runStateSchema } from "../../src/shared/run.js";
import { PriorGenerationError } from "../../src/server/agent/errors.js";
import { createOrchestrator, type OrchestratorEvent } from "../../src/server/orchestrator/index.js";
import { createMemoryStore } from "../../src/server/persistence/index.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE, waitForTerminalRun } from "./support.js";

describe("orchestrator lifecycle (startRun)", () => {
  it("locks a frozen Prior, advances prior -> investigation -> measurement, and lands a durable terminal run", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const gateway = fakeGateway();
    const events: OrchestratorEvent[] = [];
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW,
      eventSink: (event) => events.push(event)
    });

    const started = await orchestrator.startRun({ brief: TEST_BRIEF });
    expect(started.status).toBe("investigating");
    expect(started.prior).toBeDefined();
    const state = await waitForTerminalRun(store, started.id);

    expect(runStateSchema.safeParse(state).success).toBe(true);
    expect(state.status).toBe("complete");
    expect(state.phase).toBe("measurement");
    expect(state.prior).toBeDefined();
    expect(state.prior?.qlooUsed).toBe(false);
    expect(state.prior?.generatedAt).toBe(new Date(TEST_NOW).toISOString());
    expect(Object.isFrozen(state.prior)).toBe(true);
    expect(Object.isFrozen(state.prior?.composition)).toBe(true);

    const stored = await store.loadRun(state.id);
    expect(stored).not.toBeNull();
    expect(stored?.state.status).toBe("complete");
    expect(stored?.state.phase).toBe("measurement");

    const ledger = await store.listLedgerEvents(state.id);
    expect(ledger.map((entry) => entry.event.label)).toEqual([
      "prior:generate attempt 1",
      "investigate:turn 1/3",
      "qloo_search",
      "investigate:turn 2/3",
      "measure.compose"
    ]);
    expect(ledger.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(ledger[0]?.event.kind).toBe("LLM");
    expect(ledger.at(-1)?.event.kind).toBe("Compute");
    const firstQloo = ledger.find((entry) => entry.event.kind === "Qloo");
    expect(firstQloo).toBeDefined();
    expect(firstQloo?.sequence).toBeGreaterThan(ledger[0]?.sequence ?? 0);

    const evidence = await store.listEvidence(state.id);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.ledgerEventId).toBe(firstQloo?.id);
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.operation).toBe("search");

    expect(llm.calls[0]?.label).toBe("prior:generate attempt 1");
    const phases = events
      .filter((event) => event.type === "phase")
      .map((event) => (event.payload as { phase: string }).phase);
    expect(phases).toEqual(["investigation", "measurement"]);
    expect(events.filter((event) => event.type === "state").length).toBeGreaterThanOrEqual(2);
    expect(events.some((event) => event.type === "ledger")).toBe(true);
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
  });

  it("throws without persisting a run row when the Prior cannot be produced", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm([{ content: "garbage" }, { content: '{"composition": {}}' }]);
    const gateway = fakeGateway();
    const events: OrchestratorEvent[] = [];
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW,
      eventSink: (event) => events.push(event)
    });

    await expect(orchestrator.startRun({ brief: TEST_BRIEF })).rejects.toThrow(PriorGenerationError);
    expect(gateway.calls).toHaveLength(0);

    const failure = events.find((event) => event.type === "error");
    expect(failure).toBeDefined();
    expect((failure?.payload as { code?: string }).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(await store.loadRun(failure?.runId ?? "missing")).toBeNull();
  });
});
