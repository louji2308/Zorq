import type {
  PoolComponentRole,
  RunCompositions,
  RunCompositionFamily,
  RunPriorMarker,
  RunRankedComposition,
  RunState
} from "../../../shared/run.js";
import { poolComponentRoles } from "../../../shared/run.js";

export const FIELD_BIN_COUNT = 12;
export const FINALIST_COUNT = 3;
export const DEFAULT_DIAL_WEIGHT = 0.5;

export interface S2FieldBin {
  readonly start: number;
  readonly end: number;
  readonly count: number;
  readonly fraction: number;
}

export interface S2FieldMark {
  readonly key: string;
  readonly label: string;
  readonly coherence: number;
  readonly position: number;
  readonly percentile: number | null;
  readonly dashed: boolean;
}

export interface S2FieldTick {
  readonly label: string;
  readonly position: number;
}

export interface S2FieldModel {
  readonly bins: readonly S2FieldBin[];
  readonly binCount: number;
  readonly domainMin: number;
  readonly domainMax: number;
  readonly totalValid: number;
  readonly marks: readonly S2FieldMark[];
  readonly ticks: readonly S2FieldTick[];
  readonly summary: string;
}

export interface OverIndexMember {
  readonly memberId: string;
  readonly overIndexes: boolean;
  readonly measured: boolean;
}

export interface OverIndexProjection {
  readonly perMember: readonly OverIndexMember[];
  readonly measuredCount: number;
  readonly overIndexCount: number;
  readonly neighborhoodsAvailable: boolean;
}

export interface S2MemberModel {
  readonly id: string;
  readonly name: string;
  readonly role: PoolComponentRole | null;
  readonly overIndexes: boolean;
  readonly measured: boolean;
}

export interface S2RoleGroup {
  readonly role: string;
  readonly members: readonly S2MemberModel[];
}

export interface S2PercentileReading {
  readonly sentence: string;
  readonly value: number | null;
}

export interface S2DistinctivenessReading {
  readonly sentence: string;
  readonly overIndexCount: number | null;
  readonly measuredCount: number;
  readonly total: number;
}

export interface S2WeakestLinkReading {
  readonly sentence: string;
  readonly a: string;
  readonly b: string;
  readonly value: number;
}

export interface S2Readings {
  readonly percentile: S2PercentileReading;
  readonly distinctiveness: S2DistinctivenessReading;
  readonly weakestLink: S2WeakestLinkReading | null;
}

export interface S2CardModel {
  readonly key: string;
  readonly memberIds: readonly string[];
  readonly grade: "A" | "B" | "C";
  readonly gradeReasons: readonly string[];
  readonly members: readonly S2MemberModel[];
  readonly roleGroups: readonly S2RoleGroup[];
  readonly readings: S2Readings;
  readonly coherence: number;
  readonly percentile: number | null;
  readonly distinctivenessMean: number;
  readonly weakestValue: number;
  readonly storedRankScore: number;
}

export interface S2PriorCardModel {
  readonly state: "measured" | "not measured";
  readonly members: readonly S2MemberModel[];
  readonly coherence: number | null;
  readonly percentile: number | null;
  readonly reading: string | null;
  readonly reason: string | null;
  readonly distinctiveness: S2DistinctivenessReading | null;
}

export interface S2Model {
  readonly headline: string;
  readonly field: S2FieldModel | null;
  readonly emptyReason: string | null;
  readonly poolNote: string | null;
  readonly prior: S2PriorCardModel;
  readonly cards: readonly S2CardModel[];
  readonly rankedAll: readonly S2CardModel[];
  readonly totalValid: number;
  readonly excludedCount: number;
}

