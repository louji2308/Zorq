import { describe, expect, it } from "vitest";
import type { RunState } from "../../src/shared/run.js";
import { ApiError } from "../../src/shared/errors.js";
import { ledgerEventSchema } from "../../src/shared/events.js";
import { LlmBudget } from "../../src/server/agent/budget.js";
import { PLANNER_TURN_LIMIT, runController } from "../../src/server/agent/controller.js";
import {
  AgentStateError,
  AgentToolError,
  LlmBudgetError
} from "../../src/server/agent/errors.js";
import { createLedger } from "../../src/server/agent/ledger.js";
import { persistPrior } from "../../src/server/agent/prior.js";
import { createInitialRun, transitionRun } from "../../src/server/agent/state.js";
import { AGENT_TOOLS } from "../../src/server/agent/tools.js";
import { QlooUpstreamError } from "../../src/server/qloo/index.js";
import {
  TEST_BRIEF,
  TEST_NOW,
  TEST_PRIOR,
  fakeGateway,
  fakeLlm,
  okEnvelope,
  outageError,
  type FakeGatewayOptions
} from "./support/fakes.js";

function stateWithPrior(): RunState {
  const initial = createInitialRun(TEST_BRIEF);
  const stored = persistPrior(initial, TEST_PRIOR);
  return transitionRun(stored, "investigating", "investigation");
}

interface SetupOptions {
  responses: Parameters<typeof fakeLlm>[0];
  gateway?: FakeGatewayOptions;
  ceilingUsd?: number;
  preCharge?: "reserve" | "ceiling";
}

function setup(options: SetupOptions) {
  const ledger = createLedger();
  const budget = new LlmBudget({ ceilingUsd: options.ceilingUsd ?? 2, now: () => TEST_NOW });
  if (options.preCharge !== undefined) {
    const unit = { promptTokens: 1_000_000, completionTokens: 500_000 };
    budget.charge(unit);
    budget.charge(unit);
    if (options.preCharge === "ceiling") {
      budget.charge(unit);
      budget.charge(unit);
    }
  }
  const llm = fakeLlm(options.responses);
  const gateway = fakeGateway(options.gateway ?? {});
  return { ledger, budget, llm, gateway };
}

function baseOptions(s: ReturnType<typeof setup>, maxTurns?: number) {
  return {
    state: stateWithPrior(),
    brief: TEST_BRIEF,
    prior: TEST_PRIOR,
    gateway: s.gateway.gateway,
    llm: s.llm.client,
    budget: s.budget,
    ledger: s.ledger,
    now: () => TEST_NOW,
    ...(maxTurns !== undefined ? { maxTurns } : {})
  };
}

