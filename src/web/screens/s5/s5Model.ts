/*
 * S5 Blueprint view-model (Product Spec §7 S5; Final Design §7.5).
 *
 * Pure projection of the server-authored `Blueprint` plus the run's brief and
 * frozen Prior. Numbers are never recomputed here — the server owns numeric
 * truth (AGENTS §13); this file only formats and arranges it. Citation
 * superscripts map ONLY to margin receipts, and an unknown `[id]` token is
 * dropped rather than rendered (AGENTS §13: unknown evidence IDs never
 * present as confirmed). The confident-empty Without-Qloo case is derived
 * strictly from the diff arrays — never manufactured (Plan line 803).
 */
import type { Blueprint, BlueprintMember, BlueprintReceipt, BlueprintRoleGroup } from "../../../shared/routes.js";
import type { Brief } from "../../../shared/brief.js";
import { extractPriorMemberEntries, type RunState } from "../../../shared/run.js";

export type S5CompareState = "changed" | "neutral" | "no-prior";

export interface S5TitleBlock {
  readonly project: string;
  readonly site: string;
  readonly area: string;
  readonly constraints: string;
  readonly grade: "A" | "B" | "C";
  readonly revision: string;
  readonly date: string;
  readonly runId: string;
}

export type S5RationaleSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ref"; readonly ref: number };

export interface S5ReceiptRow {
  readonly index: number;
  readonly memberName: string;
  readonly kind: BlueprintReceipt["kind"];
  readonly text: string;
  readonly evidenceIds: readonly string[];
}

export interface S5MemberRow {
  readonly key: string;
  readonly role: string;
  readonly name: string;
  readonly formatLabel: string | null;
  readonly footprintLabel: string | null;
  readonly footprintFraction: number | null;
  readonly hoursLabel: string | null;
  readonly downshiftSentence: string | null;
  readonly receiptIndexes: readonly number[];
}

export interface S5HoursSegment {
  readonly from: number;
  readonly to: number;
}

export interface S5HoursRow {
  readonly name: string;
  readonly segments: readonly S5HoursSegment[];
}

export interface S5FitModel {
  readonly areaLabel: string;
  readonly totalLabel: string;
  readonly withinUsable: boolean;
  readonly rule: string;
  readonly hoursRows: readonly S5HoursRow[];
  readonly constraintReads: readonly { readonly label: string; readonly source: string }[];
  readonly downshiftSentences: readonly string[];
}

export type S5SlopeKind = "kept" | "reformatted" | "removed" | "added";

export interface S5SlopePair {
  readonly member: string;
  readonly kind: S5SlopeKind;
  /** Listed on the Prior (left) side, in dashed type. */
  readonly onPrior: boolean;
  /** Listed on the Final (right) side, in solid type. */
  readonly onFinal: boolean;
}

export interface S5RiskRow {
  readonly kind: string;
  readonly text: string;
  readonly evidenceIds: readonly string[];
}

export interface S5RevisionRow {
  readonly rev: number;
  readonly sentence: string;
}

export interface S5CompareColumnMember {
  readonly name: string;
  readonly changed: boolean;
}

export interface S5CompareModel {
  readonly state: S5CompareState;
  readonly neutralLine: string;
  readonly polish: string | null;
  readonly priorMembers: readonly S5CompareColumnMember[];
  readonly finalMembers: readonly S5CompareColumnMember[];
}

export interface S5Model {
  readonly title: string;
  readonly titleBlock: S5TitleBlock;
  readonly narrativeSource: Blueprint["narrativeSource"];
  readonly rationaleSegments: readonly S5RationaleSegment[];
  readonly receipts: readonly S5ReceiptRow[];
  readonly memberRows: readonly S5MemberRow[];
  readonly fit: S5FitModel;
  readonly slope: readonly S5SlopePair[];
  readonly diffSentence: string;
  readonly risks: readonly S5RiskRow[];
  readonly evidenceGrade: {
    readonly grade: "A" | "B" | "C";
    readonly rule: string;
    readonly reasons: readonly string[];
  };
  readonly revisions: readonly S5RevisionRow[];
  readonly methodUrl: string;
  readonly shareUrl: string;
  readonly compare: S5CompareModel;
}