export function prettifyMemberId(id: string): string {
  const spaced = id
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (spaced === "") {
    return id;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatCoherence(value: number): string {
  return value.toFixed(2);
}

function quantileOf(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

function positionInDomain(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (max > min) {
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  }
  return 0.5;
}

export function binDistribution(
  values: readonly number[],
  binCount: number = FIELD_BIN_COUNT
): { bins: S2FieldBin[]; domainMin: number; domainMax: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return { bins: [], domainMin: 0, domainMax: 1 };
  }
  let min = finite[0] ?? 0;
  let max = finite[0] ?? 0;
  for (const value of finite) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const count = Math.max(1, Math.floor(binCount));
  if (max === min) {
    return {
      bins: [{ start: min, end: max, count: finite.length, fraction: 1 }],
      domainMin: min,
      domainMax: max
    };
  }
  const width = (max - min) / count;
  const counts = new Array<number>(count).fill(0);
  for (const value of finite) {
    let slot = Math.floor((value - min) / width);
    if (slot >= count) slot = count - 1;
    if (slot < 0) slot = 0;
    counts[slot] = (counts[slot] ?? 0) + 1;
  }
  const bins: S2FieldBin[] = counts.map((binCountForSlot, index) => ({
    start: min + width * index,
    end: min + width * (index + 1),
    count: binCountForSlot,
    fraction: binCountForSlot / finite.length
  }));
  return { bins, domainMin: min, domainMax: max };
}

export function buildField(
  family: RunCompositionFamily,
  finalists: readonly RunRankedComposition[],
  prior: RunPriorMarker
): S2FieldModel | null {
  const distribution = family.coherenceDistribution;
  if (distribution.length === 0 || family.totalValid === 0) {
    return null;
  }
  const { bins, domainMin, domainMax } = binDistribution(distribution);
  const sorted = [...distribution].sort((left, right) => left - right);
  const marks: S2FieldMark[] = finalists.map((composition, index) => ({
    key: composition.members.join("|"),
    label: ["A", "B", "C"][index] ?? String(index + 1),
    coherence: composition.coherence,
    position: positionInDomain(composition.coherence, domainMin, domainMax),
    percentile: composition.percentile,
    dashed: false
  }));
  if (prior.state === "measured") {
    marks.push({
      key: "prior",
      label: "P",
      coherence: prior.coherence,
      position: positionInDomain(prior.coherence, domainMin, domainMax),
      percentile: prior.percentile,
      dashed: true
    });
  }
  const tickPercents = [0.1, 0.3, 0.5, 0.7, 0.9];
  const tickLabels = ["10th", "30th", "50th", "70th", "90th"];
  const ticks: S2FieldTick[] = tickPercents.map((p, index) => ({
    label: tickLabels[index] ?? "",
    position: positionInDomain(quantileOf(sorted, p), domainMin, domainMax)
  }));
  const summary = `The field holds ${family.totalValid} valid combinations with coherence between ${formatCoherence(domainMin)} and ${formatCoherence(domainMax)}.`;
  return {
    bins,
    binCount: bins.length,
    domainMin,
    domainMax,
    totalValid: family.totalValid,
    marks,
    ticks,
    summary
  };
}

function artistWeightSum(neighborhood: { readonly domains: { readonly artist: readonly { readonly weight: number }[] } }): number {
  let sum = 0;
  for (const entry of neighborhood.domains.artist) {
    sum += entry.weight;
  }
  return sum;
}

export function projectOverIndex(run: RunState | null, memberIds: readonly string[]): OverIndexProjection {
  const neighborhoods = run?.neighborhoods;
  if (neighborhoods === undefined || neighborhoods === null) {
    return {
      perMember: memberIds.map((memberId) => ({ memberId, overIndexes: false, measured: false })),
      measuredCount: 0,
      overIndexCount: 0,
      neighborhoodsAvailable: false
    };
  }
  const siteById = new Map(neighborhoods.components.map((entry) => [entry.componentId, entry]));
  const cityById = new Map(neighborhoods.city.map((entry) => [entry.componentId, entry]));
  const perMember: OverIndexMember[] = memberIds.map((memberId) => {
    const site = siteById.get(memberId);
    const city = cityById.get(memberId);
    if (site === undefined || city === undefined || site.state !== "measured" || city.state !== "measured") {
      return { memberId, overIndexes: false, measured: false };
    }
    return {
      memberId,
      overIndexes: artistWeightSum(site) > artistWeightSum(city),
      measured: true
    };
  });
  return {
    perMember,
    measuredCount: perMember.filter((entry) => entry.measured).length,
    overIndexCount: perMember.filter((entry) => entry.overIndexes).length,
    neighborhoodsAvailable: true
  };
}

export function formatPercentileSentence(percentile: number | null, totalValid: number): string {
  if (percentile === null || !Number.isFinite(percentile)) {
    return "Coherence percentile was not measured against this pool.";
  }
  return `More coherent than ${Math.round(percentile)}% of ${totalValid} valid combinations from this pool`;
}

function formatDistinctivenessSentence(projection: OverIndexProjection, total: number): S2DistinctivenessReading {
  if (!projection.neighborhoodsAvailable || projection.measuredCount === 0) {
    return {
      sentence: "Not measured — local over-index is unavailable for this run.",
      overIndexCount: null,
      measuredCount: projection.measuredCount,
      total
    };
  }
  const unmeasured = total - projection.measuredCount;
  const base = `${projection.overIndexCount} of ${total} members over-index locally`;
  return {
    sentence: unmeasured > 0 ? `${base} — ${unmeasured} not measured` : base,
    overIndexCount: projection.overIndexCount,
    measuredCount: projection.measuredCount,
    total
  };
}

export function compareMemberKeys(left: readonly string[], right: readonly string[]): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const l = left[index] ?? "";
    const r = right[index] ?? "";
    if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return left.length - right.length;
}

export function populationZScores(values: readonly number[]): number[] {
  const count = values.length;
  if (count === 0) {
    return [];
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  const mean = sum / count;
  let squaredDeviations = 0;
  for (const value of values) {
    squaredDeviations += (value - mean) ** 2;
  }
  const sigma = Math.sqrt(squaredDeviations / count);
  if (sigma === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => (value - mean) / sigma);
}

export function clampDialWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return DEFAULT_DIAL_WEIGHT;
  }
  return Math.min(1, Math.max(0, weight));
}

