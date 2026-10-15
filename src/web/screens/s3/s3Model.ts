import type {
  CandidatePool,
  PoolComponent,
  PoolComponentRole,
  RunCompositions,
  RunEvidenceNode,
  RunGraph,
  RunGraphEdge,
  RunRankedComposition,
  RunSharedEntity,
  RunState,
  RunTriangulationClassification
} from "../../../shared/run.js";
import { FINALIST_COUNT, prettifyMemberId } from "../s2/s2Model.js";

export const STRESS_HIGH = 0.25;
export const DISTORTION_RELATIVE = 0.1;
export const MARGIN = 0.08;
export const VISIBLE_TILES = 3;
export const EVIDENCE_LINK_CAP = 4;
export const TRI_THIN_MAX_RESULTS = 4;

export const SCALE_NOTE =
  "Distance shows shared culture. Nearer means more shared. The axes have no meaning.";

export const HOW_COMPUTED =
  "Shared entities are IDF-weighted taste neighborhoods both audiences over-index on; the direct check reranks places of one type for the other audience.";

export const UNMEASURED_COPY = "Not measured. This pair can't be part of a leading composition.";

const LETTERS = ["A", "B", "C"] as const;

const LAYOUT_CACHE_CAP = 8;

const layoutCache = new Map<string, MdsLayout>();

export type S3PairState =
  | "confirmed"
  | "strong"
  | "typical"
  | "weak"
  | "contested"
  | "thin"
  | "failed"
  | "measured"
  | "unmeasured";

export interface S3Position {
  readonly unitX: number;
  readonly unitY: number;
}

export interface S3LineStyle {
  readonly widthClass: "l2" | "l3" | "l4" | "l5";
  readonly dash: string | null;
  readonly tone: "ink" | "ink-800" | "ink-600" | "ink-500" | "ink-450";
}

export interface S3MemberModel {
  readonly id: string;
  readonly name: string;
  readonly role: PoolComponentRole | null;
}

export interface S3Option {
  readonly key: string;
  readonly letter: string;
  readonly label: string;
  readonly memberIds: readonly string[];
  readonly members: readonly S3MemberModel[];
  readonly kind: "ranked" | "prior";
}

export interface S3NodeModel {
  readonly id: string;
  readonly name: string;
  readonly role: PoolComponentRole | null;
  readonly member: boolean;
  readonly letter: string | null;
  readonly x: number;
  readonly y: number;
}

export interface S3PairModel {
  readonly key: string;
  readonly a: string;
  readonly b: string;
  readonly displayState: S3PairState;
  readonly style: S3LineStyle;
  readonly hasEdge: boolean;
  readonly hasTri: boolean;
  readonly sharedCount: number;
  readonly value: number | null;
  readonly distance: number;
  readonly inComposition: boolean;
  readonly isWeakest: boolean;
}

export interface S3ChartCell {
  readonly row: number;
  readonly col: number;
  readonly a: string;
  readonly b: string;
  readonly displayState: S3PairState;
  readonly style: S3LineStyle;
  readonly inComposition: boolean;
  readonly isWeakest: boolean;
  readonly pairKey: string;
}

export interface S3StressReading {
  readonly stress: number;
  readonly distortedCount: number;
  readonly jitter: boolean;
}

export interface S3Weakest {
  readonly a: string;
  readonly b: string;
  readonly key: string;
  readonly headline: string;
  readonly reason: string | null;
  readonly sentence: string;
}

export interface S3EvidenceTile {
  readonly entityId: string;
  readonly name: string;
  readonly domain: string;
  readonly rank: number;
  readonly contribution: number;
  readonly fraction: number;
}

export interface S3TriangulationReading {
  readonly state: "confirmed" | "contested" | "thin" | "failed" | null;
  readonly shape: "solid" | "half" | "hollow" | null;
  readonly sentence: string;
}

export interface S3EvidenceLink {
  readonly id: string;
  readonly label: string;
  readonly priority: number;
}

export interface S3PairEvidence {
  readonly a: string;
  readonly b: string;
  readonly aName: string;
  readonly bName: string;
  readonly claim: string | null;
  readonly provenance: "Qloo" | null;
  readonly tiles: readonly S3EvidenceTile[];
  readonly triangulation: S3TriangulationReading;
  readonly howComputed: string;
  readonly links: readonly S3EvidenceLink[];
  readonly unmeasured: boolean;
  readonly emptyReason: string | null;
}

