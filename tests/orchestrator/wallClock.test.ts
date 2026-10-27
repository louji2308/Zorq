import { describe, expect, it } from "vitest";
import { createOrchestrator, type OrchestratorEvent } from "../../src/server/orchestrator/index.js";
import { createMemoryStore } from "../../src/server/persistence/index.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import { FINAL_TURN, PRIOR_RESPONSE, TURN_ONE, waitForTerminalRun } from "./support.js";

describe("orchestrator wall-clock cap", () => {
  it("caps an overlong investigation: partial status, no measurement, wall-clock ledger event", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    let clock = TEST_NOW;
    const llm = fakeLlm([
      { content: PRIOR_RESPONSE },
      () => {
        clock = TEST_NOW + 10_000;
        return TURN_ONE;
      },
      FINAL_TURN
    ]);
    const events: OrchestratorEvent[] = [];
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => clock,
      wallClockCapMs: 5_000,
      eventSink: (event) => events.push(event)
    });

    const started = await orchestrator.startRun({ brief: TEST_BRIEF });
    const state = await waitForTerminalRun(store, started.id);
    expect(state.status).toBe("partial");
    expect(state.status).not.toBe("complete");
    expect(state.prior?.qlooUsed).toBe(false);
    expect(Object.isFrozen(state.prior)).toBe(true);

    const ledger = await store.listLedgerEvents(state.id);
    const labels = ledger.map((entry) => entry.event.label);
    expect(labels).toContain("run.wall_clock_cap");
    expect(labels).not.toContain("measure.compose");
    expect(gateway.calls).toHaveLength(1);

    const cap = ledger.find((entry) => entry.event.label === "run.wall_clock_cap");
    expect(cap?.event.kind).toBe("Compute");
    expect(cap?.event.duration).toBe(10_000);
    expect(cap?.event.summary).toContain("5000ms");

    const persisted = await store.loadRun(state.id);
    expect(persisted?.state.status).toBe("partial");
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("caps when even the Prior exceeds the budget: partial with no investigation turn", async () => {
    const store = createMemoryStore();
    const gateway = fakeGateway();
    let clock = TEST_NOW;
    const llm = fakeLlm([
      () => {
        clock = TEST_NOW + 60_000;
        return { content: PRIOR_RESPONSE };
      }
    ]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => clock,
      wallClockCapMs: 10_000
    });

    const started = await orchestrator.startRun({ brief: TEST_BRIEF });
    const state = await waitForTerminalRun(store, started.id);
    expect(state.status).toBe("partial");
    expect(state.phase).toBe("investigation");
    expect(llm.calls).toHaveLength(1);
    expect(gateway.calls).toHaveLength(0);
    expect(Object.isFrozen(state.prior)).toBe(true);

    const ledger = await store.listLedgerEvents(state.id);
    expect(ledger.map((entry) => entry.event.label)).toEqual(["prior:generate attempt 1", "run.wall_clock_cap"]);
  });
});