const CITATION_TOKEN = /\[([^[\]]{1,100})\]/g;

function formatSqFt(value: number | null | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "Not recorded";
  }
  return `${Math.round(value).toLocaleString("en-US")} sq ft`;
}

function parseHour(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 24 || minute > 59) {
    return null;
  }
  return hour + minute / 60;
}

function hoursSegments(open: string, close: string): S5HoursSegment[] | null {
  const from = parseHour(open);
  const to = parseHour(close);
  if (from === null || to === null) {
    return null;
  }
  if (to > from) {
    return [{ from, to }];
  }
  return [
    { from: 0, to },
    { from, to: 24 }
  ];
}

function fractionOf(value: number | null, total: number | null): number | null {
  if (value === null || total === null || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, value / total));
}

function buildReceipts(
  groups: readonly BlueprintRoleGroup[]
): { rows: S5ReceiptRow[]; byEvidence: Map<string, number> } {
  const rows: S5ReceiptRow[] = [];
  const byEvidence = new Map<string, number>();
  for (const group of groups) {
    for (const member of group.members) {
      for (const receipt of member.receipts) {
        const index = rows.length + 1;
        rows.push({
          index,
          memberName: member.name,
          kind: receipt.kind,
          text: receipt.text,
          evidenceIds: receipt.evidenceIds
        });
        for (const id of receipt.evidenceIds) {
          if (!byEvidence.has(id)) {
            byEvidence.set(id, index);
          }
        }
      }
    }
  }
  return { rows, byEvidence };
}

export function buildRationaleSegments(
  rationale: string,
  byEvidence: ReadonlyMap<string, number>
): S5RationaleSegment[] {
  const segments: S5RationaleSegment[] = [];
  let cursor = 0;
  CITATION_TOKEN.lastIndex = 0;
  for (let match = CITATION_TOKEN.exec(rationale); match !== null; match = CITATION_TOKEN.exec(rationale)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: "text", text: rationale.slice(cursor, start) });
    }
    const ref = byEvidence.get(match[1] ?? "");
    if (ref !== undefined) {
      segments.push({ kind: "ref", ref });
    }
    cursor = start + match[0].length;
  }
  if (cursor < rationale.length) {
    segments.push({ kind: "text", text: rationale.slice(cursor) });
  }
  return segments;
}

function buildMemberRows(
  groups: readonly BlueprintRoleGroup[],
  areaSqFt: number | null,
  byReceiptMember: ReadonlyMap<string, number[]>
): S5MemberRow[] {
  const rows: S5MemberRow[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      rows.push(toMemberRow(group.role, member, areaSqFt, byReceiptMember));
    }
  }
  return rows;
}

function toMemberRow(
  role: string,
  member: BlueprintMember,
  areaSqFt: number | null,
  byReceiptMember: ReadonlyMap<string, number[]>
): S5MemberRow {
  const format = member.format;
  return {
    key: `${role}:${member.memberId}`,
    role,
    name: member.name,
    formatLabel: format === undefined ? null : `${format.formatName} · ${format.typeDisplayName}`,
    footprintLabel:
      format === undefined
        ? null
        : `${Math.round(format.footprintSqFtMin).toLocaleString("en-US")}–${Math.round(format.footprintSqFtMax).toLocaleString("en-US")} sq ft`,
    footprintFraction:
      format === undefined ? null : fractionOf(format.footprintSqFtMax, areaSqFt),
    hoursLabel: format === undefined ? null : `${format.open}–${format.close}`,
    downshiftSentence:
      format === undefined || format.downshiftedFrom === null
        ? null
        : `${format.downshiftedFrom} becomes ${format.formatName}.`,
    receiptIndexes: byReceiptMember.get(member.name) ?? []
  };
}

