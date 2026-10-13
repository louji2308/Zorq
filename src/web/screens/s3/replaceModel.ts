import type {
  PoolComponent,
  PoolComponentRole,
  RunRankedComposition,
  RunRevision,
  RunState
} from "../../../shared/run.js";
import { prettifyMemberId } from "../s2/s2Model.js";

export const REPLACE_ALTERNATIVE_CAP = 5;
export const REPLACE_POOL_CAP = 10;

export interface ReplaceAlternative {
  readonly id: string;
  readonly name: string;
  readonly measurable: boolean;
  readonly blockedNote: string | null;
  readonly coherenceAfter: number | null;
  readonly distinctivenessAfter: number | null;
  readonly percentileAfter: number | null;
  readonly deltaCoherence: number | null;
  readonly deltaDistinctiveness: number | null;
}

export interface ReplaceRevisionRow {
  readonly rev: number;
  readonly replacedName: string;
  readonly newName: string;
  readonly role: PoolComponentRole;
  readonly deltaCoherence: number;
  readonly custom: boolean;
}

export interface ReplaceStressRow {
  readonly kind: string;
  readonly status: string;
  readonly summary: string;
  readonly detail: string;
}

export interface ReplaceSuccess {
  readonly verdict: string;
  readonly reason: string;
  readonly rows: readonly ReplaceStressRow[];
}

export interface ReplaceModel {
  readonly memberId: string;
  readonly memberName: string;
  readonly role: PoolComponentRole;
  readonly membersBefore: readonly string[];
  readonly coherenceBefore: number;
  readonly percentileBefore: number | null;
  readonly alternatives: readonly ReplaceAlternative[];
  readonly emptyReason: string | null;
  readonly barCoherenceMax: number;
  readonly barDistinctivenessMax: number;
  readonly customBlockedReason: string | null;
  readonly revisions: readonly ReplaceRevisionRow[];
}

export type ReplaceModelResult = { ok: true; model: ReplaceModel } | { ok: false; reason: string };

export function signedDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const present = new Set(left);
  return right.every((member) => present.has(member));
}

function componentName(component: PoolComponent): string {
  return component.exemplars[0]?.name ?? prettifyMemberId(component.id);
}

