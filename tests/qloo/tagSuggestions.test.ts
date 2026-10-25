import { describe, expect, it, vi } from "vitest";
import type { QlooGateway } from "../../src/server/qloo/gateway.js";
import { buildQlooTagSuggestions } from "../../src/server/qloo/tagSuggestions.js";

const REQUEST = {
  location: "Lisbon, Portugal",
  coordinates: { lat: 38.7223, lon: -9.1393 },
  objective: "A daytime cultural corner",
  selectedTagIds: ["t-selected"]
};

function gateway(overrides: Partial<Pick<QlooGateway, "resolveTags" | "insights">> = {}): QlooGateway {
  return {
    resolveTags: vi.fn(async () => ({
      status: "ok",
      operation: "resolveTags",
      transport: "rest",
      cache: "live",
      resultCount: 2,
      results: { tags: [{ id: "t-objective-1", name: "daytime" }, { id: "t-objective-2", name: "culture" }] },
      provenance: { transport: "rest", operation: "resolveTags", endpoint: "fake://qloo", durationMs: 1 }
    })),
    insights: vi.fn(async () => ({
      status: "ok",
      operation: "insights",
      transport: "rest",
      cache: "live",
      resultCount: 4,
      results: {
        tags: [
          { id: "t-selected", name: "Already selected", score: 0.99 },
          { id: "t-1", name: "Conversation-friendly", score: 0.82 },
          { id: "t-2", name: "conversation-FRIENDLY", score: 0.8 },
          { id: "t-3", name: "Local suppliers", score: 0.74 }
        ]
      },
      provenance: { transport: "rest", operation: "insights", endpoint: "fake://qloo", durationMs: 1 }
    })),
    ...overrides
  } as unknown as QlooGateway;
}

describe("buildQlooTagSuggestions", () => {
  it("resolves the objective, queries Qloo tags, and removes selected/duplicate labels", async () => {
    const resolveTags = vi.fn(async () => ({
      status: "ok" as const,
      operation: "resolveTags" as const,
      transport: "rest" as const,
      cache: "live" as const,
      resultCount: 2,
      results: { tags: [{ id: "t-objective-1", name: "daytime" }, { id: "t-objective-2", name: "culture" }] },
      provenance: { transport: "rest" as const, operation: "resolveTags" as const, endpoint: "fake://qloo", durationMs: 1 }
    }));
    const insights = vi.fn(async () => ({
      status: "ok" as const,
      operation: "insights" as const,
      transport: "rest" as const,
      cache: "live" as const,
      resultCount: 4,
      results: {
        tags: [
          { id: "t-selected", name: "Already selected", score: 0.99 },
          { id: "t-1", name: "Conversation-friendly", score: 0.82 },
          { id: "t-2", name: "conversation-FRIENDLY", score: 0.8 },
          { id: "t-3", name: "Local suppliers", score: 0.74 }
        ]
      },
      provenance: { transport: "rest" as const, operation: "insights" as const, endpoint: "fake://qloo", durationMs: 1 }
    }));
    const qloo = gateway({ resolveTags, insights });

    const result = await buildQlooTagSuggestions(qloo, REQUEST);

    expect(resolveTags).toHaveBeenCalledWith(
      { query: REQUEST.objective, take: 6 },
      { transport: "rest" }
    );
    expect(insights).toHaveBeenCalledWith(
      {
        filterType: "tag",
        signalTags: ["t-selected", "t-objective-1", "t-objective-2"],
        signalLocation: REQUEST.location,
        take: 8,
        explainability: true
      },
      { transport: "rest" }
    );
    expect(result).toEqual({
      status: "ok",
      tags: [
        { id: "t-1", label: "Conversation-friendly", score: 0.82, source: "qloo" },
        { id: "t-3", label: "Local suppliers", score: 0.74, source: "qloo" }
      ]
    });
  });

  it("returns an honest empty result when Qloo resolves no usable signals", async () => {
    const qloo = gateway({
      resolveTags: vi.fn(async () => ({
        status: "empty" as const,
        operation: "resolveTags" as const,
        transport: "rest" as const,
        cache: "live" as const,
        resultCount: 0,
        results: { tags: [] },
        provenance: { transport: "rest" as const, operation: "resolveTags" as const, endpoint: "fake://qloo", durationMs: 1 }
      }))
    });

    const result = await buildQlooTagSuggestions(qloo, { ...REQUEST, selectedTagIds: [] });

    expect(result).toEqual({
      status: "empty",
      tags: [],
      message: "Qloo found no cultural signals for this goal yet."
    });
    expect(qloo.insights).not.toHaveBeenCalled();
  });

  it("retries a natural-language objective with bounded Qloo query fragments", async () => {
    const resolveTags = vi.fn(async ({ query }: { query: string }) => {
      if (query !== "daytime") {
        return {
          status: "empty" as const,
          operation: "resolveTags" as const,
          transport: "rest" as const,
          cache: "live" as const,
          resultCount: 0,
          results: { tags: [] },
          provenance: {
            transport: "rest" as const,
            operation: "resolveTags" as const,
            endpoint: "fake://qloo",
            durationMs: 1
          }
        };
      }
      return {
        status: "ok" as const,
        operation: "resolveTags" as const,
        transport: "rest" as const,
        cache: "live" as const,
        resultCount: 1,
        results: { tags: [{ id: "t-daytime", name: "Daytime" }] },
        provenance: {
          transport: "rest" as const,
          operation: "resolveTags" as const,
          endpoint: "fake://qloo",
          durationMs: 1
        }
      };
    });
    const insights = vi.fn(async () => ({
      status: "ok" as const,
      operation: "insights" as const,
      transport: "rest" as const,
      cache: "live" as const,
      resultCount: 1,
      results: { tags: [{ id: "t-cultural", name: "Cultural", score: 0.81 }] },
      provenance: { transport: "rest" as const, operation: "insights" as const, endpoint: "fake://qloo", durationMs: 1 }
    }));

    const result = await buildQlooTagSuggestions(gateway({ resolveTags, insights }), {
      ...REQUEST,
      selectedTagIds: []
    });

    expect(resolveTags.mock.calls.map(([request]) => request.query)).toEqual([
      "A daytime cultural corner",
      "daytime cultural corner",
      "daytime",
      "cultural"
    ]);
    expect(insights).toHaveBeenCalledWith(
      expect.objectContaining({ signalTags: ["t-daytime"], signalLocation: REQUEST.location }),
      { transport: "rest" }
    );
    expect(result).toEqual({
      status: "ok",
      tags: [{ id: "t-cultural", label: "Cultural", score: 0.81, source: "qloo" }]
    });
  });

  it("preserves a degraded Qloo state instead of inventing suggestions", async () => {
    const qloo = gateway({
      insights: vi.fn(async () => ({
        status: "degraded" as const,
        operation: "insights" as const,
        transport: "rest" as const,
        cache: "live" as const,
        resultCount: 0,
        results: {},
        provenance: { transport: "rest" as const, operation: "insights" as const, endpoint: "fake://qloo", durationMs: 1 }
      }))
    });

    const result = await buildQlooTagSuggestions(qloo, REQUEST);

    expect(result).toEqual({
      status: "degraded",
      tags: [],
      message: "Qloo could not complete the tag read. You can continue without adaptive tags."
    });
  });
});