function buildSlope(bp: Blueprint): S5SlopePair[] {
  const { kept, added, removed, reformatted } = bp.whatQlooChanged;
  const pairs: S5SlopePair[] = [];
  for (const item of kept) {
    pairs.push({ member: item.member, kind: "kept", onPrior: true, onFinal: true });
  }
  for (const item of reformatted) {
    pairs.push({ member: item.member, kind: "reformatted", onPrior: true, onFinal: true });
  }
  for (const item of removed) {
    pairs.push({ member: item.member, kind: "removed", onPrior: true, onFinal: false });
  }
  for (const item of added) {
    pairs.push({ member: item.member, kind: "added", onPrior: false, onFinal: true });
  }
  return pairs;
}

function diffSentence(bp: Blueprint): string {
  const { kept, added, removed, reformatted } = bp.whatQlooChanged;
  return `Qloo kept ${kept.length}, reformatted ${reformatted.length}, removed ${removed.length}, and added ${added.length}.`;
}

/**
 * Confident-empty detection (Final Design §7.5, Plan line 803): neutral only
 * when the diff proves every prior member was kept and nothing was added,
 * removed, or reformatted. An empty diff with no prior members is NOT
 * confidence — it is an honest "no comparison" state.
 */
export function compareState(bp: Blueprint): S5CompareState {
  const { kept, added, removed, reformatted } = bp.whatQlooChanged;
  const untouched = added.length === 0 && removed.length === 0 && reformatted.length === 0;
  if (untouched && kept.length > 0) {
    return "neutral";
  }
  if (untouched && kept.length === 0) {
    return "no-prior";
  }
  return "changed";
}

function buildCompare(run: RunState | null, bp: Blueprint): S5CompareModel {
  const state = compareState(bp);
  const changedNames = new Set(
    [...bp.whatQlooChanged.added, ...bp.whatQlooChanged.reformatted].map((item) =>
      item.member.toLowerCase()
    )
  );
  const priorComposition = run?.prior?.composition;
  const priorMembers =
    priorComposition === undefined
      ? []
      : extractPriorMemberEntries(priorComposition).map((entry) => ({
          name: entry.name,
          changed: changedNames.has(entry.name.toLowerCase())
        }));
  const finalMembers: S5CompareColumnMember[] = bp.compositionByRole.flatMap((group) =>
    group.members.map((member) => ({
      name: member.name,
      changed: changedNames.has(member.name.toLowerCase())
    }))
  );
  return {
    state,
    neutralLine: "Here, the evidence changed nothing.",
    polish: run?.prior?.polish ?? null,
    priorMembers,
    finalMembers
  };
}

function revisionSentence(revision: Blueprint["revisionHistory"][number]): string {
  const before = Math.round(revision.coherenceBefore * 100);
  const after = Math.round(revision.coherenceAfter * 100);
  const verb = revision.custom ? "Replaced" : "Swapped";
  return `Rev ${revision.rev}. ${verb} ${revision.replacedMember} with ${revision.newMember}. Coherence moved from ${before}% to ${after}%.`;
}

export function blueprintToMarkdown(bp: Blueprint, runId: string): string {
  const lines: string[] = [];
  lines.push(`# ${bp.title}`);
  lines.push("");
  lines.push(`Evidence grade: ${bp.evidenceGrade.grade} — ${bp.evidenceGrade.rule}`);
  lines.push(`Run: ${runId} · Generated: ${bp.generatedAt}`);
  lines.push("");
  lines.push("## Rationale");
  lines.push(bp.rationale);
  lines.push("");
  lines.push("## Composition by role");
  for (const group of bp.compositionByRole) {
    for (const member of group.members) {
      const format =
        member.format === undefined
          ? ""
          : ` — ${member.format.formatName} (${member.format.typeDisplayName})`;
      lines.push(`- ${group.role}: ${member.name}${format}`);
    }
  }
  lines.push("");
  lines.push("## Fit to site");
  lines.push(bp.fitToSite.footprint.rule);
  for (const downshift of bp.fitToSite.downshifts) {
    lines.push(`- ${downshift.sentence}`);
  }
  lines.push("");
  lines.push("## What Qloo changed");
  for (const [label, items] of [
    ["Kept", bp.whatQlooChanged.kept],
    ["Reformatted", bp.whatQlooChanged.reformatted],
    ["Removed", bp.whatQlooChanged.removed],
    ["Added", bp.whatQlooChanged.added]
  ] as const) {
    if (items.length > 0) {
      lines.push(`- ${label}: ${items.map((item) => item.member).join(", ")}`);
    }
  }
  if (compareState(bp) === "neutral") {
    lines.push("Here, the evidence changed nothing.");
  }
  lines.push("");
  lines.push("## Risks");
  if (bp.risks.length === 0) {
    lines.push("- No risks were flagged.");
  }
  for (const risk of bp.risks) {
    lines.push(`- ${risk.text}`);
  }
  lines.push("");
  lines.push("## Revisions");
  for (const revision of bp.revisionHistory) {
    lines.push(`- ${revisionSentence(revision)}`);
  }
  lines.push("");
  lines.push(`Share: ${bp.shareUrl}`);
  return lines.join("\n");
}

