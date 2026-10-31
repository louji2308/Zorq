import { describe, expect, it } from "vitest";
import {
  boundedActivityValue,
  clipActivityText,
  collectActivityNames,
  formatActivityRequest
} from "../../src/server/agent/activity.js";

describe("agent activity bounds", () => {
  it("collapses whitespace and truncates long detail", () => {
    expect(clipActivityText(" first\n  second ")).toBe("first second");
    const clipped = clipActivityText("x".repeat(900));
    expect(clipped).toHaveLength(800);
    expect(clipped.endsWith("...")).toBe(true);
  });

  it("bounds long strings, arrays, objects and recursion depth", () => {
    const bounded = boundedActivityValue({
      long: "y".repeat(900),
      items: Array.from({ length: 30 }, (_, index) => index),
      deep: { one: { two: { three: { four: { five: "too deep" } } } } }
    }) as Record<string, unknown>;

    expect((bounded.long as string).length).toBe(400);
    expect(bounded.items).toHaveLength(21);
    expect((bounded.items as unknown[]).at(-1)).toBe("[truncated]");
    expect(JSON.stringify(bounded.deep)).toContain("[truncated]");
  });

  it("collects only a bounded set of named results", () => {
    expect(
      collectActivityNames({
        entities: [
          { name: "Alice Coltrane", type: "artist" },
          { name: "Sun Ra", type: "artist" },
          { name: "Alice Coltrane", type: "artist" }
        ],
        tags: [{ label: "Jazz" }]
      })
    ).toEqual(["Alice Coltrane", "Sun Ra", "Jazz"]);
  });

  it("formats a bounded JSON request, reserves empty objects and redacts secrets", () => {
    expect(formatActivityRequest({})).toBe("{}");
    expect(formatActivityRequest({ query: "record shop", take: 5 })).toBe(
      '{"query":"record shop","take":5}'
    );
    expect(formatActivityRequest({ query: "record shop", api_key: "secret-marker" })).not.toContain(
      "secret-marker"
    );
  });
});