export interface S3ProvenanceStep {
  readonly label: string;
  readonly value: string;
}

export interface S3NodeSheet {
  readonly id: string;
  readonly name: string;
  readonly role: PoolComponentRole | null;
  readonly evidenceState: string | null;
  readonly exemplars: readonly { readonly id: string; readonly name: string }[];
  readonly provenance: readonly S3ProvenanceStep[];
}

export interface S3Model {
  readonly nodes: readonly S3NodeModel[];
  readonly mapEdges: readonly S3PairModel[];
  readonly options: readonly S3Option[];
  readonly selected: S3Option | null;
  readonly pairs: readonly S3PairModel[];
  readonly chartCells: readonly S3ChartCell[];
  readonly stress: S3StressReading;
  readonly stressSentence: string;
  readonly scaleNote: string;
  readonly weakest: S3Weakest | null;
  readonly pulse: boolean;
  readonly emptyReason: string | null;
}

interface MdsLayout {
  readonly positions: readonly S3Position[];
  readonly jitter: boolean;
}

export function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function normalizeCompositionKey(key: string | null): string | null {
  if (key === null) {
    return null;
  }
  const parts = key
    .split(/[+|]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0) {
    return null;
  }
  return parts.join("+");
}

export function pairStateFor(
  edge: RunGraphEdge | null | undefined,
  tri: RunTriangulationClassification | null | undefined
): S3PairState {
  if (
    edge === null ||
    edge === undefined ||
    edge.state === "unmeasured" ||
    edge.sharedEntities === undefined ||
    edge.sharedEntities.length === 0
  ) {
    return "unmeasured";
  }
  if (tri !== null && tri !== undefined) {
    return tri.state;
  }
  if (edge.band !== null) {
    return edge.band;
  }
  return "measured";
}

export function lineStyleFor(state: S3PairState): S3LineStyle {
  switch (state) {
    case "confirmed":
    case "strong":
      return { widthClass: "l4", dash: null, tone: "ink" };
    case "typical":
      return { widthClass: "l3", dash: null, tone: "ink-800" };
    case "weak":
      return { widthClass: "l2", dash: null, tone: "ink-600" };
    case "thin":
      return { widthClass: "l2", dash: "1 3", tone: "ink-500" };
    case "contested":
    case "failed":
      return { widthClass: "l3", dash: "6 4", tone: "ink-600" };
    case "measured":
      return { widthClass: "l3", dash: null, tone: "ink-600" };
    case "unmeasured":
      return { widthClass: "l5", dash: "4 4", tone: "ink-450" };
  }
}

function normalizeVector(vector: readonly number[]): number[] | null {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  const norm = Math.sqrt(sum);
  if (norm < 1e-15) {
    return null;
  }
  return vector.map((value) => value / norm);
}

function matVec(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  return matrix.map((row) => {
    let sum = 0;
    for (let index = 0; index < vector.length; index += 1) {
      sum += (row[index] ?? 0) * (vector[index] ?? 0);
    }
    return sum;
  });
}

function quadForm(matrix: readonly (readonly number[])[], vector: readonly number[]): number {
  const product = matVec(matrix, vector);
  let sum = 0;
  for (let index = 0; index < vector.length; index += 1) {
    sum += (vector[index] ?? 0) * (product[index] ?? 0);
  }
  return sum;
}

function dot(left: readonly number[], right: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return sum;
}

function orthogonalize(vector: readonly number[], against: readonly number[]): number[] {
  const projection = dot(vector, against);
  return vector.map((value, index) => value - projection * (against[index] ?? 0));
}

function canonicalize(vector: readonly number[]): number[] {
  let bestIndex = 0;
  let bestAbs = Math.abs(vector[0] ?? 0);
  for (let index = 1; index < vector.length; index += 1) {
    const magnitude = Math.abs(vector[index] ?? 0);
    if (magnitude > bestAbs) {
      bestAbs = magnitude;
      bestIndex = index;
    }
  }
  if ((vector[bestIndex] ?? 0) < 0) {
    return vector.map((value) => -value);
  }
  return [...vector];
}

interface EigenPair {
  readonly value: number;
  readonly vector: readonly number[];
}

