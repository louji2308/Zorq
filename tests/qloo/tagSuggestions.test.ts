import { describe, expect, it, vi } from "vitest";
import type { QlooGateway } from "../../src/server/qloo/gateway.js";
import { buildQlooTagSuggestions } from "../../src/server/qloo/tagSuggestions.js";

const REQUEST = {
  location: "Lisbon, Portugal",
  coordinates: { lat: 38.7223, lon: -9.1393 },
  objective: "A daytime cultural corner",
  selectedTagIds: ["t-selected"],
  excludeTagIds: [],
  excludeLabels: []
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
    expect(insights).toHaveBeenNthCalledWith(
      1,
      {
        filterType: "tag",
        signalTags: ["t-selected", "t-objective-1", "t-objective-2"],
        signalLocation: REQUEST.location,
        take: 12,
        page: 1,
        explainability: true,
        excludeTags: ["t-selected"]
      },
      { transport: "rest" }
    );
    // The fake returns the same short page every time; paging stops at the
    // three-page ceiling rather than looping or inventing more signals.
    expect(insights).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      status: "ok",
      tags: [
        { id: "t-1", label: "Conversation-friendly", score: 0.82, source: "qloo" },
        { id: "t-3", label: "Local suppliers", score: 0.74, source: "qloo" }
      ]
    });
  });

  it("pages past already-seen tags until it has at least four fresh signals", async () => {
    const insights = vi.fn(async ({ page }: { page?: number }) => ({
      status: "ok" as const,
      operation: "insights" as const,
      transport: "rest" as const,
      cache: "live" as const,
      resultCount: 4,
      results: {
        tags:
          page === 1
            ? [
                { id: "t-seen-1", name: "Already seen" },
                { id: "t-new-1", name: "New one", score: 0.9 },
                { id: "t-new-2", name: "New two", score: 0.8 },
                { id: "t-seen-label", name: "Seen label" }
              ]
            : [
                { id: "t-new-3", name: "New three", score: 0.7 },
                { id: "t-new-4", name: "New four", score: 0.6 },
                { id: "t-new-5", name: "New five", score: 0.5 },
                { id: "t-new-6", name: "New six", score: 0.4 }
              ]
      },
      provenance: { transport: "rest" as const, operation: "insights" as const, endpoint: "fake://qloo", durationMs: 1 }
    }));
    const qloo = gateway({ insights });

    const result = await buildQlooTagSuggestions(qloo, {
      ...REQUEST,
      selectedTagIds: [],
      excludeTagIds: ["t-seen-1"],
      excludeLabels: ["Seen label"]
    });

    expect(result.status).toBe("ok");
    expect(result.tags.map((tag) => tag.id)).toEqual([
      "t-new-1",
      "t-new-2",
      "t-new-3",
      "t-new-4",
      "t-new-5",
      "t-new-6"
    ]);
    expect(insights).toHaveBeenCalledTimes(2);
    expect(insights).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, excludeTags: ["t-seen-1"] }),
      { transport: "rest" }
    );
    expect(insights).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, excludeTags: ["t-seen-1", "t-new-1", "t-new-2"] }),
      { transport: "rest" }
    );
  });

  it("issues every objective tag query in one round trip, merged in query order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const resolveTags = vi.fn(async ({ query }: { query: string }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Completion order is deliberately reversed: the full objective resolves
      // last, so any ordering that depends on arrival would scramble the merge.
      const delay = query === REQUEST.objective ? 20 : 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
      inFlight -= 1;
      return {
        status: "ok" as const,
        operation: "resolveTags" as const,
        transport: "rest" as const,
        cache: "live" as const,
        resultCount: 1,
        results: { tags: [{ id: `t-${query.length}`, name: `tag ${query}` }] },
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
      results: { tags: [{ id: "t-from-insights", name: "Insight", score: 0.5 }] },
      provenance: { transport: "rest" as const, operation: "insights" as const, endpoint: "fake://qloo", durationMs: 1 }
    }));
    const qloo = gateway({ resolveTags, insights });

    const result = await buildQlooTagSuggestions(qloo, { ...REQUEST, selectedTagIds: [] });

    const queries = resolveTags.mock.calls.map(([request]) => request.query);
    expect(queries).toEqual([
      "A daytime cultural corner",
      "daytime cultural corner",
      "daytime",
      "cultural"
    ]);
    // A sequential loop can never have more than one call open; the preview
    // must open them together so the preview costs one round trip, not four.
    expect(maxInFlight).toBe(queries.length);
    expect(result.status).toBe("ok");
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