export function buildS5Model(run: RunState | null, blueprint: Blueprint | null): S5Model | null {
  if (blueprint === null) {
    return null;
  }
  const brief: Brief | undefined = run?.brief;
  const areaSqFt = brief?.areaSqFt ?? null;
  const { rows: receipts, byEvidence } = buildReceipts(blueprint.compositionByRole);
  const byReceiptMember = new Map<string, number[]>();
  for (const receipt of receipts) {
    const list = byReceiptMember.get(receipt.memberName) ?? [];
    list.push(receipt.index);
    byReceiptMember.set(receipt.memberName, list);
  }
  const slope = buildSlope(blueprint);
  const lastRev =
    blueprint.revisionHistory.length === 0
      ? 0
      : Math.max(...blueprint.revisionHistory.map((entry) => entry.rev));
  const hoursRows: S5HoursRow[] = [];
  for (const entry of blueprint.fitToSite.hours.timeline) {
    const segments = hoursSegments(entry.open, entry.close);
    if (segments !== null) {
      hoursRows.push({ name: entry.name, segments });
    }
  }
  return {
    title: blueprint.title,
    titleBlock: {
      project: brief?.objective ?? "Not recorded",
      site: brief?.location ?? "Not recorded",
      area: formatSqFt(areaSqFt),
      constraints:
        brief?.constraints !== undefined && brief.constraints.length > 0
          ? brief.constraints.join("; ")
          : "None recorded",
      grade: blueprint.evidenceGrade.grade,
      revision: lastRev === 0 ? "Rev 0" : `Rev ${lastRev}`,
      date: blueprint.generatedAt,
      runId: run?.id ?? ""
    },
    narrativeSource: blueprint.narrativeSource,
    rationaleSegments: buildRationaleSegments(blueprint.rationale, byEvidence),
    receipts,
    memberRows: buildMemberRows(blueprint.compositionByRole, areaSqFt, byReceiptMember),
    fit: {
      areaLabel: formatSqFt(areaSqFt),
      totalLabel: formatSqFt(blueprint.fitToSite.footprint.totalFootprintSqFt),
      withinUsable: blueprint.fitToSite.footprint.withinUsable,
      rule: blueprint.fitToSite.footprint.rule,
      hoursRows,
      constraintReads: blueprint.fitToSite.hours.constraintReads.map((entry) => ({
        label: entry.key,
        source: entry.source
      })),
      downshiftSentences: blueprint.fitToSite.downshifts.map((entry) => entry.sentence)
    },
    slope,
    diffSentence: diffSentence(blueprint),
    risks: blueprint.risks.map((risk) => ({
      kind: risk.kind,
      text: risk.text,
      evidenceIds: risk.evidenceIds
    })),
    evidenceGrade: {
      grade: blueprint.evidenceGrade.grade,
      rule: blueprint.evidenceGrade.rule,
      reasons: blueprint.evidenceGrade.reasons
    },
    revisions: blueprint.revisionHistory.map((revision) => ({
      rev: revision.rev,
      sentence: revisionSentence(revision)
    })),
    methodUrl: blueprint.methodUrl,
    shareUrl: blueprint.shareUrl,
    compare: buildCompare(run, blueprint)
  };
}
