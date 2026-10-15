import { ApiError, validationFailed } from "../../shared/errors.js";
import { runStateSchema } from "../../shared/run.js";
import type {
  RunNeighborhoodSource,
  RunNeighborhoods,
  RunRankedComposition,
  RunRevision,
  RunState,
  RunWeakestLink
} from "../../shared/run.js";
import type { ReplaceRequest } from "../../shared/routes.js";
import { toError } from "../agent/errors.js";
import type { Ledger } from "../agent/ledger.js";
import { provenanceFromEnvelope } from "../agent/tools.js";
import {
  buildNeighborhoods,
  classifyTriangulation,
  measureComposition,
  route1FromGraph,
  validatePool,
  type CandidateComponent,
  type CultureGraph,
  type NeighborhoodSignalInput,
  type TasteNeighborhood
} from "../engine/index.js";
import { createEvidenceRecord, type EvidenceRecord } from "../evidence/index.js";
import type { QlooEnvelope, QlooGateway, QlooTagResults } from "../qloo/index.js";
import { OrchestratorStateError } from "./errors.js";
import {
  NEIGHBORHOOD_TAKE,
  computeEvent,
  failedCallEvent,
  localityLadder,
  observationEvent,
  projectCompositionsNode,
  projectExemplars,
  projectSignals,
  rebuildChain,
  resolvePriorMarker
} from "./measure.js";
import { isResumableStatus } from "./status.js";

const REPLACE_CALL_BUDGET = 4;
const POOL_CAPACITY = 10;
const CUSTOM_QUERY_LIMIT = 200;
const REVISION_CAP = 100;

export interface ReplaceInput {
  state: RunState;
  request: ReplaceRequest;
  gateway: QlooGateway;
  ledger: Ledger;
  now: () => number;
}

export interface ReplaceOutcome {
  state: RunState;
  evidence: EvidenceRecord[];
  delta: { coherence: number; distinctiveness: number };
  weakestLink: RunWeakestLink;
}

interface StressAttack {
  kind: "ablation" | "rival";
  status: "measured" | "skipped";
  summary: string;
  detail: string;
}

interface MiniStressReport {
  kind: "mini";
  trigger: "replace";
  rev: number;
  verdict: "Survived" | "Revised";
  reason: string;
  attacks: StressAttack[];
}

interface StressSubject {
  rev: number;
  before: RunRankedComposition;
  after: RunRankedComposition;
  pool: readonly CandidateComponent[];
  graph: CultureGraph;
  ranked: readonly RunRankedComposition[];
}

interface ReplacementPlan {
  custom: boolean;
  newMemberId: string;
  after: RunRankedComposition;
  stressPool: readonly CandidateComponent[];
  stressGraph: CultureGraph;
  stressRanked: readonly RunRankedComposition[];
  stateFields: Partial<Pick<RunState, "candidatePool" | "neighborhoods" | "graph" | "compositions">>;
}

function badRequest(path: string, message: string): ApiError {
  return validationFailed([{ path: [path], message }], message);
}

export function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const present = new Set(left);
  return right.every((member) => present.has(member));
}