export function rerankCards(cards: readonly S2CardModel[], weight: number): S2CardModel[] {
  const w = clampDialWeight(weight);
  const coherenceZ = populationZScores(cards.map((card) => card.coherence));
  const distinctivenessZ = populationZScores(cards.map((card) => card.distinctivenessMean));
  const scored = cards.map((card, index) => ({
    card,
    score: (coherenceZ[index] ?? 0) * (1 - w) + (distinctivenessZ[index] ?? 0) * w
  }));
  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.card.weakestValue !== right.card.weakestValue) {
      return right.card.weakestValue - left.card.weakestValue;
    }
    return compareMemberKeys(left.card.memberIds, right.card.memberIds);
  });
  return scored.map((entry) => entry.card);
}

function buildMembers(
  run: RunState,
  memberIds: readonly string[]
): { members: S2MemberModel[]; roleGroups: S2RoleGroup[]; projection: OverIndexProjection } {
  const projection = projectOverIndex(run, memberIds);
  const overIndexById = new Map(projection.perMember.map((entry) => [entry.memberId, entry]));
  const poolById = new Map((run.candidatePool ?? []).map((component) => [component.id, component]));
  const members: S2MemberModel[] = memberIds.map((id) => {
    const over = overIndexById.get(id) ?? { memberId: id, overIndexes: false, measured: false };
    return {
      id,
      name: prettifyMemberId(id),
      role: poolById.get(id)?.role ?? null,
      overIndexes: over.overIndexes,
      measured: over.measured
    };
  });
  const knownRoles = poolComponentRoles.filter((role) => members.some((member) => member.role === role));
  const roleGroups: S2RoleGroup[] = knownRoles.map((role) => ({
    role,
    members: members.filter((member) => member.role === role)
  }));
  const unassigned = members.filter((member) => member.role === null);
  if (unassigned.length > 0) {
    roleGroups.push({ role: "Unassigned", members: unassigned });
  }
  return { members, roleGroups, projection };
}

