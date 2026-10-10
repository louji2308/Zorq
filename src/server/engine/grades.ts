import {
  EngineError,
  componentEvidenceStates,
  type CandidateComponent,
  type ComponentEvidenceState
} from "./types.js";
import { triangulationStates, type TriangulationState } from "./triangulation.js";

export const evidenceGrades = ["A", "B", "C"] as const;

export type EvidenceGrade = (typeof evidenceGrades)[number];

export interface ClassifiedTriangulationEdge {
  a: string;
  b: string;
  state: TriangulationState;
}

export interface EvidenceGradeInput {
  members: readonly string[];
  pool: readonly CandidateComponent[];
  edges: readonly ClassifiedTriangulationEdge[];
}

export interface EvidenceGradeResult {
  grade: EvidenceGrade;
  reasons: string[];
}

interface MemberState {
  id: string;
  evidenceState: ComponentEvidenceState;
}

function pairKey(a: string, b: string): string {
  const low = a <= b ? a : b;
  const high = a <= b ? b : a;
  return JSON.stringify([low, high]);
}

function normalizePair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function resolveMemberStates(
  members: readonly string[],
  pool: readonly CandidateComponent[]
): MemberState[] {
  if (!Array.isArray(members)) {
    throw new EngineError("INVALID_COMPONENT", "composition members must be an array");
  }
  if (members.length < 2) {
    throw new EngineError(
      "INVALID_COMPONENT",
      `composition must contain at least 2 members (received ${members.length})`
    );
  }
  if (!Array.isArray(pool)) {
    throw new EngineError("INVALID_COMPONENT", "candidate pool must be an array");
  }
  const poolById = new Map<string, CandidateComponent>();
  for (const component of pool) {
    if (component === null || typeof component !== "object" || typeof component.id !== "string") {
      throw new EngineError("INVALID_COMPONENT", "candidate pool entries must be components");
    }
    if (poolById.has(component.id)) {
      throw new EngineError("INVALID_COMPONENT", `duplicate component id "${component.id}" in pool`);
    }
    poolById.set(component.id, component);
  }
  const seen = new Set<string>();
  const resolved: MemberState[] = [];
  for (const id of members) {
    if (typeof id !== "string" || id.trim() === "") {
      throw new EngineError("INVALID_COMPONENT", "composition member ids must be non-empty strings");
    }
    if (seen.has(id)) {
      throw new EngineError("INVALID_COMPONENT", `duplicate composition member "${id}"`);
    }
    seen.add(id);
    const component = poolById.get(id);
    if (component === undefined) {
      throw new EngineError("INVALID_COMPONENT", `unknown composition member "${id}"`);
    }
    if (!componentEvidenceStates.includes(component.evidenceState)) {
      throw new EngineError(
        "INVALID_COMPONENT",
        `member "${id}" has unknown evidenceState "${String(component.evidenceState)}"`
      );
    }
    resolved.push({ id, evidenceState: component.evidenceState });
  }
  return resolved;
}

function indexClassifiedEdges(
  edges: readonly ClassifiedTriangulationEdge[],
  memberIds: ReadonlySet<string>
): Map<string, TriangulationState> {
  if (!Array.isArray(edges)) {
    throw new EngineError("INVALID_GRAPH_INPUT", "classified triangulation edges must be an array");
  }
  const index = new Map<string, TriangulationState>();
  for (const edge of edges) {
    if (edge === null || typeof edge !== "object") {
      throw new EngineError("INVALID_GRAPH_INPUT", "classified triangulation edges must be objects");
    }
    if (typeof edge.a !== "string" || edge.a.trim() === "") {
      throw new EngineError("INVALID_GRAPH_INPUT", "triangulation edge id a must be a non-empty string");
    }
    if (typeof edge.b !== "string" || edge.b.trim() === "") {
      throw new EngineError("INVALID_GRAPH_INPUT", "triangulation edge id b must be a non-empty string");
    }
    if (edge.a === edge.b) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `triangulation edge ${edge.a}|${edge.b} must name two distinct members`
      );
    }
    if (!triangulationStates.includes(edge.state)) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `triangulation edge ${edge.a}|${edge.b} has unknown state "${String(edge.state)}"`
      );
    }
    if (!memberIds.has(edge.a) || !memberIds.has(edge.b)) {
      throw new EngineError(
        "INVALID_COMPONENT",
        `triangulation edge ${edge.a}|${edge.b} references a member outside the composition`
      );
    }
    const key = pairKey(edge.a, edge.b);
    if (index.has(key)) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `duplicate triangulation edge for pair ${edge.a}|${edge.b}`
      );
    }
    index.set(key, edge.state);
  }
  return index;
}

// ProductSpec §12: "A: all leader edges confirmed. B: any contested, thin, or
// failed probe. C: any leader member unmeasured." Precedence: C > B > A (the
// grade is a cap — worst wins, never an average). A finalist edge with no
// classification supplied counts as failed, so a composition can never earn A
// with zero evidence.
export function gradeEvidence(input: EvidenceGradeInput): EvidenceGradeResult {
  if (input === null || typeof input !== "object") {
    throw new EngineError("INVALID_COMPONENT", "evidence grade input must be an object");
  }
  const { members, pool, edges } = input;
  const memberStates = resolveMemberStates(members, pool);
  const classified = indexClassifiedEdges(edges, new Set(memberStates.map((entry) => entry.id)));
  const memberReasons: string[] = [];
  for (const entry of memberStates) {
    if (entry.evidenceState !== "measured") {
      memberReasons.push(`member ${entry.id} evidenceState=${entry.evidenceState}`);
    }
  }
  const sortedIds = memberStates.map((entry) => entry.id).sort();
  const edgeReasons: string[] = [];
  for (let left = 0; left < sortedIds.length; left += 1) {
    for (let right = left + 1; right < sortedIds.length; right += 1) {
      const [low, high] = normalizePair(sortedIds[left], sortedIds[right]);
      const state = classified.get(pairKey(low, high)) ?? "failed";
      if (state !== "confirmed") {
        edgeReasons.push(`edge ${low}|${high} state=${state}`);
      }
    }
  }
  const grade: EvidenceGrade =
    memberReasons.length > 0 ? "C" : edgeReasons.length > 0 ? "B" : "A";
  const reasons = [...memberReasons, ...edgeReasons];
  Object.freeze(reasons);
  return Object.freeze({ grade, reasons });
}
