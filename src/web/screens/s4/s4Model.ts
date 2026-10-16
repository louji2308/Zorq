/*
 * S4 Challenge view-model (Product Spec §7 S4; Final Design §7.4).
 *
 * Pure projection of the persisted `run.challengeReport` — never fabricates a
 * verdict, attack, circle, or number (AGENTS §12/§13). No report = the honest
 * pre-verdict state ("Can the leader be broken?"), never an optimistic default.
 * Status gating mirrors the server's `guardMutationState` + ranked guard
 * (orchestrator/replace.ts:141, challenge.ts:1108) so the button does not
 * invite a guaranteed refusal; the server stays the authority on errors.
 */
import { attackKinds, type AttackKind, type ChallengeReport, type RunState } from "../../../shared/run.js";

export type S4Circle = "filled" | "half" | "crossed" | "empty";

export type S4AttackStatus = "measured" | "skipped" | "not completed";

export interface S4AttackRow {
  readonly kind: AttackKind;
  /** Plain-language attack name (Final Design §7.4 spec order wording). */
  readonly name: string;
  /** One line describing what the attack asks. */
  readonly asks: string;
  readonly status: S4AttackStatus;
  readonly circle: S4Circle;
  readonly summary: string;
  readonly detail: string;
  readonly evidenceId: string | null;
}

export interface S4LeaderRow {
  readonly key: string;
  readonly name: string;
  /** Removed by a mutation: the name strikes through but stays legible. */
  readonly struck: boolean;
  /** Swap: the new name slides in beneath the struck one. */
  readonly replacement: string | null;
  /** Present only after the challenge (bridge insert or rival redraw). */
  readonly added: boolean;
}

export interface S4Model {
  readonly hasVerdict: boolean;
  readonly verdictWord: "Survived" | "Revised" | "Replaced" | null;
  readonly verdictSquare: "solid" | "half-hatched" | "crossed" | null;
  /** Always the server's reason; Replaced prepends "Replaced by {rival}". */
  readonly verdictSentence: string;
  readonly rivalLabel: string | null;
  readonly attacks: readonly S4AttackRow[];
  readonly leaderRows: readonly S4LeaderRow[];
  readonly mutationCount: number;
  readonly rounds: number;
  readonly gradeCap: "A" | "B" | null;
  readonly attackOrderSource: "llm" | "diagnostic" | null;
  /** True when the server would accept POST /challenge (best-effort mirror). */
  readonly challengeReady: boolean;
  readonly blockedReason: string | null;
}

export const PRE_VERDICT_QUESTION = "Can the leader be broken?";

const ATTACK_COPY: Record<AttackKind, { name: string; asks: string }> = {
  ablation: {
    name: "Remove a member",
    asks: "What happens to coherence if one member disappears?"
  },
  substitution: {
    name: "Substitute a member",
    asks: "Can a same-role alternative do the job with no loss?"
  },
  bridge: {
    name: "Bridge the weakest link",
    asks: "Is there something both audiences love that ties the weakest pair together?"
  },
  catchment: {
    name: "Shift the catchment",
    asks: "Does the reading hold when the city catchment shifts?"
  },
  rival: {
    name: "Check the rival",
    asks: "Is a rival composition close enough to take the lead?"
  }
};

function circleFor(status: S4AttackStatus): S4Circle {
  if (status === "measured") {
    return "filled";
  }
  return status === "not completed" ? "crossed" : "empty";
}

function squareFor(verdict: "Survived" | "Revised" | "Replaced"): "solid" | "half-hatched" | "crossed" {
  if (verdict === "Survived") {
    return "solid";
  }
  return verdict === "Revised" ? "half-hatched" : "crossed";
}

function buildLeaderRows(report: ChallengeReport): S4LeaderRow[] {
  const before = report.leaderBefore.members;
  const after = report.leaderAfter.members;
  const afterSet = new Set(after);
  const swapIn = new Map<string, string>();
  const shown = new Set<string>();
  for (const mutation of report.mutations) {
    if (mutation.operator === "swap" && mutation.memberOut !== null && mutation.memberIn !== null) {
      swapIn.set(mutation.memberOut, mutation.memberIn);
      shown.add(mutation.memberIn);
    }
  }
  const rows: S4LeaderRow[] = before.map((name) => ({
    key: `before:${name}`,
    name,
    struck: !afterSet.has(name),
    replacement: swapIn.get(name) ?? null,
    added: false
  }));
  for (const name of after) {
    if (!before.includes(name) && !shown.has(name)) {
      rows.push({ key: `after:${name}`, name, struck: false, replacement: null, added: true });
      shown.add(name);
    }
  }
  return rows;
}

function challengeGate(run: RunState | null): { ready: boolean; reason: string | null } {
  if (run === null) {
    return { ready: false, reason: "The run has not loaded yet." };
  }
  if (run.status === "prior_pending" || run.status === "investigating") {
    return {
      ready: false,
      reason: "Measurement must finish before the plan can be challenged."
    };
  }
  if (run.status === "stopped" || run.status === "failed") {
    return {
      ready: false,
      reason: "A stopped or failed run no longer accepts a challenge."
    };
  }
  if (run.compositions === undefined) {
    return {
      ready: false,
      reason: "Compositions must finish measuring before the plan can be challenged."
    };
  }
  if (run.compositions.ranked.length === 0) {
    return { ready: false, reason: "There is no ranked leader to challenge yet." };
  }
  return { ready: true, reason: null };
}

export function buildS4Model(run: RunState | null): S4Model | null {
  const gate = challengeGate(run);
  if (run === null) {
    return null;
  }
  const report = run.challengeReport;
  if (report === undefined) {
    return {
      hasVerdict: false,
      verdictWord: null,
      verdictSquare: null,
      verdictSentence: "",
      rivalLabel: null,
      attacks: [],
      leaderRows: [],
      mutationCount: 0,
      rounds: 0,
      gradeCap: null,
      attackOrderSource: null,
      challengeReady: gate.ready,
      blockedReason: gate.reason
    };
  }
  const rivalLabel =
    report.verdict === "Replaced" && report.verdictRival !== undefined
      ? report.verdictRival.join(", ")
      : null;
  return {
    hasVerdict: true,
    verdictWord: report.verdict,
    verdictSquare: squareFor(report.verdict),
    verdictSentence:
      rivalLabel === null ? report.reason : `Replaced by ${rivalLabel}. ${report.reason}`,
    rivalLabel,
    attacks: [...report.attacks]
      .sort((left, right) => attackKinds.indexOf(left.kind) - attackKinds.indexOf(right.kind))
      .map((attack) => ({
      kind: attack.kind,
      name: ATTACK_COPY[attack.kind].name,
      asks: ATTACK_COPY[attack.kind].asks,
      status: attack.status,
      circle: circleFor(attack.status),
      summary: attack.summary,
      detail: attack.detail,
      evidenceId: attack.evidenceId ?? null
    })),
    leaderRows: buildLeaderRows(report),
    mutationCount: report.mutations.length,
    rounds: report.rounds,
    gradeCap: report.gradeCap,
    attackOrderSource: report.attackOrderSource,
    challengeReady: gate.ready,
    blockedReason: gate.reason
  };
}

/** Spec order for the five attack families (Plan line 740). */
export const S4_ATTACK_ORDER = attackKinds;