function powerIterate(
  matrix: readonly (readonly number[])[],
  start: readonly number[],
  against: EigenPair | null,
  tol: number,
  maxIter: number
): EigenPair | null {
  let seed = normalizeVector(start);
  if (seed === null) {
    return null;
  }
  if (against !== null) {
    seed = normalizeVector(orthogonalize(seed, against.vector));
    if (seed === null) {
      return null;
    }
  }
  let vector = seed;
  let lambda = 0;
  for (let iter = 0; iter < maxIter; iter += 1) {
    let product = matVec(matrix, vector);
    if (against !== null) {
      product = orthogonalize(product, against.vector);
    }
    const next = normalizeVector(product);
    if (next === null) {
      return null;
    }
    const nextLambda = quadForm(matrix, next);
    vector = next;
    if (Math.abs(nextLambda - lambda) < tol) {
      lambda = nextLambda;
      break;
    }
    lambda = nextLambda;
  }
  return { value: lambda, vector: canonicalize(vector) };
}

function linearStart(count: number): number[] {
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_unused, index) => index - center);
}

function fallbackStart(count: number, salt: number): number[] {
  return Array.from({ length: count }, (_unused, index) => ((index * 37 + salt * 53 + 11) % 97) - 48);
}

function jitterPositions(count: number): S3Position[] {
  return Array.from({ length: count }, (_unused, index) => ({
    unitX: ((index * 37) % 97) / 96,
    unitY: ((index * 53) % 89) / 88
  }));
}

function normalizePositions(rawX: readonly number[], rawY: readonly number[]): S3Position[] {
  const count = rawX.length;
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [{ unitX: 0.5, unitY: 0.5 }];
  }
  let minX = rawX[0] ?? 0;
  let maxX = rawX[0] ?? 0;
  let minY = rawY[0] ?? 0;
  let maxY = rawY[0] ?? 0;
  for (let index = 0; index < count; index += 1) {
    const x = rawX[index] ?? 0;
    const y = rawY[index] ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const maxExtent = Math.max(extentX, extentY);
  if (maxExtent < 1e-12) {
    return jitterPositions(count);
  }
  const scale = (1 - 2 * MARGIN) / maxExtent;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return Array.from({ length: count }, (_unused, index) => ({
    unitX: 0.5 + ((rawX[index] ?? 0) - centerX) * scale,
    unitY: 0.5 + ((rawY[index] ?? 0) - centerY) * scale
  }));
}

function distanceMatrix(
  count: number,
  edgeIndex: ReadonlyMap<string, RunGraphEdge>,
  nodes: readonly string[]
): number[][] {
  const matrix: number[][] = Array.from({ length: count }, () => new Array<number>(count).fill(0));
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) {
      const a = nodes[left] ?? "";
      const b = nodes[right] ?? "";
      const edge = edgeIndex.get(pairKey(a, b));
      const value = edge !== undefined && edge.value !== null ? edge.value : 0;
      const d = edge !== undefined && edge.value !== null ? 1 - value : 1;
      matrix[left][right] = d;
      matrix[right][left] = d;
    }
  }
  return matrix;
}

function doubleCenter(distances: readonly (readonly number[])[]): number[][] {
  const count = distances.length;
  const squared = distances.map((row) => row.map((value) => value * value));
  let grand = 0;
  for (let left = 0; left < count; left += 1) {
    for (let right = 0; right < count; right += 1) {
      grand += squared[left][right] ?? 0;
    }
  }
  grand /= count * count;
  const rowMeans = squared.map((row) => {
    let sum = 0;
    for (const value of row) {
      sum += value;
    }
    return sum / count;
  });
  return squared.map((row, left) =>
    row.map((value, right) => -0.5 * (value - (rowMeans[left] ?? 0) - (rowMeans[right] ?? 0) + grand))
  );
}

