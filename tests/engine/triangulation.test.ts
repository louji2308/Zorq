import { describe, expect, it } from "vitest";
import {
  TRIANGULATION_MIN_USABLE_RESULTS,
  classifyTriangulation,
  route1FromGraph
} from "../../src/server/engine/triangulation.js";
import { EngineError } from "../../src/server/engine/types.js";
import type { CultureGraph, EdgeState } from "../../src/server/engine/types.js";

function expectEngineError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
  expect((caught as EngineError).message).not.toBe("");
}

function makeGraph(
  nodes: readonly string[],
  edges: readonly (readonly [string, string, number | null, EdgeState])[]
): CultureGraph {
  return {
    nodes: [...nodes].sort(),
    edges: edges.map(([a, b, value, state]) => ({
      a,
      b,
      value,
      band: state === "measured" ? "typical" : null,
      state
    }))
  };
}

describe("classifyTriangulation", () => {
  it("classifies confirmed: route 1 measured and focal places in the top half", () => {
    // ProductSpec §12: "Edge is confirmed (both routes strong)" — route 1 is a
    // measured graph edge, route 2 has >=5 usable results and agreement.
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.62 },
      route2: { resultCount: 8, focalInTopHalf: true }
    });
    expect(result.state).toBe("confirmed");
    expect(result.route1State).toBe("measured");
    expect(result.route1Value).toBe(0.62);
    expect(result.resultCount).toBe(8);
    expect(result.focalInTopHalf).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("classifies contested: the two routes disagree", () => {
    // ProductSpec §12: "contested (disagree)" — route 1 measured, route 2 has
    // >=5 usable results but the focal places are not in the top half.
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.44 },
      route2: { resultCount: 9, focalInTopHalf: false }
    });
    expect(result.state).toBe("contested");
  });

  it("classifies thin: fewer than five usable route-2 results", () => {
    // ProductSpec §12: "thin (<5 results)" — even when the route-2 comparison
    // would agree, four usable results are too few to call it.
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 },
      route2: { resultCount: 4, focalInTopHalf: true }
    });
    expect(result.state).toBe("thin");
  });

  it("classifies failed when route 1 is unmeasured", () => {
    // Architecture §11.6: "failed/unmeasured — no defensible measurement."
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "unmeasured", value: null },
      route2: { resultCount: 9, focalInTopHalf: true }
    });
    expect(result.state).toBe("failed");
  });

  it("classifies failed when the route-2 comparison is undeterminable", () => {
    // Architecture §11.6: "failed/unmeasured — no defensible measurement."
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.7 },
      route2: { resultCount: 12, focalInTopHalf: null }
    });
    expect(result.state).toBe("failed");
  });

  it("applies precedence: unmeasured route 1 plus a thin route 2 is failed, not thin", () => {
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "unmeasured", value: null },
      route2: { resultCount: 2, focalInTopHalf: false }
    });
    expect(result.state).toBe("failed");
  });

  it("applies precedence: undeterminable comparison plus a thin count is failed, not thin", () => {
    const result = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 },
      route2: { resultCount: 3, focalInTopHalf: null }
    });
    expect(result.state).toBe("failed");
  });

  it("treats exactly five usable results as strong enough", () => {
    expect(TRIANGULATION_MIN_USABLE_RESULTS).toBe(5);
    const confirmed = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 },
      route2: { resultCount: 5, focalInTopHalf: true }
    });
    expect(confirmed.state).toBe("confirmed");
    const contested = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 },
      route2: { resultCount: 5, focalInTopHalf: false }
    });
    expect(contested.state).toBe("contested");
    const thin = classifyTriangulation({
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 },
      route2: { resultCount: 4, focalInTopHalf: true }
    });
    expect(thin.state).toBe("thin");
  });

  it("is deterministic: identical inputs produce deep-equal frozen outputs", () => {
    const input = {
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.33 },
      route2: { resultCount: 7, focalInTopHalf: false }
    };
    const first = classifyTriangulation(input);
    const second = classifyTriangulation({ ...input });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(Object.isFrozen(second)).toBe(true);
  });

  it("rejects bad result counts", () => {
    const base = {
      a: "m1",
      b: "m2",
      route1: { state: "measured", value: 0.5 }
    };
    expectEngineError(
      () => classifyTriangulation({ ...base, route2: { resultCount: -1, focalInTopHalf: true } }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => classifyTriangulation({ ...base, route2: { resultCount: 2.5, focalInTopHalf: true } }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        classifyTriangulation({
          ...base,
          route2: { resultCount: Number.NaN, focalInTopHalf: true }
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        classifyTriangulation({
          ...base,
          route2: { resultCount: Number.POSITIVE_INFINITY, focalInTopHalf: true }
        }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("rejects unknown or malformed member ids and duplicate pairs", () => {
    const route = { route1: { state: "measured", value: 0.5 }, route2: { resultCount: 8, focalInTopHalf: true } };
    expectEngineError(
      () => classifyTriangulation({ a: "", b: "m2", ...route }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => classifyTriangulation({ a: "   ", b: "m2", ...route }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => classifyTriangulation({ a: "m1", b: "", ...route }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => classifyTriangulation({ a: 7, b: "m2", ...route }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () => classifyTriangulation({ a: "m1", b: "m1", ...route }),
      "INVALID_GRAPH_INPUT"
    );
  });

  it("rejects malformed route measurements and unknown fields", () => {
    expectEngineError(
      () =>
        classifyTriangulation({
          a: "m1",
          b: "m2",
          route1: { state: "measured", value: 1.5 },
          route2: { resultCount: 8, focalInTopHalf: true }
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        classifyTriangulation({
          a: "m1",
          b: "m2",
          route1: { state: "unknown", value: 0.5 },
          route2: { resultCount: 8, focalInTopHalf: true }
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        classifyTriangulation({
          a: "m1",
          b: "m2",
          route2: { resultCount: 8, focalInTopHalf: true }
        }),
      "INVALID_GRAPH_INPUT"
    );
    expectEngineError(
      () =>
        classifyTriangulation({
          a: "m1",
          b: "m2",
          route1: { state: "measured", value: 0.5 },
          route2: { resultCount: 8, focalInTopHalf: true },
          bonus: "extra"
        }),
      "INVALID_GRAPH_INPUT"
    );
  });
});

describe("route1FromGraph", () => {
  it("pulls the measured route-1 edge for a pair in either orientation", () => {
    const graph = makeGraph(["m1", "m2", "m3"], [
      ["m1", "m2", 0.6, "measured"],
      ["m1", "m3", null, "unmeasured"],
      ["m2", "m3", 0.3, "measured"]
    ]);
    expect(route1FromGraph(graph, "m1", "m2")).toEqual({ state: "measured", value: 0.6 });
    expect(route1FromGraph(graph, "m2", "m1")).toEqual({ state: "measured", value: 0.6 });
    expect(route1FromGraph(graph, "m3", "m1")).toEqual({ state: "unmeasured", value: null });
    expect(Object.isFrozen(route1FromGraph(graph, "m1", "m2"))).toBe(true);
  });

  it("rejects unknown members, missing edges and self pairs", () => {
    const graph = makeGraph(["m1", "m2"], [["m1", "m2", 0.4, "measured"]]);
    expectEngineError(() => route1FromGraph(graph, "ghost", "m2"), "INVALID_GRAPH_INPUT");
    expectEngineError(() => route1FromGraph(graph, "m1", "ghost"), "INVALID_GRAPH_INPUT");
    expectEngineError(() => route1FromGraph(graph, "m1", "m1"), "INVALID_GRAPH_INPUT");
    expectEngineError(() => route1FromGraph(graph, "", "m2"), "INVALID_GRAPH_INPUT");
    const disconnected = makeGraph(["m1", "m2", "m3"], [["m1", "m2", 0.4, "measured"]]);
    expectEngineError(() => route1FromGraph(disconnected, "m2", "m3"), "INVALID_GRAPH_INPUT");
  });
});
