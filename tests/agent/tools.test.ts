import { describe, expect, it } from "vitest";
import { ledgerEventSchema } from "../../src/shared/events.js";
import { AgentToolError } from "../../src/server/agent/errors.js";
import { createLedger } from "../../src/server/agent/ledger.js";
import { AGENT_TOOLS, executeToolCall, provenanceFromEnvelope } from "../../src/server/agent/tools.js";
import { TEST_NOW, fakeGateway, okEnvelope } from "./support/fakes.js";

function ledger() {
  return createLedger();
}

describe("agent tool schemas", () => {
  it("exposes OpenAI function schemas only for real gateway methods", () => {
    expect(AGENT_TOOLS.map((tool) => tool.name)).toEqual([
      "qloo_capabilities",
      "qloo_search",
      "qloo_resolve_tags",
      "qloo_insights",
      "qloo_describe",
      "qloo_bridge",
      "qloo_replace",
      "qloo_triangulate"
    ]);
    for (const tool of AGENT_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe("object");
      expect(JSON.parse(JSON.stringify(tool.parameters))).toEqual(tool.parameters);
      expect(tool.parameters.$schema).toBeUndefined();
    }
    const search = AGENT_TOOLS.find((tool) => tool.name === "qloo_search");
    expect(search?.parameters).toMatchObject({ required: ["query"] });
  });

  it("rejects invalid arguments before the gateway is touched", async () => {
    const { gateway, calls } = fakeGateway();
    const ledgerRef = ledger();

    let caught: unknown;
    try {
      await executeToolCall({
        gateway,
        call: { id: "call_1", name: "qloo_search", arguments: '{"take": 999}' },
        ledger: ledgerRef,
        now: () => TEST_NOW
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).reason).toBe("invalid_arguments");
    expect((caught as AgentToolError).code).toBe("VALIDATION_FAILED");
    expect(calls).toHaveLength(0);
    expect(ledgerRef.size()).toBe(0);
  });

  it("rejects non-JSON and unknown tool calls without touching the gateway", async () => {
    const { gateway, calls } = fakeGateway();
    const ledgerRef = ledger();

    await expect(
      executeToolCall({
        gateway,
        call: { id: "call_1", name: "qloo_search", arguments: "{broken" },
        ledger: ledgerRef,
        now: () => TEST_NOW
      })
    ).rejects.toMatchObject({ reason: "invalid_arguments" });

    await expect(
      executeToolCall({
        gateway,
        call: { id: "call_2", name: "qloo_divinate", arguments: "{}" },
        ledger: ledgerRef,
        now: () => TEST_NOW
      })
    ).rejects.toMatchObject({ reason: "unknown_tool" });

    expect(calls).toHaveLength(0);
    expect(ledgerRef.size()).toBe(0);
  });

  it("turns a successful gateway call into a schema-valid ledger event and a faithful evidence record", async () => {
    const envelope = okEnvelope("search", {
      cache: "cached",
      resultCount: 4,
      transport: "mcp",
      provenance: {
        transport: "mcp",
        operation: "search",
        endpoint: "fake://qloo-mcp",
        durationMs: 77
      }
    });
    const { gateway, calls } = fakeGateway({ onCall: () => envelope });
    const ledgerRef = ledger();

    const outcome = await executeToolCall({
      gateway,
      call: { id: "call_1", name: "qloo_search", arguments: '{"query": "jazz cafe", "take": 4}' },
      ledger: ledgerRef,
      now: () => TEST_NOW
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.request).toEqual({ query: "jazz cafe", take: 4 });
    expect(ledgerEventSchema.parse(outcome.ledgerEntry.event)).toEqual(outcome.ledgerEntry.event);
    expect(outcome.ledgerEntry.event).toMatchObject({
      kind: "Qloo",
      label: "qloo_search",
      duration: 77,
      cacheState: "cached",
      resultCount: 4
    });
    expect(outcome.ledgerEntry.sequence).toBe(1);
    expect(outcome.evidence.provenance).toEqual({
      transport: "mcp",
      operation: "search",
      endpoint: "fake://qloo-mcp",
      durationMs: 77,
      cacheState: "cached",
      resultCount: 4
    });
    expect(outcome.evidence.ledgerEventId).toBe(outcome.ledgerEntry.id);
    expect(outcome.evidence.operation).toBe("search");
    const observation = JSON.parse(outcome.observation) as Record<string, unknown>;
    expect(observation).toMatchObject({ tool: "qloo_search", resultCount: 4, cache: "cached" });
    expect(observation.results).toEqual(envelope.results);
  });

  it("rejects an envelope without usable provenance and records nothing", async () => {
    const broken = { ...okEnvelope("insights"), provenance: undefined } as unknown;
    const { gateway } = fakeGateway({ onCall: () => broken as ReturnType<typeof okEnvelope> });
    const ledgerRef = ledger();

    let caught: unknown;
    try {
      await executeToolCall({
        gateway,
        call: { id: "call_1", name: "qloo_insights", arguments: '{"filterType": "heatmap"}' },
        ledger: ledgerRef,
        now: () => TEST_NOW
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AgentToolError);
    expect((caught as AgentToolError).reason).toBe("invalid_envelope");
    expect(ledgerRef.size()).toBe(0);
  });

  it("maps envelopes to evidence provenance without inventing fields", () => {
    const envelope = okEnvelope("triangulate", { transport: "mcp", provenance: { transport: "mcp", operation: "triangulate", endpoint: "fake://mcp", durationMs: 9 } });
    expect(provenanceFromEnvelope(envelope)).toEqual({
      transport: "mcp",
      operation: "triangulate",
      endpoint: "fake://mcp",
      durationMs: 9,
      cacheState: "live",
      resultCount: envelope.resultCount
    });
  });
});