function computeMdsLayout(nodes: readonly string[], edges: readonly RunGraphEdge[]): MdsLayout {
  const count = nodes.length;
  if (count === 0) {
    return { positions: [], jitter: false };
  }
  if (count === 1) {
    return { positions: [{ unitX: 0.5, unitY: 0.5 }], jitter: false };
  }
  const edgeIndex = new Map(edges.map((edge) => [pairKey(edge.a, edge.b), edge]));
  const distances = distanceMatrix(count, edgeIndex, nodes);
  const centered = doubleCenter(distances);
  const first = powerIterate(centered, linearStart(count), null, 1e-14, 400);
  if (first === null || first.value <= 1e-12) {
    return { positions: jitterPositions(count), jitter: true };
  }
  let second = powerIterate(centered, linearStart(count), first, 1e-14, 400);
  if (second === null || second.value <= 1e-12) {
    for (let salt = 2; salt <= 6 && (second === null || second.value <= 1e-12); salt += 1) {
      second = powerIterate(centered, fallbackStart(count, salt), first, 1e-14, 400);
    }
  }
  const rawX = first.vector.map((value) => value * Math.sqrt(Math.max(0, first.value)));
  let rawY: number[];
  if (second !== null && second.value > 1e-12) {
    rawY = second.vector.map((value) => value * Math.sqrt(Math.max(0, second.value)));
  } else {
    rawY = new Array<number>(count).fill(0);
  }
  let spreadX = 0;
  let spreadY = 0;
  for (let index = 1; index < count; index += 1) {
    spreadX = Math.max(spreadX, Math.abs((rawX[index] ?? 0) - (rawX[0] ?? 0)));
    spreadY = Math.max(spreadY, Math.abs((rawY[index] ?? 0) - (rawY[0] ?? 0)));
  }
  if (spreadX < 1e-9 && spreadY < 1e-9) {
    return { positions: jitterPositions(count), jitter: true };
  }
  return { positions: normalizePositions(rawX, rawY), jitter: false };
}

export function computeMdsPositions(
  nodes: readonly string[],
  edges: readonly RunGraphEdge[]
): S3Position[] {
  return [...computeMdsLayout(nodes, edges).positions];
}

function layoutSignature(nodes: readonly string[], edges: readonly RunGraphEdge[]): string {
  const edgePart = edges
    .map((edge) => `${pairKey(edge.a, edge.b)}=${edge.value ?? "x"}`)
    .sort()
    .join(",");
  return `${nodes.join(",")}|${edgePart}`;
}

function getMdsLayout(nodes: readonly string[], edges: readonly RunGraphEdge[]): MdsLayout {
  const signature = layoutSignature(nodes, edges);
  const hit = layoutCache.get(signature);
  if (hit !== undefined) {
    layoutCache.delete(signature);
    layoutCache.set(signature, hit);
    return hit;
  }
  const layout = computeMdsLayout(nodes, edges);
  layoutCache.set(signature, layout);
  if (layoutCache.size > LAYOUT_CACHE_CAP) {
    const oldest = layoutCache.keys().next();
    if (!oldest.done) {
      layoutCache.delete(oldest.value);
    }
  }
  return layout;
}

export function computeStressReading(
  nodes: readonly string[],
  edges: readonly RunGraphEdge[],
  positions: readonly S3Position[],
  jitter: boolean = false
): S3StressReading {
  const count = nodes.length;
  if (count < 2 || positions.length !== count) {
    return { stress: 0, distortedCount: 0, jitter: count <= 1 ? false : jitter };
  }
  const edgeIndex = new Map(edges.map((edge) => [pairKey(edge.a, edge.b), edge]));
  const measured: { d: number; delta: number }[] = [];
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) {
      const edge = edgeIndex.get(pairKey(nodes[left] ?? "", nodes[right] ?? ""));
      const d = edge !== undefined && edge.value !== null ? 1 - edge.value : 1;
      const pa = positions[left];
      const pb = positions[right];
      if (pa === undefined || pb === undefined) {
        continue;
      }
      const delta = Math.hypot(pa.unitX - pb.unitX, pa.unitY - pb.unitY);
      measured.push({ d, delta });
    }
  }
  if (measured.length === 0) {
    return { stress: 0, distortedCount: 0, jitter };
  }
  let sumScaled = 0;
  let sumDeltaSq = 0;
  let sumDSq = 0;
  for (const pair of measured) {
    sumScaled += pair.d * pair.delta;
    sumDeltaSq += pair.delta * pair.delta;
    sumDSq += pair.d * pair.d;
  }
  const scale = sumDeltaSq > 0 ? sumScaled / sumDeltaSq : 0;
  let error = 0;
  let distortedCount = 0;
  for (const pair of measured) {
    error += (pair.d - scale * pair.delta) ** 2;
    if (pair.d > 0 && scale * pair.delta < pair.d * (1 - DISTORTION_RELATIVE)) {
      distortedCount += 1;
    }
  }
  const stress = sumDSq > 0 ? Math.sqrt(error / sumDSq) : 0;
  return { stress, distortedCount, jitter };
}

