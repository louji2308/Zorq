import { EngineError } from "./types.js";
import {
  buildCompositions,
  compareMemberArrays,
  type Composition,
  type CompositionInput,
  type WeakestLink
} from "./compositions.js";

export const DEFAULT_RANK_WEIGHT = 0.5;
export const SWEEP_POINT_COUNT = 101;

export interface RankedComposition {
  members: string[];
  size: number;
  coherence: number;
  percentile: number | null;
  distinctivenessMean: number;
  weakestLink: WeakestLink;
  rankScore: number;
}

export type RankingExclusionReason = "distinctiveness_unavailable";

export interface RankingExclusion {
  members: string[];
  reason: RankingExclusionReason;
}

export interface RankingOutcome {
  weight: number;
  ranked: RankedComposition[];
  excluded: RankingExclusion[];
}

export interface SweepPoint {
  weight: number;
  leader: string[] | null;
}

export interface SweepFlip {
  index: number;
  weight: number;
  from: string[] | null;
  to: string[] | null;
}

export interface RivalSweep {
  points: SweepPoint[];
  flips: SweepFlip[];
}

export interface RankingResult extends RankingOutcome {
  sweep: RivalSweep;
}

export interface RankingInput extends CompositionInput {
  weight?: number;
}

type RankableComposition = Composition & { distinctivenessMean: number };

interface PreparedEntry {
  composition: RankableComposition;
  zCoherence: number;
  zDistinctiveness: number;
}

interface ScoredEntry extends PreparedEntry {
  rankScore: number;
}

interface PreparedRanking {
  entries: PreparedEntry[];
  excluded: RankingExclusion[];
}

function validateWeight(weight: number): void {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new EngineError(
      "INVALID_GRAPH_INPUT",
      `rank weight w must be within [0,1] (received ${String(weight)})`
    );
  }
}

function isRankable(composition: Composition): composition is RankableComposition {
  return composition.distinctivenessMean !== null;
}

function prepareRanking(compositions: readonly Composition[]): PreparedRanking {
  const rankable: RankableComposition[] = [];
  const excluded: RankingExclusion[] = [];
  for (const composition of compositions) {
    if (isRankable(composition)) {
      rankable.push(composition);
    } else {
      excluded.push({
        members: [...composition.members],
        reason: "distinctiveness_unavailable"
      });
    }
  }
  const coherenceZ = populationZScores(rankable.map((composition) => composition.coherence));
  const distinctivenessZ = populationZScores(
    rankable.map((composition) => composition.distinctivenessMean)
  );
  const entries = rankable.map((composition, index) => ({
    composition,
    zCoherence: coherenceZ[index],
    zDistinctiveness: distinctivenessZ[index]
  }));
  return { entries, excluded };
}

function scoreEntries(entries: readonly PreparedEntry[], weight: number): ScoredEntry[] {
  return entries.map((entry) => ({
    ...entry,
    rankScore: entry.zCoherence * (1 - weight) + entry.zDistinctiveness * weight
  }));
}

function compareScored(left: ScoredEntry, right: ScoredEntry): number {
  if (left.rankScore !== right.rankScore) {
    return right.rankScore - left.rankScore;
  }
  const leftWeakest = left.composition.weakestLink.value;
  const rightWeakest = right.composition.weakestLink.value;
  if (leftWeakest !== rightWeakest) {
    return rightWeakest - leftWeakest;
  }
  return compareMemberArrays(left.composition.members, right.composition.members);
}

function toRankedComposition(entry: ScoredEntry): RankedComposition {
  const ranked: RankedComposition = {
    members: [...entry.composition.members],
    size: entry.composition.size,
    coherence: entry.composition.coherence,
    percentile: entry.composition.percentile,
    distinctivenessMean: entry.composition.distinctivenessMean,
    weakestLink: { ...entry.composition.weakestLink },
    rankScore: entry.rankScore
  };
  return Object.freeze(ranked);
}

export function populationZScores(values: readonly number[]): number[] {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new EngineError("INVALID_GRAPH_INPUT", "z-score inputs must be finite numbers");
    }
  }
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

export function rankCompositionSet(
  compositions: readonly Composition[],
  weight: number = DEFAULT_RANK_WEIGHT
): RankingOutcome {
  validateWeight(weight);
  const { entries, excluded } = prepareRanking(compositions);
  const ranked = scoreEntries(entries, weight)
    .sort(compareScored)
    .map(toRankedComposition);
  Object.freeze(ranked);
  const outcome: RankingOutcome = { weight, ranked, excluded };
  return Object.freeze(outcome);
}

export function rivalSweep(compositions: readonly Composition[]): RivalSweep {
  const { entries } = prepareRanking(compositions);
  const points: SweepPoint[] = [];
  const flips: SweepFlip[] = [];
  let previousLeader: string[] | null = null;
  let previousLeaderKey: string | null = null;
  for (let step = 0; step < SWEEP_POINT_COUNT; step += 1) {
    const weight = step / (SWEEP_POINT_COUNT - 1);
    const ordered = scoreEntries(entries, weight).sort(compareScored);
    const leader = ordered.length > 0 ? [...ordered[0].composition.members] : null;
    const leaderKey = leader === null ? null : JSON.stringify(leader);
    points.push({ weight, leader });
    if (step > 0 && leaderKey !== previousLeaderKey) {
      flips.push({ index: step, weight, from: previousLeader, to: leader });
    }
    previousLeaderKey = leaderKey;
    previousLeader = leader;
  }
  const sweep: RivalSweep = { points, flips };
  return Object.freeze(sweep);
}

export function rankCompositions(input: RankingInput): RankingResult {
  const weight = input.weight ?? DEFAULT_RANK_WEIGHT;
  validateWeight(weight);
  const family = buildCompositions(input);
  const outcome = rankCompositionSet(family.compositions, weight);
  const sweep = rivalSweep(family.compositions);
  const result: RankingResult = {
    weight: outcome.weight,
    ranked: outcome.ranked,
    excluded: outcome.excluded,
    sweep
  };
  return Object.freeze(result);
}
