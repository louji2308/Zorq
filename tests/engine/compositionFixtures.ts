import { expect } from "vitest";
import {
  EngineError,
  compositionSchema
} from "../../src/server/engine/index.js";
import type {
  CandidateComponent,
  ComponentEvidenceState,
  ComponentRole,
  Composition,
  CultureGraph,
  GraphEdge
} from "../../src/server/engine/index.js";
import { makeComponent } from "./fixtures.js";

export interface PoolEntry {
  id: string;
  role?: ComponentRole;
  evidenceState?: ComponentEvidenceState;
}

export function makeRolePool(entries: readonly PoolEntry[]): CandidateComponent[] {
  return entries.map((entry) =>
    makeComponent({
      id: entry.id,
      ...(entry.role !== undefined ? { role: entry.role } : {}),
      ...(entry.evidenceState !== undefined ? { evidenceState: entry.evidenceState } : {})
    })
  );
}

export function makeMeasuredGraph(
  nodes: readonly string[],
  measured: readonly (readonly [string, string, number])[]
): CultureGraph {
  const sortedNodes = [...nodes].sort();
  const values = new Map<string, number>();
  for (const [a, b, value] of measured) {
    const low = a <= b ? a : b;
    const high = a <= b ? b : a;
    values.set(JSON.stringify([low, high]), value);
  }
  const edges: GraphEdge[] = [];
  for (let left = 0; left < sortedNodes.length; left += 1) {
    for (let right = left + 1; right < sortedNodes.length; right += 1) {
      const a = sortedNodes[left];
      const b = sortedNodes[right];
      const value = values.get(JSON.stringify([a, b]));
      edges.push(
        value === undefined
          ? { a, b, value: null, band: null, state: "unmeasured" }
          : { a, b, value, band: "typical", state: "measured" }
      );
    }
  }
  return { nodes: sortedNodes, edges };
}

export function makeHandComposition(
  overrides: Partial<Composition> & { members: readonly string[] }
): Composition {
  const members = [...overrides.members].sort();
  const composed = {
    weakestLink: { a: members[0], b: members[1], value: 0.5 },
    coherence: 0.5,
    percentile: 50,
    distinctivenessMean: 0.5,
    ...overrides,
    members,
    size: members.length
  };
  return compositionSchema.parse(composed);
}

export function expectEngineError(fn: () => unknown, code: string): void {
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
