import { z } from "zod";
import {
  EngineError,
  edgeStates,
  type CultureGraph
} from "./types.js";

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export const TRIANGULATION_MIN_USABLE_RESULTS = 5;

export const triangulationStates = ["confirmed", "contested", "thin", "failed"] as const;

export type TriangulationState = (typeof triangulationStates)[number];

export const route1Schema = z.strictObject({
  state: z.enum(edgeStates),
  value: z.number().finite().min(0).max(1).nullable()
});

export type Route1Measurement = z.infer<typeof route1Schema>;

export const route2Schema = z.strictObject({
  resultCount: z.number().int().min(0),
  focalInTopHalf: z.boolean().nullable()
});

export type Route2Probe = z.infer<typeof route2Schema>;

export const triangulationInputSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  route1: route1Schema,
  route2: route2Schema
});

export type TriangulationInput = z.infer<typeof triangulationInputSchema>;

export const triangulationClassificationSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  state: z.enum(triangulationStates),
  route1State: z.enum(edgeStates),
  route1Value: z.number().finite().min(0).max(1).nullable(),
  resultCount: z.number().int().min(0),
  focalInTopHalf: z.boolean().nullable()
});

export type TriangulationClassification = z.infer<typeof triangulationClassificationSchema>;

// ProductSpec §12: "Edge is confirmed (both routes strong), contested (disagree)
// or thin (<5 results)"; Architecture §11.6: "failed/unmeasured — no defensible
// measurement." Precedence: failed > thin > confirmed/contested.
export function classifyTriangulation(input: unknown): TriangulationClassification {
  const parsed = triangulationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `triangulation input is invalid: ${describeIssues(parsed.error)}`
    );
  }
  const { a, b, route1, route2 } = parsed.data;
  if (a === b) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `triangulation pair must name two distinct members (received "${a}" twice)`
    );
  }
  let state: TriangulationState;
  if (route1.state !== "measured" || route2.focalInTopHalf === null) {
    state = "failed";
  } else if (route2.resultCount < TRIANGULATION_MIN_USABLE_RESULTS) {
    state = "thin";
  } else if (route2.focalInTopHalf) {
    state = "confirmed";
  } else {
    state = "contested";
  }
  const classification = triangulationClassificationSchema.parse({
    a,
    b,
    state,
    route1State: route1.state,
    route1Value: route1.value,
    resultCount: route2.resultCount,
    focalInTopHalf: route2.focalInTopHalf
  });
  return Object.freeze(classification);
}

function normalizePair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function route1FromGraph(graph: CultureGraph, a: string, b: string): Route1Measurement {
  if (typeof a !== "string" || a.trim() === "" || typeof b !== "string" || b.trim() === "") {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      "route-1 lookup requires two non-empty member ids"
    );
  }
  if (a === b) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `route-1 lookup must name two distinct members (received "${a}" twice)`
    );
  }
  const nodeSet = new Set(graph.nodes);
  if (!nodeSet.has(a)) {
    throw new EngineError("INVALID_GRAPH_INPUT", `graph has no node "${a}"`);
  }
  if (!nodeSet.has(b)) {
    throw new EngineError("INVALID_GRAPH_INPUT", `graph has no node "${b}"`);
  }
  const [low, high] = normalizePair(a, b);
  const edge = graph.edges.find((candidate) => {
    const [edgeLow, edgeHigh] = normalizePair(candidate.a, candidate.b);
    return edgeLow === low && edgeHigh === high;
  });
  if (edge === undefined) {
    throw new EngineError("INVALID_GRAPH_INPUT", `graph has no edge ${low}|${high}`);
  }
  return Object.freeze({ state: edge.state, value: edge.value });
}
