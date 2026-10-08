import { z } from "zod";
import {
  EngineError,
  componentRoles,
  type CandidateComponent,
  type ComponentRole,
  type CultureGraph,
  type GraphEdge
} from "./types.js";

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export const MAX_ENUMERATION_CANDIDATES = 10_000;

export const weakestLinkSchema = z.strictObject({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  value: z.number().finite().min(0).max(1)
});

export type WeakestLink = z.infer<typeof weakestLinkSchema>;

export const compositionSchema = z
  .strictObject({
    members: z.array(z.string().trim().min(1)).min(2),
    size: z.number().int().min(2),
    coherence: z.number().finite().min(0).max(1),
    weakestLink: weakestLinkSchema,
    percentile: z.number().finite().min(0).max(100).nullable(),
    distinctivenessMean: z.number().finite().min(0).max(1).nullable()
  })
  .refine((composition) => composition.size === composition.members.length, {
    message: "size must equal members.length"
  });

export type Composition = z.infer<typeof compositionSchema>;

export interface MeasuredComposition {
  members: string[];
  size: number;
  coherence: number;
  weakestLink: WeakestLink;
}

export interface CompositionFamily {
  poolSize: number;
  size: number;
  requiredRoles: ComponentRole[];
  totalCandidates: number;
  totalValid: number;
  compositions: Composition[];
}

export interface CompositionInput {
  pool: readonly CandidateComponent[];
  graph: CultureGraph;
  size: number;
  requiredRoles: readonly ComponentRole[];
  distinctiveness?: Readonly<Record<string, number | null>>;
}

export interface SubsetValidityInput {
  pool: readonly CandidateComponent[];
  graph: CultureGraph;
  requiredRoles: readonly ComponentRole[];
}

function pairKey(a: string, b: string): string {
  return JSON.stringify(a <= b ? [a, b] : [b, a]);
}

function buildEdgeIndex(graph: CultureGraph): Map<string, GraphEdge> {
  const index = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    index.set(pairKey(edge.a, edge.b), edge);
  }
  return index;
}

function assertPoolGraphConsistent(pool: readonly CandidateComponent[], graph: CultureGraph): void {
  const poolIds = pool.map((component) => component.id);
  const poolSet = new Set(poolIds);
  if (poolSet.size !== poolIds.length) {
    const seen = new Set<string>();
    for (const id of poolIds) {
      if (seen.has(id)) {
        throw new EngineError("INVALID_COMPONENT", `duplicate component id "${id}" in pool`);
      }
      seen.add(id);
    }
  }
  const nodeSet = new Set(graph.nodes);
  if (nodeSet.size !== graph.nodes.length) {
    throw new EngineError("INVALID_GRAPH_INPUT", "graph contains duplicate nodes");
  }
  if (poolSet.size !== nodeSet.size || [...poolSet].some((id) => !nodeSet.has(id))) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      "pool component ids and graph nodes must match exactly"
    );
  }
}

function canonicalizeRequiredRoles(requiredRoles: readonly ComponentRole[]): ComponentRole[] {
  const unique = new Set<ComponentRole>();
  for (const role of requiredRoles) {
    if (!componentRoles.includes(role)) {
      throw new EngineError("INVALID_COMPONENT", `unknown required role "${String(role)}"`);
    }
    unique.add(role);
  }
  return [...unique].sort();
}

function validateSize(size: number, poolSize: number): void {
  if (!Number.isInteger(size) || size < 2) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `composition size must be an integer of at least 2 (received ${String(size)})`
    );
  }
  if (size > poolSize) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `composition size ${size} exceeds pool size ${poolSize}`
    );
  }
}

function candidateCount(poolSize: number, size: number): number {
  const smallerSide = Math.min(size, poolSize - size);
  let count = 1;
  for (let step = 1; step <= smallerSide; step += 1) {
    count = (count * (poolSize - step + 1)) / step;
    if (count > MAX_ENUMERATION_CANDIDATES) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `exact enumeration of C(${poolSize},${size}) exceeds the ${MAX_ENUMERATION_CANDIDATES}-candidate safety cap`
      );
    }
  }
  return count;
}