export function buildStressSentence(reading: S3StressReading): string {
  const base =
    reading.jitter || reading.stress >= STRESS_HIGH
      ? "The distance chart reads every pair exactly."
      : "This map keeps most pairwise distances accurately.";
  if (reading.jitter || reading.distortedCount === 0) {
    return base;
  }
  const count = reading.distortedCount;
  return `${base} ${count} pair${count === 1 ? " is" : "s are"} drawn closer than they were measured.`;
}

function buildEdgeIndex(edges: readonly RunGraphEdge[]): Map<string, RunGraphEdge> {
  return new Map(edges.map((edge) => [pairKey(edge.a, edge.b), edge]));
}

function buildTriIndex(
  triangulation: readonly RunTriangulationClassification[]
): Map<string, RunTriangulationClassification> {
  return new Map(triangulation.map((entry) => [pairKey(entry.a, entry.b), entry]));
}

function buildMembers(run: RunState, memberIds: readonly string[]): S3MemberModel[] {
  const poolById = new Map((run.candidatePool ?? []).map((component) => [component.id, component]));
  return memberIds.map((id) => ({
    id,
    name: prettifyMemberId(id),
    role: poolById.get(id)?.role ?? null
  }));
}

function buildOption(
  run: RunState,
  memberIds: readonly string[],
  key: string,
  letter: string,
  kind: "ranked" | "prior"
): S3Option {
  const members = buildMembers(run, memberIds);
  const label = kind === "prior" ? "Prior" : members.map((member) => member.name).join(" · ");
  return {
    key,
    letter,
    label,
    memberIds: [...memberIds],
    members,
    kind
  };
}

function buildOptions(run: RunState, compositions: RunCompositions): S3Option[] {
  const ranked = compositions.ranked.slice(0, FINALIST_COUNT);
  const options = ranked.map((composition, index) =>
    buildOption(
      run,
      composition.members,
      composition.members.join("+"),
      LETTERS[index] ?? String(index + 1),
      "ranked"
    )
  );
  if (compositions.prior.state === "measured") {
    options.push(buildOption(run, compositions.prior.members, "prior", "P", "prior"));
  }
  return options;
}

function gradeReasonSentence(state: string): string | null {
  if (state === "contested") {
    return "The direct check disagrees on this pair.";
  }
  if (state === "thin") {
    return "The direct check is thin on this pair.";
  }
  if (state === "failed") {
    return "The direct check failed on this pair.";
  }
  return null;
}

function findWeakestReason(
  weakestLink: { readonly a: string; readonly b: string },
  gradeReasons: readonly string[],
  edgeIndex: ReadonlyMap<string, RunGraphEdge>
): string | null {
  const key = pairKey(weakestLink.a, weakestLink.b);
  for (const reason of gradeReasons) {
    const match = /^edge (.+?)\|(.+) state=(confirmed|contested|thin|failed)$/.exec(reason);
    if (match === null) {
      continue;
    }
    const [, rawA, rawB, state] = match;
    if (rawA === undefined || rawB === undefined || state === undefined) {
      continue;
    }
    if (pairKey(rawA, rawB) === key) {
      const sentence = gradeReasonSentence(state);
      if (sentence !== null) {
        return sentence;
      }
      break;
    }
  }
  const edge = edgeIndex.get(key);
  if (edge === undefined || edge.state === "unmeasured") {
    return "This pair was not measured.";
  }
  if (edge.band !== null) {
    return `Shared culture between them is ${edge.band}.`;
  }
  return null;
}

function buildWeakest(
  run: RunState,
  selected: S3Option | null,
  edgeIndex: ReadonlyMap<string, RunGraphEdge>
): S3Weakest | null {
  if (selected === null || selected.kind !== "ranked" || run.compositions === undefined) {
    return null;
  }
  const composition: RunRankedComposition | undefined = run.compositions.ranked.find(
    (entry) => entry.members.join("+") === selected.key
  );
  if (composition === undefined) {
    return null;
  }
  const link = composition.weakestLink;
  const key = pairKey(link.a, link.b);
  const reason = findWeakestReason(link, composition.gradeReasons, edgeIndex);
  const aName = prettifyMemberId(link.a);
  const bName = prettifyMemberId(link.b);
  return {
    a: link.a,
    b: link.b,
    key,
    headline: `Weakest link: ${aName} and ${bName}.`,
    reason,
    sentence: reason ?? "This pair is the composition's weakest measured line."
  };
}