function buildCard(run: RunState, composition: RunRankedComposition, totalValid: number): S2CardModel {
  const { members, roleGroups, projection } = buildMembers(run, composition.members);
  const weakest = composition.weakestLink;
  return {
    key: composition.members.join("|"),
    memberIds: [...composition.members],
    grade: composition.grade,
    gradeReasons: [...composition.gradeReasons],
    members,
    roleGroups,
    readings: {
      percentile: {
        sentence: formatPercentileSentence(composition.percentile, totalValid),
        value: composition.percentile
      },
      distinctiveness: formatDistinctivenessSentence(projection, composition.members.length),
      weakestLink: {
        sentence: `${prettifyMemberId(weakest.a)} ↔ ${prettifyMemberId(weakest.b)}, weak`,
        a: prettifyMemberId(weakest.a),
        b: prettifyMemberId(weakest.b),
        value: weakest.value
      }
    },
    coherence: composition.coherence,
    percentile: composition.percentile,
    distinctivenessMean: composition.distinctivenessMean,
    weakestValue: weakest.value,
    storedRankScore: composition.rankScore
  };
}

function buildPriorCard(run: RunState, prior: RunPriorMarker, totalValid: number): S2PriorCardModel {
  if (prior.state === "not measured") {
    return {
      state: "not measured",
      members: [],
      coherence: null,
      percentile: null,
      reading: null,
      reason: prior.reason,
      distinctiveness: null
    };
  }
  const { members, projection } = buildMembers(run, prior.members);
  return {
    state: "measured",
    members,
    coherence: prior.coherence,
    percentile: prior.percentile,
    reading: formatPercentileSentence(prior.percentile, totalValid),
    reason: null,
    distinctiveness: formatDistinctivenessSentence(projection, prior.members.length)
  };
}

function buildHeadline(prior: RunPriorMarker, rankedAll: readonly S2CardModel[]): string {
  if (prior.state === "not measured") {
    return "The first guess was not measured against this pool — these options stand on their own evidence.";
  }
  const leader = rankedAll[0];
  if (leader === undefined) {
    return "No composition could be ranked from this pool.";
  }
  const priorSet = new Set(prior.members);
  const leaderSet = new Set(leader.memberIds);
  const same =
    priorSet.size === leaderSet.size && [...priorSet].every((member) => leaderSet.has(member));
  if (same) {
    return "The evidence confirmed the first guess.";
  }
  let moved = 0;
  for (const member of prior.members) {
    if (!leaderSet.has(member)) {
      moved += 1;
    }
  }
  return `The evidence moved ${moved} of ${leader.memberIds.length} components.`;
}

function emptyFamilyReason(family: RunCompositionFamily): string {
  if (family.reason !== undefined && family.reason.trim() !== "") {
    return family.reason;
  }
  return "No valid combination of this pool could be measured — nothing is shown as a field.";
}

export function buildS2Model(run: RunState | null): S2Model | null {
  const compositions: RunCompositions | null | undefined = run?.compositions;
  if (run === null || compositions === undefined || compositions === null) {
    return null;
  }
  const family = compositions.family;
  const totalValid = family.totalValid;
  const rankedAll = compositions.ranked.map((composition) => buildCard(run, composition, totalValid));
  const finalists = compositions.ranked.slice(0, FINALIST_COUNT);
  const field = buildField(family, finalists, compositions.prior);
  const prior = buildPriorCard(run, compositions.prior, totalValid);
  const poolNote =
    totalValid < 3 ? `Only ${totalValid} valid combinations from this pool.` : null;
  return {
    headline: buildHeadline(compositions.prior, rankedAll),
    field,
    emptyReason: field === null ? emptyFamilyReason(family) : null,
    poolNote,
    prior,
    cards: rankedAll.slice(0, FINALIST_COUNT),
    rankedAll,
    totalValid,
    excludedCount: compositions.excluded.length
  };
}
