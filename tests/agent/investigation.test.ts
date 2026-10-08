import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/shared/brief.js";
import { ApiError } from "../../src/shared/errors.js";
import { runStateSchema } from "../../src/shared/run.js";
import { createDeepSeekLlmClient } from "../../src/server/agent/llm.js";
import { runInvestigation, type InvestigationResult } from "../../src/server/agent/index.js";
import { AgentStateError, PriorGenerationError } from "../../src/server/agent/errors.js";
import { createInitialRun, transitionRun } from "../../src/server/agent/state.js";
import { persistPrior } from "../../src/server/agent/prior.js";
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

const PRIOR_RESPONSE = JSON.stringify({
  composition: { thesis: "daytime cultural corner", members: [{ role: "Anchor", name: "coffee roastery" }] },
  rationale: "from the brief only"
});

const TURN_ONE = {
  content: "checking anchors",
  toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz cafe", "take": 5}' }]
};

const FINAL_TURN = { content: "Evidence: one real anchor measured; everything else remains unproven." };

function expectConforms(result: InvestigationResult): void {
  expect(runStateSchema.safeParse(result.run).success).toBe(true);
}

describe("runInvestigation assembly (Phase 3 exit-gate chain)", () => {
  it("produces prior, real observation, validated mutation, ledger event and evidence record in order", async () => {
    const llm = fakeLlm([{ content: PRIOR_RESPONSE }, TURN_ONE, FINAL_TURN]);
    const gateway = fakeGateway();

    const result = await runInvestigation({
      brief: TEST_BRIEF,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    expectConforms(result);
    expect(result.prior).toBeDefined();
    expect(result.prior?.qlooUsed).toBe(false);
    expect(result.prior?.model).toBe("deepseek-flash");
    expect(result.run.prior).toEqual(result.prior);
    expect(result.run.status).toBe("complete");
    expect(result.run.phase).toBe("investigation");
    expect(result.stopReason).toBe("llm_final");
    expect(result.error).toBeUndefined();

    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.operation).toBe("search");
    expect(result.observations).toBe(1);
    expect(result.evidence).toHaveLength(1);

    expect(result.ledger.length).toBe(4);
    expect(result.ledger[0]?.event.kind).toBe("LLM");
    expect(result.ledger[0]?.event.label).toBe("prior:generate attempt 1");
    expect(result.ledger[1]?.event.kind).toBe("LLM");
    expect(result.ledger[1]?.event.label).toBe("investigate:turn 1/3");
    const firstQloo = result.ledger.find((entry) => entry.event.kind === "Qloo");
    expect(firstQloo).toBeDefined();
    expect(firstQloo?.sequence).toBeGreaterThan(result.ledger[0]?.sequence ?? 0);
    expect(firstQloo?.event.label).toBe("qloo_search");
    expect(result.ledger.at(-1)?.event.kind).toBe("LLM");
    expect(result.ledger.at(-1)?.event.label).toBe("investigate:turn 2/3");

    expect(result.evidence[0]?.ledgerEventId).toBe(firstQloo?.id);
    expect(result.evidence[0]?.provenance).toMatchObject({
      transport: "rest",
      operation: "search",
      endpoint: "https://hackathon.api.qloo.com/fake",
      durationMs: 42,
      cacheState: "live",
      resultCount: 1
    });

    expect(llm.calls).toHaveLength(3);
    expect(llm.calls[0]?.label).toBe("prior:generate attempt 1");
    expect(llm.calls[1]?.label).toBe("investigate:turn 1/3");
    expect(llm.calls[2]?.label).toBe("investigate:turn 2/3");
  });

  it("never touches the gateway when the Prior cannot be produced", async () => {
    const llm = fakeLlm([{ content: "garbage" }, { content: '{"composition": {}}' }]);
    const gateway = fakeGateway();

    const result = await runInvestigation({
      brief: TEST_BRIEF,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    expect(gateway.calls).toHaveLength(0);
    expect(result.stopReason).toBe("prior_failed");
    expect(result.prior).toBeUndefined();
    expect(result.run.prior).toBeUndefined();
    expect(result.run.status).toBe("failed");
    expect(result.run.phase).toBe("prior");
    expect(result.error).toBeInstanceOf(PriorGenerationError);
    expect(result.evidence).toHaveLength(0);
    expect(result.observations).toBe(0);
    expect(result.ledger.length).toBeGreaterThan(0);
    expect(result.ledger.every((entry) => entry.event.kind === "LLM")).toBe(true);
    expectConforms(result);
  });

  it("keeps the gateway untouched when the DeepSeek key is missing", async () => {
    const gateway = fakeGateway();
    const result = await runInvestigation({
      brief: TEST_BRIEF,
      gateway: gateway.gateway,
      llm: createDeepSeekLlmClient({ apiKey: undefined }),
      now: () => TEST_NOW
    });

    expect(gateway.calls).toHaveLength(0);
    expect(result.stopReason).toBe("prior_failed");
    expect(result.error).toBeInstanceOf(ApiError);
    expect((result.error as ApiError).code).toBe("SERVICE_UNAVAILABLE");
    expect(result.run.status).toBe("failed");
  });

  it("yields an honest partial state when Qloo fails mid-loop, preserving prior, ledger and evidence", async () => {
    let gatewayCalls = 0;
    const gatewayOptions: FakeGatewayOptions = {
      onCall: () => {
        gatewayCalls += 1;
        if (gatewayCalls === 1) {
          return {
            ...okEnvelope("search"),
            resultCount: 2,
            results: {
              entities: [
                { entityId: "urn:entity:place-1", name: "Anchor Cafe", type: "place" },
                { entityId: "urn:entity:place-2", name: "Corner Cinema", type: "place" }
              ]
            }
          };
        }
        throw outageError();
      }
    };
    const llm = fakeLlm([
      { content: PRIOR_RESPONSE },
      {
        content: "two probes",
        toolCalls: [
          { id: "call_1", name: "qloo_search", arguments: '{"query": "jazz"}' },
          { id: "call_2", name: "qloo_resolve_tags", arguments: '{"query": "coffee"}' }
        ]
      }
    ]);
    const gateway = fakeGateway(gatewayOptions);

    const result = await runInvestigation({
      brief: TEST_BRIEF,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW
    });

    expect(result.stopReason).toBe("outage");
    expect(result.error).toBeInstanceOf(ApiError);
    expect((result.error as ApiError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(result.run.status).toBe("partial");
    expect(result.run.phase).toBe("investigation");
    expect(result.prior?.qlooUsed).toBe(false);
    expect(result.run.prior).toEqual(result.prior);
    expect(result.observations).toBe(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.provenance.resultCount).toBe(2);

    const qlooEntries = result.ledger.filter((entry) => entry.event.kind === "Qloo");
    expect(qlooEntries).toHaveLength(1);
    expect(result.ledger[0]?.event.label).toBe("prior:generate attempt 1");
    expect(Object.keys(result.run).sort()).toEqual(["brief", "id", "phase", "prior", "status"]);
    expectConforms(result);
  });

  it("rejects a malformed brief with a typed validation error before spending anything", async () => {
    const llm = fakeLlm([]);
    const gateway = fakeGateway();

    let caught: unknown;
    try {
      await runInvestigation({
        brief: { location: "", objective: "" } as unknown as Brief,
        gateway: gateway.gateway,
        llm: llm.client,
        now: () => TEST_NOW
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("VALIDATION_FAILED");
    expect(gateway.calls).toHaveLength(0);
    expect(llm.calls).toHaveLength(0);
  });
});

describe("Prior Lock ordering invariants", () => {
  it("refuses to mark a run investigating before the prior is persisted", () => {
    const run = createInitialRun(TEST_BRIEF);
    expect(() => transitionRun(run, "investigating", "investigation")).toThrow(AgentStateError);
  });

  it("persists before any investigation transition can happen", () => {
    const run = createInitialRun(TEST_BRIEF);
    const stored = persistPrior(run, TEST_PRIOR);
    const next = transitionRun(stored, "investigating", "investigation");
    expect(next.prior).toEqual(TEST_PRIOR);
    expect(next.status).toBe("investigating");
  });
});