function buildPairs(
  nodes: readonly string[],
  memberSet: ReadonlySet<string>,
  edgeIndex: ReadonlyMap<string, RunGraphEdge>,
  triIndex: ReadonlyMap<string, RunTriangulationClassification>,
  weakestKey: string | null
): S3PairModel[] {
  const pairs: S3PairModel[] = [];
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left] ?? "";
      const b = nodes[right] ?? "";
      const key = pairKey(a, b);
      const edge = edgeIndex.get(key);
      const tri = triIndex.get(key);
      const displayState = pairStateFor(edge, tri);
      pairs.push({
        key,
        a,
        b,
        displayState,
        style: lineStyleFor(displayState),
        hasEdge: edge !== undefined,
        hasTri: tri !== undefined,
        sharedCount: edge?.sharedEntities?.length ?? 0,
        value: edge?.value ?? null,
        distance: edge !== undefined && edge.value !== null ? 1 - edge.value : 1,
        inComposition: memberSet.has(a) && memberSet.has(b),
        isWeakest: weakestKey !== null && key === weakestKey
      });
    }
  }
  pairs.sort((left, right) => {
    const leftUnmeasured = left.displayState === "unmeasured" ? 1 : 0;
    const rightUnmeasured = right.displayState === "unmeasured" ? 1 : 0;
    if (leftUnmeasured !== rightUnmeasured) {
      return leftUnmeasured - rightUnmeasured;
    }
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (left.a !== right.a) {
      return left.a < right.a ? -1 : 1;
    }
    return left.b < right.b ? -1 : 1;
  });
  return pairs;
}

function buildChartCells(
  nodes: readonly string[],
  memberSet: ReadonlySet<string>,
  pairByKey: ReadonlyMap<string, S3PairModel>
): S3ChartCell[] {
  const cells: S3ChartCell[] = [];
  for (let row = 0; row < nodes.length; row += 1) {
    for (let col = row + 1; col < nodes.length; col += 1) {
      const a = nodes[row] ?? "";
      const b = nodes[col] ?? "";
      const key = pairKey(a, b);
      const pair = pairByKey.get(key);
      if (pair === undefined) {
        continue;
      }
      cells.push({
        row,
        col,
        a,
        b,
        displayState: pair.displayState,
        style: pair.style,
        inComposition: memberSet.has(a) && memberSet.has(b),
        isWeakest: pair.isWeakest,
        pairKey: key
      });
    }
  }
  return cells;
}

export function resolveEntityName(entity: RunSharedEntity, pool: CandidatePool): string {
  if (entity.name !== undefined && entity.name.trim() !== "") {
    return entity.name;
  }
  for (const component of pool) {
    for (const exemplar of component.exemplars) {
      if (exemplar.id === entity.entityId) {
        return exemplar.name;
      }
    }
  }
  return entity.entityId;
}

function componentFor(run: RunState, nodeId: string): PoolComponent | null {
  return (run.candidatePool ?? []).find((component) => component.id === nodeId) ?? null;
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0] ?? "";
  }
  return `${names[0] ?? ""} and ${names[1] ?? ""}`;
}

function buildClaim(
  a: string,
  b: string,
  shared: readonly RunSharedEntity[],
  pool: CandidatePool
): string | null {
  const compA = pool.find((component) => component.id === a);
  const compB = pool.find((component) => component.id === b);
  if (compA === undefined || compB === undefined) {
    return null;
  }
  const listA = formatNameList(compA.exemplars.slice(0, 2).map((exemplar) => exemplar.name));
  const listB = formatNameList(compB.exemplars.slice(0, 2).map((exemplar) => exemplar.name));
  const top = [...shared]
    .sort((left, right) => right.dotContribution - left.dotContribution)
    .slice(0, 3)
    .map((entity) => resolveEntityName(entity, pool));
  if (listA === "" || listB === "" || top.length === 0) {
    return null;
  }
  return `Audiences of ${listA} and ${listB} both over-index on ${top.join(", ")}.`;
}

