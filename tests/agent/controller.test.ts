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
    expect(s.llm.calls[0]?.tools).toHaveLength(AGENT_TOOLS.length + 1);
    expect(s.llm.calls[0]?.tools?.map((tool) => tool.name)).toContain("propose_candidate_pool");
    expect(s.gateway.calls).toHaveLength(1);

    const kinds = s.ledger.list().map((entry) => entry.event.kind);
    expect(kinds).toEqual(["LLM", "Qloo", "LLM"]);
    for (const entry of s.ledger.list()) {
      expect(ledgerEventSchema.parse(entry.event)).toEqual(entry.event);
    }
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.ledgerEventId).toBe(s.ledger.list()[1]?.id);
    expect(s.ledger.list()[0]?.event.detail).toBe(
      'Probing local anchors first. | requested qloo_search({"query":"jazz cafe","take":5})'
    );
    expect(s.ledger.list()[1]?.event.detail).toContain('request {"query":"jazz cafe","take":5}');
    expect(s.ledger.list()[2]?.event.label).toBe("investigate:turn 2/3");
    expect(s.ledger.list()[2]?.event.detail).toBe(
      "Evidence gathered: one anchor measured; downstream reading pending."
    );
  });

  it("runs an opt-in deterministic site scan after Prior Lock and hands the real places to the planner", async () => {
    const entities = Array.from({ length: 12 }, (_, position) => ({
      entityId: `urn:entity:place-scan-${position}`,
      name: `Scan Place ${position}`,
      type: "place",
      location: { lat: 40.7144 + position * 0.001, lon: -73.9614 }
    }));
    const s = setup({
      responses: [{ content: "The site scan gives me real anchors; stopping with a coverage gap." }],
      gateway: {
        onCall: () =>
          Promise.resolve(
            okEnvelope("insights", {
              results: { entities },
              resultCount: entities.length
            })
          )
      }
    });

    const result = await runController({ ...baseOptions(s), siteScan: true });

    expect(result.stopReason).toBe("llm_final");
    expect(result.observations).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.run.prior).toEqual(TEST_PRIOR);
    expect(s.gateway.calls).toHaveLength(1);
    expect(s.gateway.calls[0]?.operation).toBe("insights");
    expect(s.llm.calls[0]?.messages.some(
      (message) => message.role === "user" && message.content.includes("Deterministic site scan")
    )).toBe(true);
    expect(s.llm.calls[0]?.messages.some(
      (message) => message.role === "user" && message.content.includes("Scan Place 0")
    )).toBe(true);
    expect(s.ledger.list().map((entry) => entry.event.label)).toEqual(
      expect.arrayContaining(["qloo_insights", "site.scan"])
    );
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
        },
        { content: "No valid pool was produced." }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(PLANNER_TURN_LIMIT).toBe(3);
    expect(s.llm.calls).toHaveLength(4);
    expect(s.llm.calls[3]?.label).toBe("investigate:pool-finalize");
    expect(s.llm.calls[3]?.toolChoice).toEqual({
      type: "function",
      name: "propose_candidate_pool"
    });
    expect(result.turns).toBe(3);
    expect(result.stopReason).toBe("turn_limit");
    expect(result.run.status).toBe("partial");
    expect(result.observations).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it("forces the final turn to propose the candidate pool", async () => {
    const draft = {
      components: [
        {
          id: "comp-anchor",
          role: "Anchor",
          tags: ["jazz"],
          exemplars: [{ id: "urn:entity:place-blue-note", name: "Blue Note Corner" }],
          provenancePath: {
            anchorPlace: TEST_BRIEF.location,
            qlooSignal: "jazz",
            resolvedCategory: "tag-jazz-1",
            exemplarSet: "Blue Note Corner",
            tasteNeighborhood: "jazz"
          },
          evidenceState: "measured"
        }
      ]
    };
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [
            { id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' },
            { id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "jazz"}' }
          ]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_3", name: "qloo_search", arguments: '{"query": "jazz cafe"}' }]
        },
        {
          content: "proposing the pool",
          toolCalls: [
            {
              id: "call_4",
              name: "propose_candidate_pool",
              arguments: JSON.stringify(draft)
            }
          ]
        }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("turn_limit");
    expect(result.run.status).toBe("complete");
    expect(result.outputs.candidatePool).toHaveLength(1);
    expect(result.observations).toBe(3);
    expect(s.llm.calls[2]?.toolChoice).toEqual({
      type: "function",
      name: "propose_candidate_pool"
    });
  });

  it("finalizes a pool after final-turn probes discover the first entities", async () => {
    const draft = {
      components: [
        {
          id: "comp-anchor",
          role: "Anchor",
          tags: ["jazz"],
          exemplars: [{ id: "urn:entity:place-blue-note", name: "Blue Note Corner" }],
          provenancePath: {
            anchorPlace: TEST_BRIEF.location,
            qlooSignal: "jazz",
            resolvedCategory: "tag-jazz-1",
            exemplarSet: "Blue Note Corner",
            tasteNeighborhood: "jazz"
          },
          evidenceState: "measured"
        }
      ]
    };
    let gatewayCall = 0;
    const s = setup({
      responses: [
        {
          content: "Resolving tags.",
          toolCalls: [
            {
              id: "call_1",
              name: "qloo_resolve_tags",
              arguments: '{"query": "jazz"}'
            }
          ]
        },
        {
          content: "Resolving more tags.",
          toolCalls: [
            {
              id: "call_2",
              name: "qloo_resolve_tags",
              arguments: '{"query": "jazz cafe"}'
            }
          ]
        },
        {
          content: "Searching after the tag probes.",
          toolCalls: [
            {
              id: "call_3",
              name: "qloo_search",
              arguments: '{"query": "jazz cafe", "types": ["place"], "take": 5}'
            }
          ]
        },
        {
          content: "Finalizing the pool.",
          toolCalls: [
            {
              id: "call_4",
              name: "propose_candidate_pool",
              arguments: JSON.stringify(draft)
            }
          ]
        }
      ],
      gateway: {
        onCall: (call) => {
          gatewayCall += 1;
          return okEnvelope(call.operation);
        }
      }
    });

    const result = await runController(baseOptions(s));

    expect(s.llm.calls).toHaveLength(4);
    expect(s.llm.calls[2]?.toolChoice).toBeUndefined();
    expect(s.llm.calls[3]?.label).toBe("investigate:pool-finalize");
    expect(s.llm.calls[3]?.toolChoice).toEqual({
      type: "function",
      name: "propose_candidate_pool"
    });
    const finalizePrompt = JSON.stringify(s.llm.calls[3]?.messages);
    expect(finalizePrompt).toContain("Observed grounding");
    expect(finalizePrompt).toContain("Blue Note Corner");
    expect(result.stopReason).toBe("turn_limit");
    expect(result.turns).toBe(3);
    expect(result.run.status).toBe("complete");
    expect(result.outputs.candidatePool).toHaveLength(1);
    expect(gatewayCall).toBe(3);
  });

  it("does not force a pool when no observed entity can ground a component", async () => {
    const empty = () =>
      okEnvelope("search", {
        status: "empty",
        results: { entities: [] },
        resultCount: 0
      });
    const s = setup({
      responses: [
        {
          content: "Searching the site for cultural anchors.",
          toolCalls: [
            {
              id: "call_1",
              name: "qloo_search",
              arguments: '{"query": "Uthiramerur restaurant", "types": ["place"], "take": 20}'
            }
          ]
        },
        {
          content: "Searching the wider district.",
          toolCalls: [
            {
              id: "call_2",
              name: "qloo_search",
              arguments: '{"query": "Kanchipuram cafe", "types": ["place"], "take": 20}'
            }
          ]
        },
        {
          content:
            "Qloo returned no measurable entities for this site. No candidate pool was fabricated."
        }
      ],
      gateway: { onCall: empty }
    });

    const result = await runController(baseOptions(s));

    expect(s.llm.calls).toHaveLength(3);
    expect(s.llm.calls[2]?.toolChoice).toBeUndefined();
    const finalPrompt = JSON.stringify(s.llm.calls[2]?.messages);
    expect(finalPrompt).toContain("no observed entity can ground a candidate component");
    expect(finalPrompt).toContain("Do not call propose_candidate_pool");
    expect(finalPrompt).not.toContain("Observed grounding");
    expect(result.stopReason).toBe("llm_final");
    expect(result.run.status).toBe("complete");
    expect(result.observations).toBe(2);
    expect(result.outputs.candidatePool).toBeUndefined();
    expect(result.toolErrors).toHaveLength(0);
    expect(s.gateway.calls).toHaveLength(2);
    expect(s.ledger.list().some((entry) => entry.event.label === "investigate:pool-repair")).toBe(
      false
    );
  });

  it("repairs one rejected final-turn pool proposal with observed ids", async () => {
    const draft = (exemplarId: string) => ({
      components: [
        {
          id: "comp-anchor",
          role: "Anchor",
          tags: ["jazz"],
          exemplars: [{ id: exemplarId, name: "Blue Note Corner" }],
          provenancePath: {
            anchorPlace: TEST_BRIEF.location,
            qlooSignal: "jazz",
            resolvedCategory: "tag-jazz-1",
            exemplarSet: "Blue Note Corner",
            tasteNeighborhood: "jazz"
          },
          evidenceState: "measured"
        }
      ]
    });
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [
            { id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' },
            { id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "jazz"}' }
          ]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_3", name: "qloo_search", arguments: '{"query": "jazz cafe"}' }]
        },
        {
          content: "proposing the pool",
          toolCalls: [
            {
              id: "call_4",
              name: "propose_candidate_pool",
              arguments: JSON.stringify(draft("urn:entity:place-blue-note-typo"))
            }
          ]
        },
        {
          content: "repairing the pool",
          toolCalls: [
            {
              id: "call_5",
              name: "propose_candidate_pool",
              arguments: JSON.stringify(draft("urn:entity:place-blue-note"))
            }
          ]
        }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(s.llm.calls).toHaveLength(4);
    expect(s.llm.calls[3]?.label).toBe("investigate:pool-repair");
    expect(s.llm.calls[3]?.toolChoice).toEqual({
      type: "function",
      name: "propose_candidate_pool"
    });
    const repairContext = JSON.stringify(s.llm.calls[3]?.messages);
    expect(repairContext).toContain("Observed grounding");
    expect(repairContext).toContain("jazz");
    expect(result.stopReason).toBe("turn_limit");
    expect(result.run.status).toBe("complete");
    expect(result.outputs.candidatePool).toHaveLength(1);
    expect(result.turns).toBe(3);
  });

  it("gives a rejected forced repair one bounded second repair with the same observed ids", async () => {
    const draft = (exemplarId: string) => ({
      components: [
        {
          id: "comp-anchor",
          role: "Anchor",
          tags: ["jazz"],
          exemplars: [{ id: exemplarId, name: "Blue Note Corner" }],
          provenancePath: {
            anchorPlace: TEST_BRIEF.location,
            qlooSignal: "jazz",
            resolvedCategory: "tag-jazz-1",
            exemplarSet: "Blue Note Corner",
            tasteNeighborhood: "jazz"
          },
          evidenceState: "measured"
        }
      ]
    });
    const proposal = (id: string) => ({
      content: "proposing the pool",
      toolCalls: [
        {
          id,
          name: "propose_candidate_pool",
          arguments: JSON.stringify(draft("urn:entity:place-blue-note-typo"))
        }
      ]
    });
    const s = setup({
      responses: [
        {
          content: "probe",
          toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' }]
        },
        {
          content: "probe",
          toolCalls: [{ id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "jazz"}' }]
        },
        proposal("call_3"),
        proposal("call_4"),
        {
          content: "repairing the pool",
          toolCalls: [
            {
              id: "call_5",
              name: "propose_candidate_pool",
              arguments: JSON.stringify(draft("urn:entity:place-blue-note"))
            }
          ]
        }
      ]
    });

    const result = await runController(baseOptions(s));

    expect(s.llm.calls.map((call) => call.label)).toEqual([
      "investigate:turn 1/3",
      "investigate:turn 2/3",
      "investigate:turn 3/3",
      "investigate:pool-repair",
      "investigate:pool-repair-2"
    ]);
    expect(result.outputs.candidatePool).toHaveLength(1);
    expect(result.turns).toBe(3);
    expect(result.stopReason).toBe("turn_limit");
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
        },
        { content: "No valid pool was produced." }
      ]
    });

    const result = await runController(baseOptions(s, 99));

    expect(s.llm.calls).toHaveLength(4);
    expect(s.llm.calls[3]?.label).toBe("investigate:pool-finalize");
    expect(result.turns).toBe(3);
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

  it("feeds a gateway validation rejection back to the agent instead of declaring an outage", async () => {
    const s = setup({
      responses: [
        {
          content: "attempting a heatmap",
          toolCalls: [
            {
              id: "call_1",
              name: "qloo_insights",
              arguments: '{"filterType":"heatmap","location":{"query":"Williamsburg, Brooklyn"}}'
            }
          ]
        },
        { content: "The heatmap was rejected; correcting the probe." }
      ],
      gateway: {
        onCall: () => {
          throw new ApiError(
            "VALIDATION_FAILED",
            "heatmap insights require at least one signal (signalEntities, signalEntitiesQuery, or signalTags)"
          );
        }
      }
    });

    const result = await runController(baseOptions(s));

    expect(result.stopReason).toBe("llm_final");
    expect(result.error).toBeUndefined();
    expect(result.toolErrors).toHaveLength(1);
    expect(result.toolErrors[0]).toBeInstanceOf(AgentToolError);
    expect(result.toolErrors[0]?.reason).toBe("invalid_arguments");
    expect(result.toolErrors[0]?.toolName).toBe("qloo_insights");
    expect(result.run.status).toBe("partial");
    expect(s.llm.calls).toHaveLength(2);
    const toolReply = s.llm.calls[1]?.messages.find((message) => message.role === "tool");
    expect(toolReply && "content" in toolReply ? toolReply.content : "").toContain("TOOL_REJECTED");
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
      throw new ApiError("DEPENDENCY_UNAVAILABLE", "Rapid Router request failed: connection refused");
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
