import { createHash, randomBytes } from "node:crypto";
import type { Brief } from "../../shared/brief.js";
import {
  blueprintSchema,
  type Blueprint,
  type BlueprintMember,
  type BlueprintReceipt,
  type BlueprintRisk,
  type BlueprintRoleGroup
} from "../../shared/routes.js";
import {
  componentDisplayName,
  poolComponentRoles,
  type ChallengeLeader,
  type PoolComponent,
  type RunState
} from "../../shared/run.js";
import type { LlmBudget } from "../agent/budget.js";
import { toError } from "../agent/errors.js";
import { completeBounded, type LlmClient, type LlmMessage } from "../agent/llm.js";
import type { Ledger } from "../agent/ledger.js";
import {
  CIRCULATION_ALLOWANCE,
  fitConstraints,
  gradeEvidence,
  type FitMemberInput,
  type FitResult,
  type FormatChoice
} from "../engine/index.js";
import { OrchestratorStateError } from "./errors.js";
import { computeEvent, extractPriorMemberEntries } from "./measure.js";

export const BLUEPRINT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EVIDENCE_RULE =
  "A: all leader edges confirmed. B: any contested, thin, or failed probe. C: any leader member unmeasured.";
const FOOTPRINT_RULE = `total footprint ≤ ${Math.round(CIRCULATION_ALLOWANCE * 100)}% of available area [Zorq heuristic]`;
const GRADE_CAP_B_REASON = "a stress probe did not complete; the plan grade cannot exceed B";
const CITATION_PATTERN = /\[([^[\]]{1,100})\]/g;
const NARRATIVE_LABEL = "blueprint:compose";

interface Narrative {
  title: string;
  rationale: string;
  source: "llm" | "deterministic";
}

interface EvidenceIndex {
  allowed: Set<string>;
  siteIds: (componentId: string) => string[];
  cityIds: (componentId: string) => string[];
}

interface LeaderView {
  leader: ChallengeLeader;
  members: Array<{ id: string; component: PoolComponent }>;
}

function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function guardPresent<T>(value: T | undefined, message: string, details: { path: string; message: string }): T {
  if (value === undefined || value === null) {
    throw new OrchestratorStateError(message, [details]);
  }
  return value;
}