function compositionMembersFromKey(key: string): string[] {
  return key
    .split(/[+|]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function percentileText(value: number | null): string {
  return value === null ? "unavailable" : value.toFixed(2);
}

function customComponentId(query: string, taken: ReadonlySet<string>): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const base = slug === "" ? "custom" : `comp-${slug}`;
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function guardMutationState(state: RunState): void {
  if (isResumableStatus(state.status)) {
    throw new OrchestratorStateError(
      `run ${state.id} is ${state.status}; mutation becomes available once measurement has produced compositions`,
      [{ path: "status", message: "wait for a measured state before mutating a run" }]
    );
  }
  if (state.status === "stopped" || state.status === "failed") {
    throw new OrchestratorStateError(
      `run ${state.id} is ${state.status}; a stopped or failed run no longer accepts mutations`,
      [{ path: "status", message: "stopped and failed runs refuse mutation" }]
    );
  }
}

export function firstTag(envelope: QlooEnvelope<QlooTagResults>): { id: string; name: string } | null {
  const tag = envelope.results.tags[0];
  if (tag === undefined || tag.id.trim() === "") {
    return null;
  }
  const name = typeof tag.name === "string" && tag.name.trim() !== "" ? tag.name.trim() : "";
  return { id: tag.id.trim(), name };
}

function ablationAttack(input: StressSubject): StressAttack {
  const members = [...input.after.members].sort();
  if (members.length <= 2) {
    return {
      kind: "ablation",
      status: "skipped",
      summary: `drop-one ablation skipped at composition size ${members.length}`,
      detail: "drop-one needs at least three members; a pair keeps both members honestly"
    };
  }
  let weakestId: string | null = null;
  let worstGain = 0;
  for (const memberId of members) {
    const rest = input.after.members.filter((member) => member !== memberId);
    try {
      const measured = measureComposition(rest, input.pool, input.graph);
      const gain = measured.coherence - input.after.coherence;
      if (weakestId === null || gain > worstGain) {
        weakestId = memberId;
        worstGain = gain;
      }
    } catch (error) {
      const line = toError(error).message.split("\n")[0] ?? "measurement refused";
      return {
        kind: "ablation",
        status: "skipped",
        summary: "drop-one ablation refused by the deterministic engine",
        detail: line.slice(0, 300)
      };
    }
  }
  if (weakestId === null) {
    return {
      kind: "ablation",
      status: "skipped",
      summary: "drop-one ablation measured no subset",
      detail: "no member removal produced a reading; nothing is guessed"
    };
  }
  return {
    kind: "ablation",
    status: "measured",
    summary: `drop-one ablation over ${members.length} member(s)`,
    detail: `removing ${weakestId} moves coherence by ${signed(worstGain)}`
  };
}

function rivalAttack(input: StressSubject): StressAttack {
  const index = input.ranked.findIndex((composition) => sameMembers(composition.members, input.after.members));
  const position = index + 1;
  return {
    kind: "rival",
    status: "measured",
    summary: `rival weighting holds the replacement at rank ${position} of ${input.ranked.length}`,
    detail: `percentile ${percentileText(input.after.percentile)} against the measured family`
  };
}

function miniStress(input: StressSubject): MiniStressReport {
  const attacks: StressAttack[] = [ablationAttack(input), rivalAttack(input)];
  const deltaC = input.after.coherence - input.before.coherence;
  const deltaD = input.after.distinctivenessMean - input.before.distinctivenessMean;
  const verdict = deltaC >= 0 ? "Survived" : "Revised";
  const reason = `Δ coherence ${signed(deltaC)} and Δ distinctiveness ${signed(deltaD)}; ${
    verdict === "Survived"
      ? "the replacement holds or improves coherence"
      : "the replacement loses coherence and is recorded as revised"
  }`;
  return { kind: "mini", trigger: "replace", rev: input.rev, verdict, reason, attacks };
}

export async function applyReplacement(input: ReplaceInput): Promise<ReplaceOutcome> {
  const { state, request, gateway, ledger, now } = input;
  guardMutationState(state);

  const candidateProvided = request.candidateId !== undefined;
  const customProvided = request.customQuery !== undefined;
  if (candidateProvided === customProvided) {
    throw badRequest("candidateId", "exactly one of candidateId or customQuery is required to replace a component");
  }

  const rawPool = state.candidatePool;
  if (rawPool === undefined || rawPool.length === 0) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured candidate pool to replace within`, [
      { path: "candidatePool", message: "replace needs the investigated candidate pool" }
    ]);
  }
  if (state.compositions === undefined) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured compositions to replace within`, [
      { path: "compositions", message: "replace needs a measured composition family" }
    ]);
  }
  if (state.graph === undefined) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured culture graph`, [
      { path: "graph", message: "replace recomputes coherence against the measured graph" }
    ]);
  }
  if ((state.revisions?.length ?? 0) >= REVISION_CAP) {
    throw new OrchestratorStateError(`run ${state.id} already carries ${REVISION_CAP} replace revisions`, [
      { path: "revisions", message: "the revision ledger is capped at 100 entries" }
    ]);
  }

  const pool = validatePool(rawPool);
  const target = pool.find((component) => component.id === request.targetComponentId);
  if (target === undefined) {
    throw badRequest(
      "targetComponentId",
      `component ${request.targetComponentId} is not in the measured candidate pool`
    );
  }
  const requestedKey = request.compositionKey ?? "";
  let before;
  if (requestedKey !== "") {
    const wanted = compositionMembersFromKey(requestedKey);
    const keyed = state.compositions.ranked.find((composition) => sameMembers(composition.members, wanted));
    if (keyed === undefined) {
      throw badRequest(
        "compositionKey",
        `composition ${requestedKey} is not part of the ranked family; nothing was replaced`
      );
    }
    if (!keyed.members.includes(target.id)) {
      throw badRequest(
        "targetComponentId",
        `component ${target.id} is not a member of the selected composition; pick a member of the shown composition`
      );
    }
    before = keyed;
  } else {
    before = state.compositions.ranked.find((composition) => composition.members.includes(target.id));
  }
  if (before === undefined) {
    throw badRequest(
      "targetComponentId",
      `component ${target.id} is not part of any ranked composition; there is no measured role to replace`
    );
  }

  const evidence: EvidenceRecord[] = [];

  const probe = async <T>(
    label: string,
    detail: string,
    call: () => Promise<QlooEnvelope<T>>
  ): Promise<{ envelope: QlooEnvelope<T>; evidenceId: string }> => {
    let envelope: QlooEnvelope<T>;
    try {
      envelope = await call();
    } catch (error) {
      ledger.append(failedCallEvent(label, detail, error));
      throw error;
    }
    const entry = ledger.append(observationEvent(label, envelope, detail));
    const record = createEvidenceRecord({
      operation: envelope.operation,
      claim: `Qloo ${envelope.operation} observation · ${detail}`,
      provenance: provenanceFromEnvelope(envelope),
      createdAt: new Date(now()).toISOString(),
      ledgerEventId: entry.id
    });
    evidence.push(record);
    return { envelope, evidenceId: record.id };
  };

  let plan: ReplacementPlan;
  if (request.candidateId !== undefined) {
    const candidate = pool.find((component) => component.id === request.candidateId);
    if (candidate === undefined) {
      throw badRequest("candidateId", `candidate ${request.candidateId} is not in the measured candidate pool`);
    }
    if (before.members.includes(candidate.id)) {
      throw badRequest(
        "candidateId",
        `candidate ${candidate.id} already sits in the target composition; pick a member outside it`
      );
    }
    if (candidate.role !== target.role) {
      throw badRequest(
        "candidateId",
        `replace preserves the role: ${target.id} is ${target.role} while ${candidate.id} is ${candidate.role}`
      );
    }
    const swappedMembers = before.members.map((member) => (member === target.id ? candidate.id : member));
    const after = state.compositions.ranked.find((composition) => sameMembers(composition.members, swappedMembers));
    if (after === undefined) {
      throw badRequest(
        "candidateId",
        `swapping ${target.id} for ${candidate.id} does not match a ranked composition; the swap is refused rather than guessed`
      );
    }
    plan = {
      custom: false,
      newMemberId: candidate.id,
      after,
      stressPool: pool,
      stressGraph: state.graph,
      stressRanked: state.compositions.ranked,
      stateFields: {}
    };
  } else {
    const brief = state.brief;
    const neighborhoods = state.neighborhoods;
    const query = (request.customQuery ?? "").trim();
    if (query === "" || query.length > CUSTOM_QUERY_LIMIT) {
      throw badRequest("customQuery", `customQuery must carry 1 to ${CUSTOM_QUERY_LIMIT} characters after trimming`);
    }
    if (pool.length >= POOL_CAPACITY) {
      throw new OrchestratorStateError(
        `the candidate pool already holds ${pool.length} components; the schema cap is ${POOL_CAPACITY}`,
        [{ path: "candidatePool", message: "custom replace grows the pool and must stay inside the cap" }]
      );
    }
    if (brief === undefined) {
      throw new OrchestratorStateError(`run ${state.id} carries no brief; custom replace needs the site locality`, [
        { path: "brief", message: "custom replace resolves exemplars and neighborhoods against the brief location" }
      ]);
    }
    if (neighborhoods === undefined) {
      throw new OrchestratorStateError(`run ${state.id} carries no measured taste neighborhoods`, [
        { path: "neighborhoods", message: "custom replace extends the measured neighborhood set" }
      ]);
    }
    if (gateway.stats.budgetRemaining < REPLACE_CALL_BUDGET) {
      throw new OrchestratorStateError(
        `the Qloo gateway reports ${gateway.stats.budgetRemaining} call(s) left; custom replace needs ${REPLACE_CALL_BUDGET}`,
        [{ path: "budget", message: "replace refuses to start a probe sequence it cannot finish" }]
      );
    }

    const takenIds = new Set(pool.map((component) => component.id));
    const newId = customComponentId(query, takenIds);
    const siteLocation = localityLadder(brief.location)[0];

    const tagProbe = await probe("replace.resolve_tag", `custom query "${query}"`, () =>
      gateway.resolveTags({ query, take: 5 })
    );
    const tag = firstTag(tagProbe.envelope);
    if (tag === null) {
      throw new ApiError("UNKNOWN_ENTITY", `custom query "${query}" resolved to no Qloo tag; nothing was replaced`);
    }
    const tagName = tag.name === "" ? query : tag.name;

    const exemplarProbe = await probe(
      "replace.exemplar_probe",
      `tag ${tag.id} · signal "${siteLocation}"`,
      () => gateway.insights({ filterType: "place", filterTags: [tag.id], signalLocation: siteLocation, take: 5 })
    );
    const exemplars = projectExemplars(exemplarProbe.envelope);
    if (exemplars.length === 0) {
      throw new ApiError("UNKNOWN_ENTITY", `tag ${tag.id} returned no exemplar places; nothing was replaced`);
    }
    const exemplarIds = exemplars.map((exemplar) => exemplar.id);

    const siteProbe = await probe(
      "replace.neighborhood_fetch",
      `component ${newId} · artist site · signal "${siteLocation}"`,
      () =>
        gateway.insights({
          filterType: "artist",
          signalEntities: exemplarIds,
          signalLocation: siteLocation,
          take: NEIGHBORHOOD_TAKE
        })
    );
    const siteSignals = projectSignals(siteProbe.envelope);
    if (siteSignals.length === 0) {
      throw new ApiError(
        "UNKNOWN_ENTITY",
        `artist insights for ${newId} returned no site signals; nothing was replaced`
      );
    }

    const cityProbe = await probe("replace.neighborhood_fetch", `component ${newId} · artist city baseline`, () =>
      gateway.insights({ filterType: "artist", signalEntities: exemplarIds, take: NEIGHBORHOOD_TAKE })
    );
    const citySignals = projectSignals(cityProbe.envelope);
    if (citySignals.length === 0) {
      throw new ApiError(
        "UNKNOWN_ENTITY",
        `artist insights for ${newId} returned no city baseline signals; nothing was replaced`
      );
    }

    const component: CandidateComponent = {
      id: newId,
      role: target.role,
      tags: [tagName.slice(0, 300)],
      exemplars,
      provenancePath: {
        anchorPlace: brief.location.slice(0, 300),
        qlooSignal: query.slice(0, 300),
        resolvedCategory: tag.id.slice(0, 300),
        exemplarSet: tagName.slice(0, 300),
        tasteNeighborhood: `artist audience for "${tagName}" near ${brief.location}`.slice(0, 300)
      },
      evidenceState: "measured"
    };

    const siteInputs: NeighborhoodSignalInput[] = [{ componentId: newId, domain: "artist", signals: siteSignals }];
    const cityInputs: NeighborhoodSignalInput[] = [{ componentId: newId, domain: "artist", signals: citySignals }];
    const newSite = buildNeighborhoods([component], siteInputs)[0];
    const newCity = buildNeighborhoods([component], cityInputs)[0];
    const siteNeighborhoods: TasteNeighborhood[] = [...neighborhoods.components, newSite];
    const cityNeighborhoods: TasteNeighborhood[] = [...neighborhoods.city, newCity];
    const sourcesAfter: RunNeighborhoodSource[] = [
      ...neighborhoods.sources,
      { componentId: newId, domain: "artist", scope: "site", evidenceId: siteProbe.evidenceId },
      { componentId: newId, domain: "artist", scope: "city", evidenceId: cityProbe.evidenceId }
    ];
    const neighborhoodsAfter: RunNeighborhoods = {
      components: siteNeighborhoods,
      city: cityNeighborhoods,
      sources: sourcesAfter
    };

    const poolAfter: CandidateComponent[] = [...pool, component];
    const { graph: graphAfter, runGraph, family, familyError, ranking } = rebuildChain({
      pool: poolAfter,
      siteNeighborhoods,
      cityNeighborhoods,
      familySize: state.compositions.family.size
    });
    const prior = resolvePriorMarker(state.prior, poolAfter, graphAfter, family);
    const triangulationAfter = state.compositions.triangulation.map((entry) =>
      classifyTriangulation({
        a: entry.a,
        b: entry.b,
        route1: route1FromGraph(graphAfter, entry.a, entry.b),
        route2: { resultCount: entry.resultCount, focalInTopHalf: entry.focalInTopHalf }
      })
    );
    const compositionsAfter = projectCompositionsNode({
      pool: poolAfter,
      family,
      familyError,
      ranking,
      triangulation: triangulationAfter,
      prior
    });

    const swappedMembers = before.members.map((member) => (member === target.id ? newId : member));
    const after = compositionsAfter.ranked.find((composition) => sameMembers(composition.members, swappedMembers));
    if (after === undefined) {
      const excludedMatch = compositionsAfter.excluded.some((entry) => sameMembers(entry.members, swappedMembers));
      const whyNot = excludedMatch
        ? "the swapped composition carries no distinctiveness reading and stays honestly excluded"
        : (compositionsAfter.family.reason ?? "no role-valid fully measured subset contains the swapped members");
      throw new ApiError(
        "UNKNOWN_ENTITY",
        `custom component ${newId} measured, but the swapped ${target.role} composition is not ranked: ${whyNot}; nothing was replaced`
      );
    }

    ledger.append(
      computeEvent(
        "replace.measure",
        `custom replace rebuilt measurement for ${poolAfter.length} component(s): ${compositionsAfter.ranked.length} ranked composition(s) now include ${newId}; triangulation probes carry forward re-derived against the rebuilt graph, the Prior is re-measured honestly, and cultural DNA carries forward unchanged`,
        0,
        compositionsAfter.ranked.length
      )
    );

    plan = {
      custom: true,
      newMemberId: newId,
      after,
      stressPool: poolAfter,
      stressGraph: graphAfter,
      stressRanked: compositionsAfter.ranked,
      stateFields: {
        candidatePool: poolAfter,
        neighborhoods: neighborhoodsAfter,
        graph: runGraph,
        compositions: compositionsAfter
      }
    };
  }

  const delta = {
    coherence: plan.after.coherence - before.coherence,
    distinctiveness: plan.after.distinctivenessMean - before.distinctivenessMean
  };
  const rev = (state.revisions?.length ?? 0) + 1;
  const revision: RunRevision = {
    rev,
    replacedMember: target.id,
    newMember: plan.newMemberId,
    role: target.role,
    membersBefore: before.members,
    membersAfter: plan.after.members,
    coherenceBefore: before.coherence,
    coherenceAfter: plan.after.coherence,
    percentileBefore: before.percentile,
    percentileAfter: plan.after.percentile,
    custom: plan.custom
  };
  const stress = miniStress({
    rev,
    before,
    after: plan.after,
    pool: plan.stressPool,
    graph: plan.stressGraph,
    ranked: plan.stressRanked
  });
  ledger.append(
    computeEvent(
      "replace.stress",
      `mini-stress ${stress.verdict}: Δ coherence ${signed(delta.coherence)}, Δ distinctiveness ${signed(delta.distinctiveness)}; ${stress.attacks.length} attack(s) recorded in stressReport`,
      0,
      stress.attacks.length
    )
  );
  const next = runStateSchema.parse({
    ...state,
    ...plan.stateFields,
    stressReport: stress,
    revisions: [...(state.revisions ?? []), revision]
  });
  ledger.append(
    computeEvent(
      "replace.apply",
      `revision ${rev}: replaced ${target.id} with ${plan.newMemberId} as ${target.role}; coherence ${before.coherence.toFixed(4)} → ${plan.after.coherence.toFixed(4)}, percentile ${percentileText(before.percentile)} → ${percentileText(plan.after.percentile)}`,
      0,
      rev
    )
  );

  return {
    state: next,
    evidence,
    delta,
    weakestLink: plan.after.weakestLink
  };
}
