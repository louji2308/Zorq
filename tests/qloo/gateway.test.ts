import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import { ApiError } from "../../src/shared/errors.js";
import { createQlooGateway, type QlooGatewayOptions } from "../../src/server/qloo/gateway.js";
import { QlooUpstreamError } from "../../src/server/qloo/errors.js";
import { createRestTransport } from "../../src/server/qloo/restTransport.js";
import type { QlooTransport, QlooTransportCall, TransportResponse } from "../../src/server/qloo/transport.js";

const API_KEY = "test-qloo-key-1234";
const BASE_ENV = { NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000", QLOO_API_KEY: API_KEY };

const ENTITY = { entity_id: "e-1", name: "Blue Note", type: "urn:entity:place", affinity: 0.9 };

type Handler = (call: QlooTransportCall, index: number) => TransportResponse | Promise<TransportResponse>;

function fakeTransport(handler: Handler) {
  const calls: QlooTransportCall[] = [];
  const closes: number[] = [];
  const transport: QlooTransport = {
    async call(input) {
      const index = calls.length;
      calls.push(input);
      return handler(input, index);
    },
    async close() {
      closes.push(1);
    }
  };
  return { calls, closes, transport };
}

function okResponse(payload: unknown, extra: Partial<TransportResponse> = {}): TransportResponse {
  return { payload, durationMs: 1, endpoint: "fake://qloo", ...extra };
}

function makeGateway(transport: QlooTransport, env: Record<string, string | undefined> = {}) {
  const config = loadConfig({ ...BASE_ENV, ...env });
  const sleeps: number[] = [];
  const gateway = createQlooGateway({
    config,
    transport,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5
  } satisfies QlooGatewayOptions);
  return { gateway, sleeps };
}

describe("qloo gateway", () => {
  it("routes each operation to its primary transport and shapes the envelope", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: { entities: [ENTITY] } }));
    const { gateway } = makeGateway(transport);

    const search = await gateway.search({ query: "jazz" });
    const tags = await gateway.resolveTags({ query: "jazz" });

    expect(calls[0].transport).toBe("rest");
    expect(calls[1].transport).toBe("mcp");
    expect(calls[0].settings.apiKey).toBe(API_KEY);
    expect(search).toMatchObject({
      status: "ok",
      operation: "search",
      transport: "rest",
      cache: "live",
      resultCount: 1
    });
    expect(search.results.entities[0]?.entityId).toBe("e-1");
    expect(search.provenance).toMatchObject({
      transport: "rest",
      operation: "search",
      endpoint: "fake://qloo",
      durationMs: 1
    });
    expect(tags.transport).toBe("mcp");
  });

  it("caches identical requests and serves the copy without spending budget again", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: { entities: [ENTITY] } }));
    const { gateway } = makeGateway(transport);

    const first = await gateway.search({ query: "jazz", take: 5 });
    const second = await gateway.search({ take: 5, query: "jazz" });

    expect(calls).toHaveLength(1);
    expect(first.cache).toBe("live");
    expect(second.cache).toBe("cached");
    expect(second.resultCount).toBe(first.resultCount);
    expect(gateway.stats).toEqual({ budgetUsed: 1, budgetRemaining: 179, cacheSize: 1, cacheHits: 1 });
  });

  it("re-serves live results when the cache TTL is disabled", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: { entities: [ENTITY] } }));
    const { gateway } = makeGateway(transport, { QLOO_CACHE_TTL_SEC: "0" });

    await gateway.search({ query: "jazz" });
    const second = await gateway.search({ query: "jazz" });

    expect(calls).toHaveLength(2);
    expect(second.cache).toBe("live");
    expect(gateway.stats.cacheSize).toBe(0);
  });

  it("retries retryable failures with capped exponential backoff and jitter", async () => {
    const { calls, transport } = fakeTransport((_call, index) => {
      if (index < 2) {
        throw new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", "temporary upstream failure", { retryable: true });
      }
      return okResponse({ results: { entities: [ENTITY] } });
    });
    const { gateway, sleeps } = makeGateway(transport);

    const envelope = await gateway.search({ query: "jazz" });

    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([375, 625]);
    expect(envelope.status).toBe("ok");
    expect(gateway.stats.budgetUsed).toBe(1);
  });

  it("honors retry-after but never sleeps past the retry delay ceiling", async () => {
    const { calls, transport } = fakeTransport((_call, index) => {
      if (index === 0) {
        throw new QlooUpstreamError("RATE_LIMITED", "slow down", { retryable: true, retryAfterMs: 9000 });
      }
      return okResponse({ results: { entities: [ENTITY] } });
    });
    const { gateway, sleeps } = makeGateway(transport);

    await gateway.search({ query: "jazz" });

    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([4000]);
  });

  it("gives up after two retries and preserves the typed failure", async () => {
    const { calls, transport } = fakeTransport(() => {
      throw new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", "still down", { retryable: true });
    });
    const { gateway } = makeGateway(transport);

    await expect(gateway.search({ query: "jazz" })).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      retryable: true
    });
    expect(calls).toHaveLength(3);
    expect(gateway.stats.budgetUsed).toBe(1);
  });

  it("never retries a non-retryable upstream rejection", async () => {
    const { calls, transport } = fakeTransport(() => {
      throw new QlooUpstreamError("VALIDATION_FAILED", "bad request", { retryable: false });
    });
    const { gateway } = makeGateway(transport);

    await expect(gateway.search({ query: "jazz" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(calls).toHaveLength(1);
  });

  it("enforces the per-run call budget", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: { entities: [ENTITY] } }));
    const { gateway } = makeGateway(transport, { MAX_QLOO_CALLS: "1" });

    await gateway.search({ query: "jazz" });
    await expect(gateway.search({ query: "jazz club" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: false
    });
    expect(calls).toHaveLength(1);
  });

  it("fails closed when the Qloo credential is missing", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: [] }));
    const { gateway } = makeGateway(transport, { QLOO_API_KEY: "" });

    const error = await gateway.search({ query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe("SERVICE_UNAVAILABLE");
    expect(apiError.details?.some((detail) => detail.path === "env.QLOO_API_KEY")).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("scrubs the API key out of upstream failures and their details", async () => {
    const { transport } = fakeTransport(() => {
      throw new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", `rejected key ${API_KEY}`, { retryable: false }, [
        { path: "upstream", message: `X-Api-Key ${API_KEY}` }
      ]);
    });
    const { gateway } = makeGateway(transport);

    const error = (await gateway.search({ query: "jazz" }).catch((caught: unknown) => caught)) as QlooUpstreamError;
    expect(error).toBeInstanceOf(QlooUpstreamError);
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).toContain("[redacted]");
    expect(error.details?.[0]?.message).not.toContain(API_KEY);
    expect(error.details?.[0]?.message).toContain("[redacted]");
  });

  it("preserves error codes from plain ApiErrors and converts unknown throws", async () => {
    const { transport } = fakeTransport(() => {
      throw new ApiError("VALIDATION_FAILED", `bad filter ${API_KEY}`);
    });
    const { gateway } = makeGateway(transport);
    const apiError = (await gateway.search({ query: "jazz" }).catch((caught: unknown) => caught)) as ApiError;
    expect(apiError.code).toBe("VALIDATION_FAILED");
    expect(apiError.message).not.toContain(API_KEY);

    const { transport: throwing } = fakeTransport(() => {
      throw new Error("boom");
    });
    const { gateway: second } = makeGateway(throwing);
    const unknownError = (await second
      .search({ query: "jazz" })
      .catch((caught: unknown) => caught)) as QlooUpstreamError;
    expect(unknownError).toBeInstanceOf(QlooUpstreamError);
    expect(unknownError.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(unknownError.retryable).toBe(false);
    expect(unknownError.message).toContain("Qloo gateway call failed: boom");
  });

  it("passes upstream needs_input through instead of inventing results", async () => {
    const { transport } = fakeTransport(() =>
      okResponse({ results: [] }, { upstreamStatus: "needs_input", resolution: { issues: [{ input: "Blue Nte" }] } })
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.describe({ entity: "Blue Nte" });
    expect(envelope.status).toBe("needs_input");
    expect(envelope.resultCount).toBe(0);
    expect(envelope.cache).toBe("live");
    expect(envelope.resolution?.issues?.[0]?.input).toBe("Blue Nte");
  });

  it("marks a projection mismatch as partial instead of pretending the result was empty", async () => {
    const { transport } = fakeTransport(() =>
      okResponse({ results: [{ name: "no identity" }] }, { upstreamResultCount: 3 })
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.search({ query: "jazz" });
    expect(envelope.status).toBe("partial");
    expect(envelope.resultCount).toBe(0);
    expect(envelope.warnings?.[0]).toContain("Qloo reported 3 results");
  });

  it("reports empty only when upstream really returned nothing", async () => {
    const { transport } = fakeTransport(() => okResponse({ results: [] }, { upstreamResultCount: 0 }));
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.search({ query: "jazz" });
    expect(envelope.status).toBe("empty");
    expect(envelope.resultCount).toBe(0);
    expect(envelope.warnings).toBeUndefined();
  });

  it("forwards interpretation, resolution, warnings and explainability", async () => {
    const { transport } = fakeTransport(() =>
      okResponse(
        { results: { entities: [ENTITY] } },
        {
          interpretation: { summary: "confidence is thin" },
          warnings: ["upstream warned"],
          explainability: { note: "signals" },
          correlationId: "corr-9"
        }
      )
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.bridge({ targetType: "place", signals: ["e-1"] });
    expect(envelope.interpretation).toEqual({ summary: "confidence is thin" });
    expect(envelope.warnings).toEqual(["upstream warned"]);
    expect(envelope.explainability).toEqual({ note: "signals" });
    expect(envelope.provenance.correlationId).toBe("corr-9");
  });

  it("counts triangulate results across tags, groups and matched entities", async () => {
    const { transport } = fakeTransport(() =>
      okResponse({
        results: {
          tags: [{ id: "shared" }],
          a: [{ id: "a-1" }],
          b: [{ id: "b-1" }],
          matchEntities: [{ entity_id: "e-1" }]
        }
      })
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.triangulate({
      groupA: ["e-1", "e-2"],
      groupB: ["e-3", "e-4"],
      targetType: "place"
    });
    expect(envelope.transport).toBe("mcp");
    expect(envelope.resultCount).toBe(4);
    expect(envelope.status).toBe("ok");
    expect(envelope.results.matchEntities).toEqual([{ entityId: "e-1" }]);
  });

  it("projects heatmap insights separately from entity insights", async () => {
    const { transport } = fakeTransport(() =>
      okResponse({ results: { heatmap: [{ latitude: 40.7, longitude: -74, affinity: 0.5 }] } })
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.insights({
      filterType: "heatmap",
      signalEntities: ["e-1"],
      location: { query: "New York, NY" }
    });
    expect(envelope.resultCount).toBe(1);
    expect(envelope.results.heatmap).toEqual([{ latitude: 40.7, longitude: -74, affinity: 0.5 }]);
    expect(envelope.results.entities).toBeUndefined();
  });

  it("answers REST capabilities locally with readiness and its warning", async () => {
    const gateway = createQlooGateway({ config: loadConfig(BASE_ENV), transport: createRestTransport() });

    const envelope = await gateway.capabilities({ transport: "rest" });
    expect(envelope.transport).toBe("rest");
    expect(envelope.results).toMatchObject({
      transport: "rest",
      endpoint: "https://hackathon.api.qloo.com",
      ready: true
    });
    expect(envelope.resultCount).toBe(1);
    expect(envelope.status).toBe("ok");
    expect(envelope.warnings?.[0]).toContain("REST capabilities reports configuration readiness only");
  });

  it("answers MCP capabilities from the contract payload and flags checksum drift", async () => {
    const { calls, transport } = fakeTransport(() =>
      okResponse(
        {
          contract_version: "2025-06",
          contract_checksum: "sha256:abc",
          adapter: { ready: true, supported_operation_ids: ["capabilities", "resolveTags"] }
        },
        { contractChecksum: "sha256:abc", contractChecksumChanged: true, upstreamStatus: "ok" }
      )
    );
    const { gateway } = makeGateway(transport);

    const envelope = await gateway.capabilities();
    expect(calls[0].transport).toBe("mcp");
    expect(envelope.results).toMatchObject({
      transport: "mcp",
      ready: true,
      contractVersion: "2025-06",
      contractChecksumChanged: true
    });
    expect(envelope.resultCount).toBe(2);
    expect(envelope.provenance.contractChecksumChanged).toBe(true);
  });

  it("rejects invalid requests before any transport work", async () => {
    const { calls, transport } = fakeTransport(() => okResponse({ results: [] }));
    const { gateway } = makeGateway(transport);

    await expect(gateway.search({ query: "" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(gateway.insights({ filterType: "heatmap", signalEntities: ["e-1"] })).rejects.toThrow(
      /heatmap insights require a location/
    );
    await expect(gateway.search({ query: "jazz" }, { transport: "mcp" })).rejects.toThrow(
      /not available over the mcp transport/
    );
    await expect(gateway.describe({ entity: "Blue Note" }, { transport: "rest" })).rejects.toThrow(
      /requires a Qloo entity UUID/
    );
    await expect(gateway.bridge({ targetType: "destination" }, { transport: "mcp" })).rejects.toThrow(
      /destination targets are not supported by the MCP workflow tools/
    );
    expect(calls).toHaveLength(0);
    expect(gateway.stats.budgetUsed).toBe(0);
  });

  it("closes the underlying transport", async () => {
    const { closes, transport } = fakeTransport(() => okResponse({ results: [] }));
    const { gateway } = makeGateway(transport);
    await gateway.close();
    expect(closes).toHaveLength(1);
  });
});