function combinations(ids: readonly string[], size: number): string[][] {
  const out: string[][] = [];
  const current: string[] = [];
  const walk = (start: number): void => {
    if (current.length === size) {
      out.push([...current]);
      return;
    }
    const remaining = size - current.length;
    for (let index = start; index <= ids.length - remaining; index += 1) {
      current.push(ids[index]);
      walk(index + 1);
      current.pop();
    }
  };
  walk(0);
  return out;
}

function resolveMembers(
  members: readonly string[],
  pool: readonly CandidateComponent[],
  graph: CultureGraph
): CandidateComponent[] {
  if (members.length < 2) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `composition must contain at least 2 members (received ${members.length})`
    );
  }
  const byId = new Map(pool.map((component) => [component.id, component]));
  const nodeSet = new Set(graph.nodes);
  const seen = new Set<string>();
  const resolved: CandidateComponent[] = [];
  for (const id of members) {
    if (seen.has(id)) {
      throw new EngineError("INVALID_COMPONENT", `duplicate composition member "${id}"`);
    }
    seen.add(id);
    const component = byId.get(id);
    if (component === undefined || !nodeSet.has(id)) {
      throw new EngineError("INVALID_COMPONENT", `unknown composition member "${id}"`);
    }
    resolved.push(component);
  }
  resolved.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return resolved;
}

function requireMeasuredEdge(index: ReadonlyMap<string, GraphEdge>, a: string, b: string): number {
  const edge = index.get(pairKey(a, b));
  if (edge === undefined || edge.state !== "measured" || edge.value === null) {
    throw new EngineError("INVALID_GRAPH_INPUT", `edge ${a}|${b} is not measured`);
  }
  return edge.value;
}

function evaluateSubset(
  ids: readonly string[],
  edgeIndex: ReadonlyMap<string, GraphEdge>,
  componentsById: ReadonlyMap<string, CandidateComponent>,
  requiredRoleSet: ReadonlySet<ComponentRole>
): boolean {
  const presentRoles = new Set<ComponentRole>();
  for (const id of ids) {
    const component = componentsById.get(id);
    if (component === undefined || component.evidenceState !== "measured") {
      return false;
    }
    presentRoles.add(component.role);
  }
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const edge = edgeIndex.get(pairKey(ids[left], ids[right]));
      if (edge === undefined || edge.state !== "measured" || edge.value === null) {
        return false;
      }
    }
  }
  for (const role of requiredRoleSet) {
    if (!presentRoles.has(role)) {
      return false;
    }
  }
  return true;
}

function measureSubset(
  ids: readonly string[],
  edgeIndex: ReadonlyMap<string, GraphEdge>
): MeasuredComposition {
  const pairs: { a: string; b: string; value: number }[] = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      pairs.push({
        a: ids[left],
        b: ids[right],
        value: requireMeasuredEdge(edgeIndex, ids[left], ids[right])
      });
    }
  }
  if (pairs.length === 0) {
    throw new EngineError("INVALID_GRAPH_INPUT", "composition produced no internal edges");
  }
  let sum = 0;
  let weakest: WeakestLink = { a: pairs[0].a, b: pairs[0].b, value: pairs[0].value };
  for (const pair of pairs) {
    sum += pair.value;
    if (pair.value < weakest.value) {
      weakest = { a: pair.a, b: pair.b, value: pair.value };
    }
  }
  const coherence = Math.min(1, Math.max(0, sum / pairs.length));
  return { members: [...ids], size: ids.length, coherence, weakestLink: weakest };
}

function normalizeDistinctiveness(
  lookup: Readonly<Record<string, number | null>> | undefined
): Readonly<Record<string, number | null>> | undefined {
  if (lookup === undefined) {
    return undefined;
  }
  for (const id of Object.keys(lookup).sort()) {
    const value = lookup[id];
    if (value === null) {
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new EngineError(
        "INVALID_COMPONENT",
        `distinctiveness value for "${id}" must be null or a finite number within [0,1]`
      );
    }
  }
  return lookup;
}