function buildTiles(shared: readonly RunSharedEntity[], pool: CandidatePool): S3EvidenceTile[] {
  const sorted = [...shared].sort((left, right) => right.dotContribution - left.dotContribution);
  const max = sorted[0]?.dotContribution ?? 0;
  return sorted.map((entity, index) => ({
    entityId: entity.entityId,
    name: resolveEntityName(entity, pool),
    domain: entity.domain,
    rank: index + 1,
    contribution: entity.dotContribution,
    fraction: max > 0 ? entity.dotContribution / max : 0
  }));
}

function buildTriangulationReading(
  tri: RunTriangulationClassification | null | undefined
): S3TriangulationReading {
  if (tri === null || tri === undefined) {
    return {
      state: null,
      shape: null,
      sentence: "Direct check not recorded for this pair."
    };
  }
  if (tri.state === "confirmed") {
    return {
      state: "confirmed",
      shape: "solid",
      sentence: "Direct check agrees: places of this type rank in the top half for the other audience."
    };
  }
  if (tri.state === "contested") {
    return {
      state: "contested",
      shape: "half",
      sentence:
        "Direct check disagrees: places of this type rank in the bottom half for the other audience."
    };
  }
  if (tri.state === "thin") {
    return {
      state: "thin",
      shape: "hollow",
      sentence: `Direct check is thin: only ${tri.resultCount} place${tri.resultCount === 1 ? "" : "s"} were returned for this pair.`
    };
  }
  if (tri.resultCount === 0) {
    return {
      state: "failed",
      shape: "hollow",
      sentence: "Direct check unavailable: no places were returned for this pair."
    };
  }
  return {
    state: "failed",
    shape: "hollow",
    sentence: "Direct check unavailable: the second measurement did not complete."
  };
}

function buildEvidenceLinks(
  evidence: readonly RunEvidenceNode[],
  terms: ReadonlySet<string>
): S3EvidenceLink[] {
  const scored: { link: S3EvidenceLink; index: number }[] = [];
  evidence.forEach((record, index) => {
    const text = `${record.label ?? ""} ${record.summary ?? ""}`.toLowerCase();
    let priority = -1;
    for (const term of terms) {
      if (text.includes(term)) {
        priority = 0;
        break;
      }
    }
    if (priority === -1 && record.kind === "insights") {
      priority = 1;
    }
    if (priority === -1) {
      return;
    }
    scored.push({
      link: {
        id: record.id,
        label: record.label ?? record.summary ?? record.id,
        priority
      },
      index
    });
  });
  scored.sort((left, right) => {
    if (left.link.priority !== right.link.priority) {
      return left.link.priority - right.link.priority;
    }
    return left.index - right.index;
  });
  return scored.slice(0, EVIDENCE_LINK_CAP).map((entry) => entry.link);
}

function collectTerms(component: PoolComponent | null): string[] {
  if (component === null) {
    return [];
  }
  const terms: string[] = [];
  for (const tag of component.tags) {
    if (tag.length >= 3) {
      terms.push(tag.toLowerCase());
    }
  }
  for (const exemplar of component.exemplars) {
    if (exemplar.name.length >= 3) {
      terms.push(exemplar.name.toLowerCase());
    }
  }
  return terms;
}

export function buildPairEvidence(
  run: RunState,
  a: string,
  b: string,
  edge: RunGraphEdge | null | undefined,
  tri: RunTriangulationClassification | null | undefined
): S3PairEvidence {
  const pool = run.candidatePool ?? [];
  const compA = componentFor(run, a);
  const compB = componentFor(run, b);
  const aName = compA?.exemplars[0]?.name ?? prettifyMemberId(a);
  const bName = compB?.exemplars[0]?.name ?? prettifyMemberId(b);
  const shared = edge?.sharedEntities ?? [];
  const unmeasured =
    edge === null ||
    edge === undefined ||
    edge.state === "unmeasured" ||
    shared.length === 0;
  const terms = new Set<string>([...collectTerms(compA), ...collectTerms(compB)]);
  const claim = unmeasured ? null : buildClaim(a, b, shared, pool);
  return {
    a,
    b,
    aName,
    bName,
    claim,
    provenance: claim !== null ? "Qloo" : null,
    tiles: unmeasured ? [] : buildTiles(shared, pool),
    triangulation: buildTriangulationReading(tri),
    howComputed: HOW_COMPUTED,
    links: buildEvidenceLinks(run.evidence ?? [], terms),
    unmeasured,
    emptyReason: unmeasured ? UNMEASURED_COPY : null
  };
}

