import { describe, expect, it } from "vitest";
import {
  buildGraph,
  buildNeighborhoods,
  computeIdf
} from "../../src/server/engine/index.js";
import type { CultureGraph, NeighborhoodSignalInput, TasteNeighborhood } from "../../src/server/engine/index.js";
import { makePool } from "./fixtures.js";

const IDS = ["c1", "c2", "c3", "c4", "c5"] as const;

const SIGNALS: NeighborhoodSignalInput[] = [
  {
    componentId: "c1",
    domain: "artist",
    signals: [
      { entityId: "a-blue", rank: 1, affinity: 0.6 },
      { entityId: "a-green", rank: 2 },
      { entityId: "a-ubiq", rank: 3, affinity: 0.2 }
    ]
  },
  {
    componentId: "c1",
    domain: "movie",
    signals: [
      { entityId: "m-one", rank: 1, affinity: 0.9 },
      { entityId: "m-two", rank: 2 }
    ]
  },
  {
    componentId: "c2",
    domain: "artist",
    signals: [
      { entityId: "a-blue", rank: 1, affinity: 0.6 },
      { entityId: "a-red", rank: 2, affinity: 0.4 }
    ]
  },
  {
    componentId: "c2",
    domain: "brand",
    signals: [
      { entityId: "b-one", rank: 1 },
      { entityId: "b-ubiq", rank: 2, affinity: 0.5 }
    ]
  },
  {
    componentId: "c3",
    domain: "movie",
    signals: [
      { entityId: "m-one", rank: 1, affinity: 0.7 },
      { entityId: "m-three", rank: 2, affinity: 0.3 }
    ]
  },
  {
    componentId: "c4",
    domain: "artist",
    signals: [{ entityId: "a-ubiq", rank: 1, affinity: 0.8 }]
  },
  {
    componentId: "c5",
    domain: "brand",
    signals: [
      { entityId: "b-ubiq", rank: 1, affinity: 0.5 },
      { entityId: "b-two", rank: 2 }
    ]
  }
];

function runPipeline(
  ids: readonly string[],
  inputs: readonly NeighborhoodSignalInput[]
): { neighborhoods: TasteNeighborhood[]; idf: Record<string, number>; graph: CultureGraph } {
  const pool = makePool(ids);
  const neighborhoods = buildNeighborhoods(pool, inputs);
  const idf = computeIdf(pool, neighborhoods);
  const graph = buildGraph(pool, neighborhoods, idf);
  return { neighborhoods, idf, graph };
}

describe("engine determinism", () => {
  it("produces deep-equal output for identical repeated input", () => {
    const first = runPipeline(IDS, SIGNALS);
    const second = runPipeline(IDS, SIGNALS);
    expect(second.neighborhoods).toEqual(first.neighborhoods);
    expect(second.idf).toEqual(first.idf);
    expect(second.graph).toEqual(first.graph);
    // Byte-identical serialization, not just structural equality.
    expect(JSON.stringify(second.graph)).toBe(JSON.stringify(first.graph));
  });

  it("ignores input ordering via the specified sort rules", () => {
    const baseline = runPipeline(IDS, SIGNALS);
    const shuffledIds = [...IDS].reverse();
    const shuffledInputs = [...SIGNALS].reverse().map((input) => ({
      ...input,
      signals: [...input.signals].reverse()
    }));
    const shuffled = runPipeline(shuffledIds, shuffledInputs);
    expect(shuffled.neighborhoods).toEqual(baseline.neighborhoods);
    expect(shuffled.idf).toEqual(baseline.idf);
    expect(shuffled.graph).toEqual(baseline.graph);
  });
});