export function blueprintFingerprint(state: RunState): string {
  const basis = {
    brief: state.brief ?? null,
    prior: state.prior ?? null,
    evidence: state.evidence ?? [],
    siteRead: state.siteRead ?? null,
    candidatePool: state.candidatePool ?? [],
    neighborhoods: state.neighborhoods ?? null,
    graph: state.graph ?? null,
    compositions: state.compositions ?? null,
    challengeReport: state.challengeReport ?? null,
    revisions: state.revisions ?? []
  };
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

export function mintShareToken(): string {
  return randomBytes(18).toString("base64url");
}

function buildEvidenceIndex(state: RunState, storedEvidenceIds: ReadonlySet<string>): EvidenceIndex {
  const allowed = new Set<string>();
  const record = (value: string | undefined): void => {
    if (typeof value === "string" && value.trim() !== "" && storedEvidenceIds.has(value)) {
      allowed.add(value);
    }
  };
  for (const node of state.evidence ?? []) {
    record(node.id);
  }
  for (const source of state.neighborhoods?.sources ?? []) {
    record(source.evidenceId);
  }
  for (const anchor of state.siteRead?.anchors ?? []) {
    record(anchor.evidenceId);
  }
  for (const attack of state.challengeReport?.attacks ?? []) {
    record(attack.evidenceId);
  }
  const site = new Map<string, string[]>();
  const city = new Map<string, string[]>();
  for (const source of state.neighborhoods?.sources ?? []) {
    const bucket = source.scope === "site" ? site : city;
    const list = bucket.get(source.componentId) ?? [];
    if (!list.includes(source.evidenceId)) {
      list.push(source.evidenceId);
    }
    bucket.set(source.componentId, list);
  }
  return {
    allowed,
    siteIds: (componentId) => site.get(componentId) ?? [],
    cityIds: (componentId) => city.get(componentId) ?? []
  };
}

function evidenceIds(index: EvidenceIndex, raw: readonly string[]): string[] {
  return raw.filter((id) => index.allowed.has(id)).slice(0, 6);
}

function memberEvidenceIds(index: EvidenceIndex, componentId: string): string[] {
  return evidenceIds(index, [...index.siteIds(componentId), ...index.cityIds(componentId)]);
}

function resolveLeaderView(state: RunState): LeaderView {
  const pool = guardPresent(
    state.candidatePool,
    `run ${state.id} carries no measured candidate pool; there is nothing to blueprint`,
    { path: "candidatePool", message: "the Place Blueprint requires a measured candidate pool" }
  );
  if (pool.length === 0) {
    throw new OrchestratorStateError(
      `run ${state.id} carries an empty candidate pool; the Place Blueprint refuses an invented composition`,
      [{ path: "candidatePool", message: "at least one measured component is required" }]
    );
  }
  const compositions = guardPresent(
    state.compositions,
    `run ${state.id} has no ranked composition; there is no leader to blueprint`,
    { path: "compositions", message: "the Place Blueprint requires a measured leader" }
  );
  const top = compositions.ranked[0];
  if (top === undefined) {
    throw new OrchestratorStateError(
      `run ${state.id} has no ranked composition; there is no leader to blueprint`,
      [{ path: "compositions.ranked", message: "at least one ranked composition is required" }]
    );
  }
  const report = state.challengeReport;
  const leader: ChallengeLeader =
    report !== undefined
      ? report.leaderAfter
      : {
          members: top.members,
          coherence: top.coherence,
          percentile: top.percentile,
          distinctivenessMean: top.distinctivenessMean,
          weakestLink: top.weakestLink
        };

  const components = new Map<string, PoolComponent>();
  for (const component of pool) {
    components.set(component.id, component);
  }
  for (const mutation of report?.mutations ?? []) {
    if (mutation.component !== undefined && !components.has(mutation.component.id)) {
      components.set(mutation.component.id, mutation.component);
    }
  }
  const members = leader.members.map((id) => {
    const component = components.get(id);
    if (component === undefined) {
      throw new OrchestratorStateError(
        `run ${state.id} leader member "${id}" is missing from the candidate pool; the blueprint refuses to invent it`,
        [{ path: "compositions", message: `leader member ${id} has no measured component record` }]
      );
    }
    return { id, component };
  });
  return { leader, members };
}

function buildFit(brief: Brief, members: LeaderView["members"]): FitResult {
  const fitMembers: FitMemberInput[] = members.map(({ id, component }) => ({
    id,
    name: componentDisplayName(component),
    role: component.role,
    tags: component.tags,
    exemplarNames: component.exemplars.map((exemplar) => exemplar.name)
  }));
  return fitConstraints(
    {
      ...(brief.areaSqFt !== undefined ? { areaSqFt: brief.areaSqFt } : {}),
      constraints: brief.constraints ?? []
    },
    fitMembers
  );
}

function buildReceipts(
  component: PoolComponent,
  state: RunState,
  index: EvidenceIndex
): BlueprintReceipt[] {
  const receipts: BlueprintReceipt[] = [];
  const path = component.provenancePath;
  const pathText = clamp(`${path.anchorPlace} → ${path.exemplarSet} → ${path.tasteNeighborhood}`, 300);
  const pathIds = memberEvidenceIds(index, component.id);
  if (pathText !== "") {
    receipts.push({ kind: "path", text: pathText, evidenceIds: pathIds });
  }
  const edges = (state.graph?.edges ?? [])
    .filter((edge) => (edge.a === component.id || edge.b === component.id) && (edge.sharedEntities?.length ?? 0) > 0)
    .sort((left, right) => (right.value ?? -1) - (left.value ?? -1))
    .slice(0, 2);
  for (const edge of edges) {
    const otherId = edge.a === component.id ? edge.b : edge.a;
    const other = state.candidatePool?.find((entry) => entry.id === otherId);
    const otherName = other === undefined ? otherId : componentDisplayName(other);
    const entityNames = (edge.sharedEntities ?? [])
      .map((entity) => entity.name ?? entity.entityId)
      .slice(0, 3);
    if (entityNames.length === 0 || receipts.length >= 3) {
      continue;
    }
    const text = clamp(`shares ${entityNames.join(", ")} with ${otherName}`, 300);
    receipts.push({
      kind: "shared-entities",
      text,
      evidenceIds: evidenceIds(index, [
        ...index.siteIds(component.id),
        ...index.cityIds(component.id),
        ...index.siteIds(otherId),
        ...index.cityIds(otherId)
      ])
    });
  }
  return receipts.slice(0, 3);
}

function buildFormat(choice: FormatChoice | undefined): BlueprintMember["format"] {
  if (choice === undefined) {
    return undefined;
  }
  return {
    typeDisplayName: clamp(choice.typeDisplayName, 80),
    formatName: clamp(choice.formatName, 80),
    footprintSqFtMin: choice.footprintSqFtMin,
    footprintSqFtMax: choice.footprintSqFtMax,
    noiseClass: choice.noiseClass,
    open: clamp(choice.hours.open, 20),
    close: clamp(choice.hours.close, 20),
    downshiftedFrom: choice.downshiftedFrom
  };
}

function buildRoleGroups(
  view: LeaderView,
  state: RunState,
  fit: FitResult,
  index: EvidenceIndex
): BlueprintRoleGroup[] {
  const groups: BlueprintRoleGroup[] = [];
  for (const role of poolComponentRoles) {
    const members: BlueprintMember[] = [];
    for (const entry of view.members) {
      if (entry.component.role !== role) {
        continue;
      }
      const choice = fit.choices.find((candidate) => candidate.memberId === entry.id);
      const format = buildFormat(choice);
      members.push({
        memberId: entry.id,
        name: componentDisplayName(entry.component),
        role,
        ...(format !== undefined ? { format } : {}),
        receipts: buildReceipts(entry.component, state, index)
      });
    }
    if (members.length > 0) {
      groups.push({ role, members });
    }
  }
  return groups;
}

function buildWhatQlooChanged(
  state: RunState,
  view: LeaderView,
  fit: FitResult,
  index: EvidenceIndex
): Blueprint["whatQlooChanged"] {
  const prior = guardPresent(
    state.prior,
    `run ${state.id} has no frozen Prior; What Qloo changed cannot be computed without it`,
    { path: "prior", message: "Prior Lock must exist before the blueprint compares against Qloo evidence" }
  );
  const priorEntries = extractPriorMemberEntries(prior.composition);
  const downshifted = new Set(fit.downshifts.map((entry) => entry.memberId));
  const roleEnum = new Set<string>(poolComponentRoles);
  const matchedFinal = new Set<number>();
  const kept: Blueprint["whatQlooChanged"]["kept"] = [];
  const reformatted: Blueprint["whatQlooChanged"]["reformatted"] = [];
  const removed: Blueprint["whatQlooChanged"]["removed"] = [];

  for (const entry of priorEntries) {
    const matchIndex = view.members.findIndex((member, memberIndex) => {
      if (matchedFinal.has(memberIndex)) {
        return false;
      }
      const name = componentDisplayName(member.component);
      return (
        normalizeName(name) === normalizeName(entry.name) ||
        normalizeName(member.id) === normalizeName(entry.name) ||
        member.component.exemplars.some((exemplar) => normalizeName(exemplar.name) === normalizeName(entry.name))
      );
    });
    if (matchIndex === -1) {
      removed.push({
        member: clamp(entry.name, 200),
        ...(entry.role !== undefined && roleEnum.has(entry.role)
          ? { role: entry.role as Blueprint["whatQlooChanged"]["removed"][number]["role"] }
          : {}),
        evidenceIds: []
      });
      continue;
    }
    matchedFinal.add(matchIndex);
    const member = view.members[matchIndex]!;
    const item = {
      member: member.id,
      role: member.component.role,
      evidenceIds: memberEvidenceIds(index, member.id)
    };
    if (downshifted.has(member.id)) {
      reformatted.push(item);
    } else {
      kept.push(item);
    }
  }

  const added: Blueprint["whatQlooChanged"]["added"] = [];
  view.members.forEach((member, memberIndex) => {
    if (matchedFinal.has(memberIndex)) {
      return;
    }
    added.push({
      member: member.id,
      role: member.component.role,
      evidenceIds: memberEvidenceIds(index, member.id)
    });
  });

  return {
    kept: kept.slice(0, 20),
    added: added.slice(0, 20),
    removed: removed.slice(0, 20),
    reformatted: reformatted.slice(0, 20)
  };
}

function buildRisks(
  state: RunState,
  view: LeaderView,
  fit: FitResult,
  index: EvidenceIndex
): BlueprintRisk[] {
  const risks: BlueprintRisk[] = [];
  const nameOf = (id: string): string => {
    const member = view.members.find((entry) => entry.id === id);
    return member === undefined ? id : componentDisplayName(member.component);
  };
  const link = view.leader.weakestLink;
  risks.push({
    kind: "weakest-edge",
    text: clamp(`weakest link: ${nameOf(link.a)} + ${nameOf(link.b)}`, 300),
    evidenceIds: evidenceIds(index, [
      ...index.siteIds(link.a),
      ...index.cityIds(link.a),
      ...index.siteIds(link.b),
      ...index.cityIds(link.b)
    ])
  });
  for (const entry of view.members) {
    if (entry.component.evidenceState === "measured") {
      continue;
    }
    risks.push({
      kind: "thin-component",
      text: clamp(`${componentDisplayName(entry.component)} is ${entry.component.evidenceState}`, 300),
      evidenceIds: memberEvidenceIds(index, entry.id)
    });
  }
  const memberSet = new Set(view.leader.members);
  for (const edge of state.compositions?.triangulation ?? []) {
    if (!memberSet.has(edge.a) || !memberSet.has(edge.b) || edge.state === "confirmed") {
      continue;
    }
    risks.push({
      kind: "triangulation",
      text: clamp(`${nameOf(edge.a)} vs ${nameOf(edge.b)}: ${edge.state}`, 300),
      evidenceIds: []
    });
  }
  if (!fit.feasible) {
    const reason = fit.reasons[0];
    if (reason !== undefined) {
      risks.push({ kind: "constraint-conflict", text: clamp(reason, 300), evidenceIds: [] });
    }
    for (const drop of fit.drops) {
      risks.push({
        kind: "constraint-conflict",
        text: clamp(`dropped ${drop.name}: ${drop.reason}`, 300),
        evidenceIds: memberEvidenceIds(index, drop.memberId)
      });
    }
  }
  return risks.slice(0, 20);
}

function gradeSeverity(grade: "A" | "B" | "C"): number {
  return grade === "A" ? 0 : grade === "B" ? 1 : 2;
}

function buildEvidenceGrade(
  state: RunState,
  view: LeaderView
): Blueprint["evidenceGrade"] {
  const memberSet = new Set(view.leader.members);
  const edges = (state.compositions?.triangulation ?? [])
    .filter((edge) => memberSet.has(edge.a) && memberSet.has(edge.b))
    .map((edge) => ({ a: edge.a, b: edge.b, state: edge.state }));
  const pool = [
    ...(state.candidatePool ?? []),
    ...((state.challengeReport?.mutations ?? [])
      .map((mutation) => mutation.component)
      .filter((component): component is PoolComponent => component !== undefined))
  ];
  const uniquePool = [...new Map(pool.map((component) => [component.id, component])).values()];
  const engine = gradeEvidence({ members: view.leader.members, pool: uniquePool, edges });
  const reasons = engine.reasons.map((reason) => clamp(reason, 200));
  const cap = state.challengeReport?.gradeCap ?? "A";
  const capped = gradeSeverity(cap) > gradeSeverity(engine.grade);
  if (capped) {
    reasons.push(GRADE_CAP_B_REASON);
  }
  return {
    grade: capped ? cap : engine.grade,
    reasons: reasons.filter((reason) => reason !== "").slice(0, 30),
    rule: EVIDENCE_RULE
  };
}

function buildFitToSite(brief: Brief, view: LeaderView, fit: FitResult): Blueprint["fitToSite"] {
  const nameOf = (id: string): string => {
    const member = view.members.find((entry) => entry.id === id);
    return member === undefined ? id : componentDisplayName(member.component);
  };
  return {
    footprint: {
      areaSqFt: brief.areaSqFt ?? null,
      usableSqFt: fit.usableSqFt,
      totalFootprintSqFt: fit.totalFootprintSqFt,
      withinUsable: fit.feasible,
      rule: FOOTPRINT_RULE
    },
    hours: {
      timeline: fit.choices.slice(0, 10).map((choice) => ({
        memberId: choice.memberId,
        name: choice.name,
        open: clamp(choice.hours.open, 20),
        close: clamp(choice.hours.close, 20)
      })),
      constraintReads: fit.constraintsRead.slice(0, 12).map((read) => ({
        key: read.key,
        source: clamp(read.source, 200)
      }))
    },
    downshifts: fit.downshifts.slice(0, 10).map((downshift) => ({
      memberId: downshift.memberId,
      name: downshift.name !== "" ? downshift.name : nameOf(downshift.memberId),
      sentence: clamp(downshift.sentence, 300)
    }))
  };
}

function buildRevisionHistory(state: RunState): Blueprint["revisionHistory"] {
  return (state.revisions ?? []).slice(0, 100).map((revision) => ({
    rev: revision.rev,
    replacedMember: revision.replacedMember,
    newMember: revision.newMember,
    role: revision.role,
    coherenceBefore: revision.coherenceBefore,
    coherenceAfter: revision.coherenceAfter,
    custom: revision.custom
  }));
}

function deterministicNarrative(
  brief: Brief,
  state: RunState,
  view: LeaderView,
  grade: Blueprint["evidenceGrade"],
  index: EvidenceIndex
): Narrative {
  const title = clamp(`${brief.objective} — ${brief.location}`, 200);
  const names = view.members.slice(0, 6).map((entry) => componentDisplayName(entry.component));
  const verdict = state.challengeReport?.verdict;
  const percentile =
    view.leader.percentile !== null ? ` at percentile ${view.leader.percentile.toFixed(0)}` : "";
  const parts = [
    `${verdict !== undefined ? `After the ${verdict.toLowerCase()} challenge, the` : "The"} leader holds ${
      names.length
    } measured components: ${names.join(", ")}.`,
    `Coherence ${view.leader.coherence.toFixed(2)}${percentile}; weakest link ${view.leader.weakestLink.a} + ${view.leader.weakestLink.b}.`,
    `Evidence grade ${grade.grade}: ${grade.reasons[0] ?? "no dominant reason recorded"}.`
  ];
  const body = clamp(parts.join(" "), 1000);
  const citations = evidenceIds(index, [...index.allowed].slice(0, 3));
  const citationText = citations.map((id) => `[${id}]`).join(" ");
  const rationale = clamp(citationText === "" ? body : `${body} ${citationText}`, 1200);
  return { title, rationale, source: "deterministic" };
}

interface NarrativeContext {
  brief: Brief;
  state: RunState;
  view: LeaderView;
  fit: FitResult;
  grade: Blueprint["evidenceGrade"];
  risks: BlueprintRisk[];
  changed: Blueprint["whatQlooChanged"];
  index: EvidenceIndex;
}

function promptMessages(context: NarrativeContext): LlmMessage[] {
  const allowed = [...context.index.allowed].slice(0, 40);
  const payload = {
    brief: {
      objective: context.brief.objective,
      location: context.brief.location,
      constraints: context.brief.constraints ?? []
    },
    leader: {
      members: context.view.members.map((entry) => ({
        id: entry.id,
        name: componentDisplayName(entry.component),
        role: entry.component.role
      })),
      verdict: context.state.challengeReport?.verdict ?? "not yet challenged",
      challengeReason: context.state.challengeReport?.reason ?? null
    },
    fit: {
      reasons: context.fit.reasons,
      downshifts: context.fit.downshifts.map((entry) => entry.sentence),
      drops: context.fit.drops.map((entry) => `${entry.name}: ${entry.reason}`),
      constraintReads: context.fit.constraintsRead.map((read) => read.source)
    },
    grade: context.grade,
    risks: context.risks.map((risk) => risk.text),
    whatQlooChanged: {
      kept: context.changed.kept.length,
      added: context.changed.added.length,
      removed: context.changed.removed.length,
      reformatted: context.changed.reformatted.length
    },
    allowedEvidenceIds: allowed
  };
  return [
    {
      role: "system",
      content:
        "You write the title and narrative for a Zorq Place Blueprint. Return ONLY JSON: {\"title\": string, \"rationale\": string}. Title ≤ 80 characters. Rationale is 1-3 honest sentences ≤ 900 characters. Cite 1-6 evidence ids as [id] using ONLY ids from allowedEvidenceIds; never invent ids and never use brackets for anything else. Do not state numbers, percentages, scores, or measurements — the surrounding artifact carries the deterministic measurements. Name the plan and one honest weakness."
    },
    { role: "user", content: JSON.stringify(payload) }
  ];
}

function stripUnknownCitations(text: string, allowed: Set<string>): { text: string; kept: string[] } {
  const kept: string[] = [];
  const cleaned = text.replace(CITATION_PATTERN, (match, inner: string) => {
    if (allowed.has(inner) && !kept.includes(inner)) {
      kept.push(inner);
      return match;
    }
    return "";
  });
  return { text: cleaned.replace(/\s{2,}/g, " ").trim(), kept };
}

function parseNarrativeContent(content: string | null): { title: string; rationale: string } | null {
  if (content === null) {
    return null;
  }
  const stripped = content.replace(/```[a-z]*/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { title?: unknown; rationale?: unknown };
    if (typeof parsed.title !== "string" || typeof parsed.rationale !== "string") {
      return null;
    }
    return { title: parsed.title, rationale: parsed.rationale };
  } catch {
    return null;
  }
}

async function attemptNarrative(
  context: NarrativeContext,
  input: { llm: LlmClient; budget: LlmBudget; ledger: Ledger }
): Promise<{ narrative: Narrative | null; failure: string }> {
  if (context.index.allowed.size === 0) {
    return { narrative: null, failure: "no stored evidence ids are available to cite" };
  }
  let content: string | null = null;
  let durationMs = 0;
  let model = "";
  try {
    const result = await completeBounded({
      llm: input.llm,
      budget: input.budget,
      ledger: input.ledger,
      request: {
        label: NARRATIVE_LABEL,
        essential: false,
        maxOutputTokens: 600,
        messages: promptMessages(context)
      }
    });
    content = result.content;
    durationMs = result.durationMs;
    model = result.model;
  } catch (error) {
    return { narrative: null, failure: toError(error).message.split("\n")[0]?.slice(0, 200) ?? "llm failure" };
  }
  const parsed = parseNarrativeContent(content);
  if (parsed === null) {
    return { narrative: null, failure: "the narrative turn returned no usable JSON" };
  }
  const { text, kept } = stripUnknownCitations(parsed.rationale, context.index.allowed);
  const title = clamp(parsed.title, 200);
  const rationale = clamp(text, 1200);
  if (kept.length === 0) {
    return { narrative: null, failure: "the narrative cited no known evidence id" };
  }
  if (title === "" || rationale === "") {
    return { narrative: null, failure: "the narrative turn produced an empty title or rationale" };
  }
  input.ledger.append(
    computeEvent(
      "blueprint.compose",
      `narrative composed by ${model}; ${kept.length} evidence citation(s) validated against stored records`,
      durationMs,
      1
    )
  );
  return { narrative: { title, rationale, source: "llm" }, failure: "" };
}

export interface ComposeBlueprintInput {
  state: RunState;
  shareToken: string;
  storedEvidenceIds: ReadonlySet<string>;
  llm: LlmClient;
  budget: LlmBudget;
  ledger: Ledger;
  now: number;
}

export async function composeBlueprint(input: ComposeBlueprintInput): Promise<Blueprint> {
  const { state, now } = input;
  const brief = guardPresent(state.brief, `run ${state.id} carries no brief; the Place Blueprint needs the site and constraints`, {
    path: "brief",
    message: "the blueprint cannot fit a plan without the site"
  });
  guardPresent(state.prior, `run ${state.id} has no frozen Prior; What Qloo changed cannot be computed without it`, {
    path: "prior",
    message: "Prior Lock must exist before the blueprint compares against Qloo evidence"
  });

  const view = resolveLeaderView(state);
  const index = buildEvidenceIndex(state, input.storedEvidenceIds);
  const fit = buildFit(brief, view.members);
  const grade = buildEvidenceGrade(state, view);
  const changed = buildWhatQlooChanged(state, view, fit, index);
  const risks = buildRisks(state, view, fit, index);

  const attempt = await attemptNarrative(
    { brief, state, view, fit, grade, risks, changed, index },
    { llm: input.llm, budget: input.budget, ledger: input.ledger }
  );
  const narrative = attempt.narrative ?? deterministicNarrative(brief, state, view, grade, index);
  if (attempt.narrative === null) {
    input.ledger.append(
      computeEvent(
        "blueprint.compose_fallback",
        `deterministic narrative used (${attempt.failure})`,
        0,
        1
      )
    );
  }

  const generatedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + BLUEPRINT_TTL_MS).toISOString();
  const blueprint = blueprintSchema.parse({
    title: narrative.title,
    rationale: narrative.rationale,
    narrativeSource: narrative.source,
    compositionByRole: buildRoleGroups(view, state, fit, index),
    fitToSite: buildFitToSite(brief, view, fit),
    whatQlooChanged: changed,
    risks,
    evidenceGrade: grade,
    revisionHistory: buildRevisionHistory(state),
    methodUrl: "/method",
    shareUrl: `/run/${state.id}/blueprint?share=${input.shareToken}`,
    generatedAt,
    expiresAt
  });
  return blueprint;
}