function distinctivenessMean(
  members: readonly string[],
  lookup: Readonly<Record<string, number | null>> | undefined
): number | null {
  if (lookup === undefined) {
    return null;
  }
  let sum = 0;
  for (const id of members) {
    if (!Object.hasOwn(lookup, id)) {
      return null;
    }
    const value = lookup[id];
    if (value === null || !Number.isFinite(value)) {
      return null;
    }
    sum += value;
  }
  return Math.min(1, Math.max(0, sum / members.length));
}

export function compareMemberArrays(left: readonly string[], right: readonly string[]): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] < right[index] ? -1 : 1;
    }
  }
  return left.length - right.length;
}

export function measureComposition(
  members: readonly string[],
  pool: readonly CandidateComponent[],
  graph: CultureGraph
): MeasuredComposition {
  assertPoolGraphConsistent(pool, graph);
  const resolved = resolveMembers(members, pool, graph);
  return measureSubset(
    resolved.map((component) => component.id),
    buildEdgeIndex(graph)
  );
}

export function isRoleValidSubset(
  members: readonly string[],
  input: SubsetValidityInput
): boolean {
  const { pool, graph, requiredRoles } = input;
  assertPoolGraphConsistent(pool, graph);
  const roles = canonicalizeRequiredRoles(requiredRoles);
  const resolved = resolveMembers(members, pool, graph);
  return evaluateSubset(
    resolved.map((component) => component.id),
    buildEdgeIndex(graph),
    new Map(resolved.map((component) => [component.id, component])),
    new Set(roles)
  );
}

export function percentileOf(
  coherence: number,
  familyCoherences: readonly number[]
): number | null {
  if (!Number.isFinite(coherence)) {
    throw new EngineError("INVALID_GRAPH_INPUT", "percentile target coherence must be finite");
  }
  if (familyCoherences.length === 0) {
    return null;
  }
  let below = 0;
  for (const value of familyCoherences) {
    if (!Number.isFinite(value)) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        "percentile family coherences must be finite numbers"
      );
    }
    if (value < coherence) {
      below += 1;
    }
  }
  return (100 * below) / familyCoherences.length;
}

export function buildCompositions(input: CompositionInput): CompositionFamily {
  const { pool, graph, size, requiredRoles, distinctiveness } = input;
  assertPoolGraphConsistent(pool, graph);
  const canonicalRoles = canonicalizeRequiredRoles(requiredRoles);
  validateSize(size, pool.length);
  const normalizedDistinctiveness = normalizeDistinctiveness(distinctiveness);
  const totalCandidates = candidateCount(pool.length, size);
  const ids = pool.map((component) => component.id).sort();
  const candidates = combinations(ids, size);
  const edgeIndex = buildEdgeIndex(graph);
  const componentsById = new Map(pool.map((component) => [component.id, component]));
  const requiredRoleSet: ReadonlySet<ComponentRole> = new Set(canonicalRoles);
  const valid: MeasuredComposition[] = [];
  for (const candidate of candidates) {
    if (evaluateSubset(candidate, edgeIndex, componentsById, requiredRoleSet)) {
      valid.push(measureSubset(candidate, edgeIndex));
    }
  }
  valid.sort((left, right) => compareMemberArrays(left.members, right.members));
  const coherences = valid.map((entry) => entry.coherence);
  const compositions: Composition[] = [];
  for (const entry of valid) {
    const parsed = compositionSchema.safeParse({
      members: entry.members,
      size: entry.size,
      coherence: entry.coherence,
      weakestLink: entry.weakestLink,
      percentile: percentileOf(entry.coherence, coherences),
      distinctivenessMean: distinctivenessMean(entry.members, normalizedDistinctiveness)
    });
    if (!parsed.success) {
      throw new EngineError(
        "INVALID_GRAPH_INPUT",
        `constructed composition failed validation: ${describeIssues(parsed.error)}`
      );
    }
    Object.freeze(parsed.data.members);
    Object.freeze(parsed.data);
    compositions.push(parsed.data);
  }
  const frozenRoles = [...canonicalRoles];
  Object.freeze(frozenRoles);
  Object.freeze(compositions);
  const family: CompositionFamily = {
    poolSize: pool.length,
    size,
    requiredRoles: frozenRoles,
    totalCandidates,
    totalValid: compositions.length,
    compositions
  };
  return Object.freeze(family);
}