function keyWanted(key: string): string[] {
  return key
    .split(/[+|]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function findBefore(
  run: RunState,
  memberId: string,
  compositionKey: string | null = null
): RunRankedComposition | null {
  if (run.compositions === undefined) {
    return null;
  }
  const ranked = run.compositions.ranked;
  const key = (compositionKey ?? "").trim();
  if (key !== "") {
    const wanted = keyWanted(key);
    const keyed = ranked.find((composition) => sameMembers(composition.members, wanted));
    if (keyed === undefined) {
      return null;
    }
    return keyed.members.includes(memberId) ? keyed : null;
  }
  return ranked.find((composition) => composition.members.includes(memberId)) ?? null;
}

function buildAlternative(
  run: RunState,
  memberId: string,
  before: RunRankedComposition,
  candidate: PoolComponent
): ReplaceAlternative {
  const swapped = before.members.map((member) => (member === memberId ? candidate.id : member));
  const after =
    run.compositions === undefined
      ? undefined
      : run.compositions.ranked.find((composition) => sameMembers(composition.members, swapped));
  const name = componentName(candidate);
  if (after === undefined) {
    return {
      id: candidate.id,
      name,
      measurable: false,
      blockedNote: "This swap lands outside the ranked family, so it has no measured reading.",
      coherenceAfter: null,
      distinctivenessAfter: null,
      percentileAfter: null,
      deltaCoherence: null,
      deltaDistinctiveness: null
    };
  }
  return {
    id: candidate.id,
    name,
    measurable: true,
    blockedNote: null,
    coherenceAfter: after.coherence,
    distinctivenessAfter: after.distinctivenessMean,
    percentileAfter: after.percentile,
    deltaCoherence: after.coherence - before.coherence,
    deltaDistinctiveness: after.distinctivenessMean - before.distinctivenessMean
  };
}

function compareAlternatives(left: ReplaceAlternative, right: ReplaceAlternative): number {
  const leftRank = left.measurable ? 0 : 1;
  const rightRank = right.measurable ? 0 : 1;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  if (left.measurable && right.measurable) {
    const deltaC = right.deltaCoherence ?? 0;
    const deltaCLeft = left.deltaCoherence ?? 0;
    if (deltaC !== deltaCLeft) {
      return deltaC - deltaCLeft;
    }
    const deltaD = right.deltaDistinctiveness ?? 0;
    const deltaDLeft = left.deltaDistinctiveness ?? 0;
    if (deltaD !== deltaDLeft) {
      return deltaD - deltaDLeft;
    }
  }
  if (left.id !== right.id) {
    return left.id < right.id ? -1 : 1;
  }
  return 0;
}

function buildRevisionRows(run: RunState): ReplaceRevisionRow[] {
  const poolById = new Map((run.candidatePool ?? []).map((component) => [component.id, component]));
  const nameOf = (id: string): string => {
    const component = poolById.get(id);
    return component === undefined ? prettifyMemberId(id) : componentName(component);
  };
  return (run.revisions ?? []).map((revision: RunRevision) => ({
    rev: revision.rev,
    replacedName: nameOf(revision.replacedMember),
    newName: nameOf(revision.newMember),
    role: revision.role,
    deltaCoherence: revision.coherenceAfter - revision.coherenceBefore,
    custom: revision.custom
  }));
}

export function buildReplaceModel(
  run: RunState | null,
  memberId: string,
  compositionKey: string | null = null
): ReplaceModelResult {
  if (run === null) {
    return { ok: false, reason: "This run has not loaded yet, so there is nothing to replace." };
  }
  const pool = run.candidatePool ?? [];
  if (pool.length === 0) {
    return { ok: false, reason: "This run has no measured candidate pool yet, so there is nothing to replace." };
  }
  const member = pool.find((component) => component.id === memberId);
  if (member === undefined) {
    return {
      ok: false,
      reason: `${prettifyMemberId(memberId)} is not in the candidate pool, so there is nothing to replace.`
    };
  }
  const memberName = componentName(member);
  if (run.compositions === undefined || run.compositions.ranked.length === 0) {
    return {
      ok: false,
      reason: `This run has no ranked composition yet, so ${memberName} has no measured role to replace.`
    };
  }
  const key = (compositionKey ?? "").trim();
  if (key !== "") {
    const wanted = keyWanted(key);
    const keyed = run.compositions.ranked.find((composition) => sameMembers(composition.members, wanted));
    if (keyed === undefined) {
      return {
        ok: false,
        reason: "The selected composition is no longer part of the ranked family, so there is nothing to replace."
      };
    }
    if (!keyed.members.includes(memberId)) {
      return {
        ok: false,
        reason: `${memberName} is not a member of the selected composition, so there is no measured role to replace here.`
      };
    }
  }
  const before = findBefore(run, memberId, compositionKey);
  if (before === undefined || before === null) {
    return {
      ok: false,
      reason: `${memberName} is not part of a ranked composition, so there is no measured role to replace.`
    };
  }

  const beforeSet = new Set(before.members);
  const raw = pool
    .filter(
      (component) => component.role === member.role && component.id !== memberId && !beforeSet.has(component.id)
    )
    .map((component) => buildAlternative(run, memberId, before, component))
    .sort(compareAlternatives);
  const alternatives = raw.slice(0, REPLACE_ALTERNATIVE_CAP);

  let customBlockedReason: string | null = null;
  if (run.brief === undefined) {
    customBlockedReason =
      "Custom replacement resolves against the brief's site locality, and this run carries no brief.";
  } else if (pool.length >= REPLACE_POOL_CAP) {
    customBlockedReason = `The pool already holds ${pool.length} components — its cap — so custom replacement is unavailable.`;
  }

  const measurable = alternatives.filter((alternative) => alternative.measurable);
  const barCoherenceMax = measurable.reduce(
    (max, alternative) => Math.max(max, Math.abs(alternative.deltaCoherence ?? 0)),
    0
  );
  const barDistinctivenessMax = measurable.reduce(
    (max, alternative) => Math.max(max, Math.abs(alternative.deltaDistinctiveness ?? 0)),
    0
  );

  return {
    ok: true,
    model: {
      memberId,
      memberName,
      role: member.role,
      membersBefore: [...before.members],
      coherenceBefore: before.coherence,
      percentileBefore: before.percentile,
      alternatives,
      emptyReason:
        alternatives.length === 0 ? `No other ${member.role} candidates in this pool.` : null,
      barCoherenceMax,
      barDistinctivenessMax,
      customBlockedReason,
      revisions: buildRevisionRows(run)
    }
  };
}

function parseAttack(value: unknown): ReplaceStressRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.kind !== "string" ||
    typeof entry.status !== "string" ||
    typeof entry.summary !== "string" ||
    typeof entry.detail !== "string"
  ) {
    return null;
  }
  return { kind: entry.kind, status: entry.status, summary: entry.summary, detail: entry.detail };
}

export function readReplaceSuccess(run: RunState): ReplaceSuccess | null {
  const report: unknown = run.stressReport;
  if (typeof report !== "object" || report === null) {
    return null;
  }
  const candidate = report as Record<string, unknown>;
  if (candidate.kind !== "mini") {
    return null;
  }
  const rows: ReplaceStressRow[] = [];
  if (Array.isArray(candidate.attacks)) {
    for (const attack of candidate.attacks) {
      const row = parseAttack(attack);
      if (row !== null) {
        rows.push(row);
      }
    }
  }
  return {
    verdict: typeof candidate.verdict === "string" ? candidate.verdict : "Recorded",
    reason:
      typeof candidate.reason === "string"
        ? candidate.reason
        : "The replacement was measured and saved.",
    rows
  };
}