export function buildNodeSheet(run: RunState, nodeId: string): S3NodeSheet {
  const component = componentFor(run, nodeId);
  if (component === null) {
    return {
      id: nodeId,
      name: prettifyMemberId(nodeId),
      role: null,
      evidenceState: null,
      exemplars: [],
      provenance: []
    };
  }
  const path = component.provenancePath;
  const provenance: S3ProvenanceStep[] = [
    { label: "Anchor place", value: path.anchorPlace },
    { label: "Qloo signal", value: path.qlooSignal },
    { label: "Resolved category", value: path.resolvedCategory },
    { label: "Exemplar set", value: path.exemplarSet },
    { label: "Taste neighborhood", value: path.tasteNeighborhood }
  ].filter((step) => step.value.trim() !== "");
  return {
    id: component.id,
    name: component.exemplars[0]?.name ?? prettifyMemberId(component.id),
    role: component.role,
    evidenceState: component.evidenceState,
    exemplars: component.exemplars.map((exemplar) => ({
      id: exemplar.id,
      name: exemplar.name
    })),
    provenance
  };
}

function displayOrder(state: S3PairState): number {
  if (state === "unmeasured") return 9;
  if (state === "confirmed" || state === "strong") return 0;
  if (state === "typical") return 1;
  if (state === "weak") return 2;
  if (state === "contested") return 3;
  if (state === "thin") return 4;
  if (state === "failed") return 5;
  return 6;
}

function sortPairsForDisplay(pairs: readonly S3PairModel[]): S3PairModel[] {
  return [...pairs].sort((left, right) => {
    const leftOrder = displayOrder(left.displayState);
    const rightOrder = displayOrder(right.displayState);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (left.a !== right.a) {
      return left.a < right.a ? -1 : 1;
    }
    return left.b < right.b ? -1 : 1;
  });
}

export function buildS3Model(
  run: RunState | null,
  requestedKey: string | null = null
): S3Model | null {
  if (run === null || run.graph === undefined || run.compositions === undefined) {
    return null;
  }
  const graph: RunGraph = run.graph;
  const nodes = [...graph.nodes].sort();
  if (nodes.length === 0) {
    return null;
  }
  const edges = graph.edges;
  const edgeIndex = buildEdgeIndex(edges);
  const triIndex = buildTriIndex(run.compositions.triangulation);
  const layout = getMdsLayout(nodes, edges);
  const options = buildOptions(run, run.compositions);
  const requested = normalizeCompositionKey(requestedKey);
  const matched = requested !== null ? options.find((option) => option.key === requested) : undefined;
  const selected = matched ?? options[0] ?? null;
  const memberIds = selected?.memberIds ?? [];
  const memberSet = new Set(memberIds);
  const weakest = buildWeakest(run, selected, edgeIndex);
  const rawPairs = buildPairs(nodes, memberSet, edgeIndex, triIndex, weakest?.key ?? null);
  const pairByKey = new Map(rawPairs.map((pair) => [pair.key, pair]));
  const displayPairs = sortPairsForDisplay(rawPairs);
  const letterById = new Map(memberIds.map((id, index) => [id, LETTERS[index] ?? null]));
  const poolById = new Map((run.candidatePool ?? []).map((component) => [component.id, component]));
  const s3Nodes: S3NodeModel[] = nodes.map((id, index) => {
    const position = layout.positions[index] ?? { unitX: 0.5, unitY: 0.5 };
    return {
      id,
      name: prettifyMemberId(id),
      role: poolById.get(id)?.role ?? null,
      member: memberSet.has(id),
      letter: letterById.get(id) ?? null,
      x: position.unitX,
      y: position.unitY
    };
  });
  const mapEdges = displayPairs.filter((pair) => pair.inComposition);
  const chartCells = buildChartCells(nodes, memberSet, pairByKey);
  const stress = computeStressReading(nodes, edges, layout.positions, layout.jitter);
  return {
    nodes: s3Nodes,
    mapEdges,
    options,
    selected,
    pairs: displayPairs,
    chartCells,
    stress,
    stressSentence: buildStressSentence(stress),
    scaleNote: SCALE_NOTE,
    weakest,
    pulse: weakest !== null,
    emptyReason: null
  };
}