describe("bounded controller", () => {
  it("runs the full observation loop to a final answer within the turn cap", async () => {
    const s = setup({
      responses: [
        {
          content: "Probing local anchors first.",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz cafe", "take": 5}' }]
        },
        { content: "Evidence gathered: one anchor measured; downstream reading pending." }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("llm_final");
    expect(result.turns).toBe(2);
    expect(result.observations).toBe(1);
    expect(result.run.status).toBe("complete");
    expect(result.run.phase).toBe("investigation");
    expect(result.run.prior).toEqual(TEST_PRIOR);
    expect(result.finalText).toContain("Evidence gathered");
    expect(result.toolErrors).toHaveLength(0);
    expect(result.error).toBeUndefined();
    expect(s.llm.calls).toHaveLength(2);
    expect(s.llm.calls[0]?.tools).toHaveLength(AGENT_TOOLS.length);
    expect(s.gateway.calls).toHaveLength(1);

    const kinds = s.ledger.list().map((entry) => entry.event.kind);
    expect(kinds).toEqual(["LLM", "Qloo", "LLM"]);
    for (const entry of s.ledger.list()) {
      expect(ledgerEventSchema.parse(entry.event)).toEqual(entry.event);
    }
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.ledgerEventId).toBe(s.ledger.list()[1]?.id);
    expect(s.ledger.list()[2]?.event.label).toBe("investigate:turn 2/3");
  });

  it("enforces the planner turn cap deterministically", async () => {
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' }]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "coffee"}' }]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_3", name: "qloo_insights", arguments: '{"filterType": "heatmap"}' }]
        }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(PLANNER_TURN_LIMIT).toBe(3);
    expect(s.llm.calls).toHaveLength(3);
    expect(result.turns).toBe(3);
    expect(result.stopReason).toBe("turn_limit");
    expect(result.run.status).toBe("partial");
    expect(result.observations).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it("clamps an oversized turn-budget override to the locked cap", async () => {
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' }]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "coffee"}' }]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_3", name: "qloo_insights", arguments: '{"filterType": "heatmap"}' }]
        }
      ]
    });

    const result = await runController(baseOptions(s, 99));

    expect(s.llm.calls).toHaveLength(3);
    expect(result.stopReason).toBe("turn_limit");
    expect(result.run.status).toBe("partial");
  });

  it("records an honest partial state when Qloo goes down mid-loop", async () => {
    let gatewayCalls = 0;
    const s = setup({
      responses: [
        {
          content: "two probes",
          toolCalls: [
            { id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' },
            { id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "coffee"}' }
          ]
        }
      ],
      gateway: {
        onCall: () => {
          gatewayCalls += 1;
          if (gatewayCalls === 1) {
            return okEnvelope("search");
          }
          throw outageError();
        }
      }
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("outage");
    expect(result.error).toBeInstanceOf(QlooUpstreamError);
    expect((result.error as QlooUpstreamError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(result.run.status).toBe("partial");
    expect(result.run.phase).toBe("investigation");
    expect(result.run.prior).toEqual(TEST_PRIOR);
    expect(result.observations).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(s.llm.calls).toHaveLength(1);
    expect(result.finalText).toBeNull();

    const qlooEntries = s.ledger.list().filter((entry) => entry.event.kind === "Qloo");
    expect(qlooEntries).toHaveLength(1);
    expect(qlooEntries[0]?.event).toMatchObject({ label: "qloo_search", resultCount: 1, cacheState: "live" });
    expect(result.evidence[0]?.provenance.endpoint).toBe("https://hackathon.api.qloo.com/fake");
    expect(Object.keys(result.run).sort()).toEqual(["brief", "id", "phase", "prior", "status"]);
  });

  it("refuses non-essential turns once the budget reserve is reached", async () => {
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' }]
        }
      ],
      ceilingUsd: 1,
      preCharge: "reserve"
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("budget");
    expect(result.error).toBeInstanceOf(LlmBudgetError);
    expect((result.error as LlmBudgetError).code).toBe("LLM_BUDGET_RESERVE");
    expect(s.llm.calls).toHaveLength(0);
    expect(result.observations).toBe(0);
    expect(result.run.status).toBe("partial");
    expect(s.ledger.size()).toBe(0);
  });

  it("refuses everything once the locked ceiling is spent", async () => {
    const s = setup({
      responses: [],
      ceilingUsd: 1,
      preCharge: "ceiling"
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("budget");
    expect((result.error as LlmBudgetError).code).toBe("LLM_BUDGET_CEILING");
    expect(s.llm.calls).toHaveLength(0);
    expect(result.run.status).toBe("partial");
  });

  it("feeds malformed tool output back as a typed error instead of crashing", async () => {
    const s = setup({
      responses: [
        {
          content: "attempting a probe",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: "{not json" }]
        },
        { content: "The probe was rejected; nothing measured yet." }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("llm_final");
    expect(result.toolErrors).toHaveLength(1);
    expect(result.toolErrors[0]).toBeInstanceOf(AgentToolError);
    expect(result.toolErrors[0]?.reason).toBe("invalid_arguments");
    expect(result.toolErrors[0]?.toolName).toBe("qloo_search");
    expect(s.gateway.calls).toHaveLength(0);
    expect(result.evidence).toHaveLength(0);
    expect(result.observations).toBe(0);
    expect(result.run.status).toBe("partial");

    expect(s.llm.calls).toHaveLength(2);
    const secondTurn = s.llm.calls[1];
    const toolReply = secondTurn?.messages.find((message) => message.role === "tool");
    expect(toolReply).toBeDefined();
    expect(toolReply && "content" in toolReply ? toolReply.content : "").toContain("TOOL_REJECTED");
    expect(s.ledger.list().every((entry) => entry.event.kind === "LLM")).toBe(true);
  });

  it("rejects an unknown tool name with a typed error and no gateway traffic", async () => {
    const s = setup({
      responses: [
        {
          content: "bad tool",
          toolCalls: [{ id: "call_1", name: "qloo_divinate", arguments: "{}" }]
        },
        { content: "Stopped after the rejected call." }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(result.toolErrors[0]?.reason).toBe("unknown_tool");
    expect(s.gateway.calls).toHaveLength(0);
    expect(result.stopReason).toBe("llm_final");
    expect(result.run.status).toBe("partial");
  });

  it("surfaces a tool call without an id as a typed error", async () => {
    const s = setup({
      responses: [
        {
          content: "malformed",
          toolCalls: [{ id: "", name: "qloo_search", arguments: "{}" }]
        }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("llm_error");
    expect(result.error).toBeInstanceOf(AgentToolError);
    expect((result.error as AgentToolError).reason).toBe("malformed_call");
    expect(s.gateway.calls).toHaveLength(0);
    expect(result.run.status).toBe("partial");
  });

  it("refuses to start without a persisted Prior", async () => {
    const s = setup({ responses: [] });
    const priorless = createInitialRun(TEST_BRIEF);

    await expect(
      runController({
        ...baseOptions(s),
        state: priorless
      })
    ).rejects.toBeInstanceOf(AgentStateError);
    expect(s.gateway.calls).toHaveLength(0);
    expect(s.llm.calls).toHaveLength(0);
  });

  it("stops honestly when the model itself becomes unreachable", async () => {
    const s = setup({ responses: [] });
    s.llm.client.complete = async () => {
      throw new ApiError("DEPENDENCY_UNAVAILABLE", "DeepSeek request failed: connection refused");
    };

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("llm_error");
    expect(result.error).toBeInstanceOf(ApiError);
    expect((result.error as ApiError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(result.run.status).toBe("partial");
    expect(s.gateway.calls).toHaveLength(0);
    expect(s.ledger.size()).toBe(0);
    expect(result.observations).toBe(0);
  });
});
