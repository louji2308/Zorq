import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";
import { resolveQlooSettings, type QlooSettings } from "../../src/server/qloo/config.js";
import { QlooUpstreamError } from "../../src/server/qloo/errors.js";
import { createRestTransport } from "../../src/server/qloo/restTransport.js";
import type { QlooTransportCall, TransportResponse } from "../../src/server/qloo/transport.js";

const API_KEY = "test-qloo-key-1234";

function settings(): QlooSettings {
  return resolveQlooSettings(
    loadConfig({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000", QLOO_API_KEY: API_KEY })
  );
}

interface CapturedCall {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  const calls: CapturedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, fetchImpl };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(
  transport: { call(input: QlooTransportCall): Promise<TransportResponse> },
  operation: QlooTransportCall["operation"],
  request: unknown
): Promise<TransportResponse> {
  return transport.call({ operation, transport: "rest", request, settings: settings() });
}

describe("rest transport", () => {
  it("builds a GET search with serialized params and provenance", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: [{ entity_id: "e-1" }] }));
    const transport = createRestTransport({ fetchImpl });
    const response = await call(transport, "search", { query: "jazz", types: ["place"], take: 10 });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("query")).toBe("jazz");
    expect(url.searchParams.get("type")).toBe("urn:entity:place");
    expect(url.searchParams.get("take")).toBe("10");
    expect(calls[0].init?.method).toBe("GET");
    expect((calls[0].init?.headers as Record<string, string>)["X-Api-Key"]).toBe(API_KEY);
    expect(response.upstreamResultCount).toBe(1);
    expect(response.requests).toEqual([
      { method: "GET", path: "/search", params: { query: "jazz", type: "urn:entity:place", take: "10" } }
    ]);
    expect(response.endpoint).toBe("https://hackathon.api.qloo.com");
  });

  it("clamps take to the documented maximum", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: [] }));
    const transport = createRestTransport({ fetchImpl });
    await call(transport, "search", { query: "jazz", take: 999 });
    expect(new URL(calls[0].url).searchParams.get("take")).toBe("50");
  });

  it("switches insights to POST when a query-object signal is present", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: { entities: [] } }));
    const transport = createRestTransport({ fetchImpl });
    await call(transport, "insights", {
      filterType: "place",
      signalEntitiesQuery: [{ name: "Blue Note", address: "131 W 3rd St" }],
      signalTags: ["jazz"]
    });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/v2/insights");
    expect(calls[0].init?.method).toBe("POST");
    expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      "filter.type": "urn:entity:place",
      "signal.interests.entities.query": [{ name: "Blue Note", address: "131 W 3rd St" }],
      "signal.interests.tags": ["jazz"]
    });
  });

  it("keeps plain insights on GET with comma-joined array params", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: { entities: [] } }));
    const transport = createRestTransport({ fetchImpl });
    await call(transport, "insights", { filterType: "place", signalEntities: ["e-1", "e-2"], take: 3 });

    expect(calls[0].init?.method).toBe("GET");
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("signal.interests.entities")).toBe("e-1,e-2");
    expect(url.searchParams.get("take")).toBe("3");
    expect(calls[0].init?.body).toBeUndefined();
  });

  it("answers capabilities locally without touching the network", async () => {
    const { calls, fetchImpl } = stubFetch(() => {
      throw new Error("capabilities must not fetch");
    });
    const transport = createRestTransport({ fetchImpl });
    const response = await call(transport, "capabilities", {});
    expect(calls).toHaveLength(0);
    expect(response.payload).toEqual({});
    expect(response.endpoint).toBe("https://hackathon.api.qloo.com");
    expect(response.warnings?.[0]).toContain("REST capabilities reports configuration readiness only");
  });

  it("plans describe, bridge and triangulate over REST", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: [] }));
    const transport = createRestTransport({ fetchImpl });

    await call(transport, "describe", { entity: "11111111-2222-3333-4444-555555555555" });
    await call(transport, "bridge", { targetType: "place", signals: ["e-1"], limit: 7 });
    await call(transport, "triangulate", {
      groupA: ["11111111-2222-3333-4444-555555555555"],
      groupB: ["99999999-8888-7777-6666-555555555555"]
    });

    const describeUrl = new URL(calls[0].url);
    expect(describeUrl.pathname).toBe("/entities");
    expect(describeUrl.searchParams.get("entity_ids")).toBe("11111111-2222-3333-4444-555555555555");

    const bridgeUrl = new URL(calls[1].url);
    expect(bridgeUrl.pathname).toBe("/v2/insights");
    expect(bridgeUrl.searchParams.get("filter.type")).toBe("urn:entity:place");
    expect(bridgeUrl.searchParams.get("signal.interests.entities")).toBe("e-1");
    expect(bridgeUrl.searchParams.get("take")).toBe("7");

    const compareUrl = new URL(calls[2].url);
    expect(compareUrl.pathname).toBe("/v2/analysis/compare");
    expect(compareUrl.searchParams.get("a.signal.interests.entities")).toBe("11111111-2222-3333-4444-555555555555");
    expect(compareUrl.searchParams.get("b.signal.interests.entities")).toBe("99999999-8888-7777-6666-555555555555");
    expect(compareUrl.searchParams.get("take")).toBeNull();
  });

  it("refuses describe with a type hint before issuing any request", async () => {
    const { calls, fetchImpl } = stubFetch(() => jsonResponse({ results: [] }));
    const transport = createRestTransport({ fetchImpl });
    await expect(call(transport, "describe", { entity: "e-1", type: "place" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED"
    });
    expect(calls).toHaveLength(0);
  });

  it("maps a 400 body to a non-retryable validation failure and scrubs the key", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({ errors: [{ message: `bad filter for ${API_KEY}` }] }, 400)
    );
    const transport = createRestTransport({ fetchImpl });
    const error = await call(transport, "search", { query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QlooUpstreamError);
    const upstream = error as QlooUpstreamError;
    expect(upstream.code).toBe("VALIDATION_FAILED");
    expect(upstream.retryable).toBe(false);
    expect(upstream.message).toContain("bad filter");
    expect(upstream.message).not.toContain(API_KEY);
    expect(upstream.message).toContain("[redacted]");
  });

  it("maps 429 to a retryable rate limit honoring Retry-After", async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse({ message: "slow down" }, 429, { "Retry-After": "2" }));
    const transport = createRestTransport({ fetchImpl });
    const error = await call(transport, "search", { query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QlooUpstreamError);
    const upstream = error as QlooUpstreamError;
    expect(upstream.code).toBe("RATE_LIMITED");
    expect(upstream.retryable).toBe(true);
    expect(upstream.retryAfterMs).toBe(2000);
  });

  it("maps 5xx to a retryable dependency failure", async () => {
    const { fetchImpl } = stubFetch(() => new Response("upstream exploded", { status: 503 }));
    const transport = createRestTransport({ fetchImpl });
    const error = await call(transport, "search", { query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QlooUpstreamError);
    expect((error as QlooUpstreamError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect((error as QlooUpstreamError).retryable).toBe(true);
  });

  it("maps transport-level failures to a retryable dependency error", async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new Error("socket hang up"));
    const transport = createRestTransport({ fetchImpl });
    const error = await call(transport, "search", { query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QlooUpstreamError);
    expect((error as QlooUpstreamError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect((error as QlooUpstreamError).retryable).toBe(true);
    expect((error as QlooUpstreamError).message).toContain("socket hang up");
  });

  it("rejects malformed success bodies", async () => {
    const { fetchImpl } = stubFetch(() => new Response("<html>nope</html>", { status: 200 }));
    const transport = createRestTransport({ fetchImpl });
    const error = await call(transport, "search", { query: "jazz" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QlooUpstreamError);
    expect((error as QlooUpstreamError).code).toBe("DEPENDENCY_UNAVAILABLE");
    expect((error as QlooUpstreamError).retryable).toBe(false);
  });
});
