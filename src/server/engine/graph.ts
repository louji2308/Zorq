import {
  EngineError,
  type CandidateComponent,
  type CultureGraph,
  type EdgeBand,
  type GraphEdge,
  type TasteNeighborhood,
  graphSchema,
  neighborhoodDomains
} from "./types.js";
import { computeIdf, type IdfLookup } from "./idf.js";

const VECTOR_EPSILON = 1e-12;

export function cosineSimilarity(
  left: readonly number[],
  right: readonly number[]
): number | null {
  if (left.length !== right.length) {
    throw new EngineError("INVALID_GRAPH_INPUT", "cosine vectors must have equal length");
  }
  let dot = 0;
  let leftSum = 0;
  let rightSum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    dot += a * b;
    leftSum += a * a;
    rightSum += b * b;
  }
  if (leftSum <= VECTOR_EPSILON || rightSum <= VECTOR_EPSILON) {
    return null;
  }
  const raw = dot / (Math.sqrt(leftSum) * Math.sqrt(rightSum));
  if (!Number.isFinite(raw)) {
    return null;
  }
  if (raw < 0 && raw >= -VECTOR_EPSILON) {
    return 0;
  }
  return raw;
}

export interface BandableEdge {
  a: string;
  b: string;
  value: number;
}

export interface BandedEdge extends BandableEdge {
  band: EdgeBand;
}

export function assignEdgeBands(edges: readonly BandableEdge[]): BandedEdge[] {
  const sorted = [...edges].sort((left, right) => {
    if (left.value !== right.value) {
      return right.value - left.value;
    }
    if (left.a !== right.a) {
      return left.a < right.a ? -1 : 1;
    }
    return left.b < right.b ? -1 : left.b > right.b ? 1 : 0;
  });
  const count = sorted.length;
  const extreme = Math.floor(count / 3);
  return sorted.map((edge, index) => ({
    ...edge,
    band: index < extreme ? "strong" : index >= count - extreme ? "weak" : "typical"
  }));
}

function idfWeight(weight: number, idf: IdfLookup, entityId: string): number {
  return weight * (idf[entityId] ?? 0);
}

function buildVector(
  left: TasteNeighborhood,
  right: TasteNeighborhood,
  idf: IdfLookup
): { left: number[]; right: number[] } {
  const leftVector: number[] = [];
  const rightVector: number[] = [];
  for (const domain of neighborhoodDomains) {
    const leftEntries = new Map(left.domains[domain].map((entry) => [entry.entityId, entry.weight]));
    const rightEntries = new Map(right.domains[domain].map((entry) => [entry.entityId, entry.weight]));
    const entityIds = [...new Set([...leftEntries.keys(), ...rightEntries.keys()])].sort();
    for (const entityId of entityIds) {
      leftVector.push(idfWeight(leftEntries.get(entityId) ?? 0, idf, entityId));
      rightVector.push(idfWeight(rightEntries.get(entityId) ?? 0, idf, entityId));
    }
  }
  return { left: leftVector, right: rightVector };
}

export function buildGraph(
  components: readonly CandidateComponent[],
  neighborhoods: readonly TasteNeighborhood[],
  idf?: IdfLookup
): CultureGraph {
  const ids = components.map((component) => component.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    throw new EngineError("INVALID_GRAPH_INPUT", "duplicate component ids in pool");
  }
  const byId = new Map<TasteNeighborhood["componentId"], TasteNeighborhood>();
  for (const neighborhood of neighborhoods) {
    if (!idSet.has(neighborhood.componentId)) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `neighborhood references unknown component "${neighborhood.componentId}"`
      );
    }
    if (byId.has(neighborhood.componentId)) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `duplicate neighborhood for component "${neighborhood.componentId}"`
      );
    }
    byId.set(neighborhood.componentId, neighborhood);
  }
  for (const id of ids) {
    if (!byId.has(id)) {
      throw new EngineError("INVALID_GRAPH_INPUT", `missing neighborhood for component "${id}"`);
    }
  }
  const nodes = [...ids].sort();
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const lookup = idf ?? computeIdf(components, neighborhoods);
  const measured: BandableEdge[] = [];
  const unmeasured: GraphEdge[] = [];
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const a = nodes[leftIndex];
      const b = nodes[rightIndex];
      const componentA = componentsById.get(a);
      const componentB = componentsById.get(b);
      const neighborhoodA = byId.get(a);
      const neighborhoodB = byId.get(b);
      if (
        componentA === undefined ||
        componentB === undefined ||
        neighborhoodA === undefined ||
        neighborhoodB === undefined
      ) {
        throw new EngineError("INVALID_GRAPH_INPUT", `missing inputs for edge ${a}|${b}`);
      }
      if (componentA.evidenceState !== "measured" || componentB.evidenceState !== "measured") {
        unmeasured.push({ a, b, value: null, band: null, state: "unmeasured" });
        continue;
      }
      const { left, right } = buildVector(neighborhoodA, neighborhoodB, lookup);
      const cosine = cosineSimilarity(left, right);
      if (cosine === null) {
        unmeasured.push({ a, b, value: null, band: null, state: "unmeasured" });
        continue;
      }
      const value = Math.min(1, Math.max(0, cosine));
      measured.push({ a, b, value });
    }
  }
  const banded = assignEdgeBands(measured);
  const measuredEdges: GraphEdge[] = banded.map((edge) => ({
    a: edge.a,
    b: edge.b,
    value: edge.value,
    band: edge.band,
    state: "measured"
  }));
  const edges = [...unmeasured, ...measuredEdges].sort((left, right) => {
    if (left.a !== right.a) {
      return left.a < right.a ? -1 : 1;
    }
    return left.b < right.b ? -1 : left.b > right.b ? 1 : 0;
  });
  const graph = graphSchema.safeParse({ nodes, edges });
  if (!graph.success) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `constructed graph failed validation: ${graph.error.issues
        .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return Object.freeze(graph.data);
}
