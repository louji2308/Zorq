import { runStateSchema, componentDisplayName } from "../../shared/run.js";
import { attackKinds, attackKindSchema, poolComponentRoles } from "../../shared/run.js";
import type {
  AttackKind,
  ChallengeAttack,
  ChallengeLeader,
  ChallengeMutation,
  ChallengeReport,
  ChallengeVerdict,
  PoolComponentRole,
  RunNeighborhoods,
  RunRankedComposition,
  RunState
} from "../../shared/run.js";
import type { ChallengeRequest } from "../../shared/routes.js";
import { z } from "zod";
import { toError } from "../agent/errors.js";
import type { Ledger } from "../agent/ledger.js";
import { completeBounded, type LlmClient, type LlmCompletionRequest } from "../agent/llm.js";
import type { LlmBudget } from "../agent/budget.js";
import { provenanceFromEnvelope } from "../agent/tools.js";
import {
  buildCompositions,
  buildGraph,
  buildNeighborhoods,
  computeDistinctivenessMap,
  computeIdf,
  measureComposition,
  percentileOf,
  validatePool,
  type CandidateComponent,
  type CultureGraph,
  type NeighborhoodSignalInput,
  type TasteNeighborhood,
  type WeightedEntity
} from "../engine/index.js";
import { createEvidenceRecord, type EvidenceRecord } from "../evidence/index.js";
import type { QlooEnvelope, QlooGateway, QlooInsightsResults, QlooTagResults } from "../qloo/index.js";
import { OrchestratorStateError } from "./errors.js";
import {
  NEIGHBORHOOD_TAKE,
  computeEvent,
  failedCallEvent,
  localityLadder,
  observationEvent,
  projectExemplars,
  projectSignals,
  rebuildChain
} from "./measure.js";
import { firstTag, guardMutationState, sameMembers } from "./replace.js";

const MUTATION_EPSILON = 1e-6;
const BRIDGE_PROBE_LIMIT = 3;
const BRIDGE_MEASURE_CALLS = 3;
const CATCHMENT_HOLD_EPSILON = 0.005;
const WEAK_LINK_DIAGNOSTIC = 0.35;

export interface ChallengeInput {
  state: RunState;
  request: ChallengeRequest;
  gateway: QlooGateway;
  ledger: Ledger;
  now: () => number;
  llm?: LlmClient;
  budget?: LlmBudget;
}

export interface ChallengeOutcome {
  state: RunState;
  evidence: EvidenceRecord[];
  report: ChallengeReport;
}

interface ScratchState {
  pool: CandidateComponent[];
  graph: CultureGraph;
  neighborhoods: RunNeighborhoods;
  distinctiveness: Record<string, number | null>;
  familyCoherences: readonly number[];
}

interface MutationCandidate {
  operator: "swap" | "drop" | "bridge";
  memberOut: string | null;
  memberIn: string | null;
  leaderAfter: ChallengeLeader;
  gain: number;
  scratch: ScratchState | null;
}

interface AttackResult {
  attack: ChallengeAttack;
  candidate: MutationCandidate | null;
  note?: string;
}

interface AttackContext {
  state: RunState;
  compositions: NonNullable<RunState["compositions"]>;
  pool: readonly CandidateComponent[];
  graph: CultureGraph;
  ranked: readonly RunRankedComposition[];
  familyCoherences: readonly number[];
  distinctiveness: Record<string, number | null> | undefined;
  neighborhoods: RunNeighborhoods | undefined;
  leader: ChallengeLeader;
  /** Resolve member ids to display names for judge-facing prose; data fields keep ids. */
  nameOf: (id: string) => string;
}

interface BridgeProbeDeps {
  gateway: QlooGateway;
  ledger: Ledger;
  now: () => number;
  evidence: EvidenceRecord[];
  probesUsed: { count: number };
  bridgeRecorded: { found: boolean };
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function percentileText(value: number | null): string {
  return value === null ? "unavailable" : `${value.toFixed(2)}th`;
}

function leaderFromRanked(entry: RunRankedComposition): ChallengeLeader {
  return {
    members: [...entry.members],
    coherence: entry.coherence,
    percentile: entry.percentile,
    distinctivenessMean: entry.distinctivenessMean,
    weakestLink: { ...entry.weakestLink }
  };
}

function subsetDistinctivenessMean(
  members: readonly string[],
  lookup: Readonly<Record<string, number | null>> | undefined
): number | null {
  if (lookup === undefined) {
    return null;
  }
  let sum = 0;
  for (const member of members) {
    const value = lookup[member];
    if (value === undefined || value === null) {
      return null;
    }
    sum += value;
  }
  return sum / members.length;
}

function distinctivenessFor(state: RunState): Record<string, number | null> | undefined {
  const neighborhoods = state.neighborhoods;
  if (neighborhoods === undefined) {
    return undefined;
  }
  const cityVectors: Record<string, WeightedEntity[]> = {};
  for (const neighborhood of neighborhoods.city) {
    cityVectors[neighborhood.componentId] = neighborhood.domains.artist.map((entry) => ({
      entityId: entry.entityId,
      weight: entry.weight
    }));
  }
  return computeDistinctivenessMap(neighborhoods.components, cityVectors);
}

function sizeFamilyCoherences(
  ctx: AttackContext,
  size: number,
  requiredRoles: readonly import("../engine/index.js").ComponentRole[]
): readonly number[] {
  if (size < 2 || ctx.pool.length < size) {
    return [];
  }
  if (size === ctx.compositions.family.size && requiredRoles === ctx.compositions.family.requiredRoles) {
    return ctx.familyCoherences;
  }
  try {
    const family = buildCompositions({
      pool: ctx.pool,
      graph: ctx.graph,
      size,
      requiredRoles: [...requiredRoles],
      distinctiveness: ctx.distinctiveness
    });
    return family.compositions.map((entry) => entry.coherence);
  } catch {
    return [];
  }
}

function leaderFamilyCoherences(ctx: AttackContext): readonly number[] {
  return sizeFamilyCoherences(ctx, ctx.leader.members.length, ctx.compositions.family.requiredRoles);
}

function ablationFamilyCoherences(ctx: AttackContext): readonly number[] {
  return sizeFamilyCoherences(ctx, ctx.leader.members.length - 1, ctx.compositions.family.requiredRoles);
}

function skippedAttack(kind: AttackKind, summary: string, detail: string): AttackResult {
  return {
    attack: { kind, status: "skipped", summary, detail },
    candidate: null
  };
}

function ablationAttack(ctx: AttackContext): AttackResult {
  const members = [...ctx.leader.members].sort();
  if (members.length <= 2) {
    return skippedAttack(
      "ablation",
      `drop-one ablation skipped at composition size ${members.length}`,
      "drop-one needs at least three members; a pair keeps both members honestly"
    );
  }
  const coherences = ablationFamilyCoherences(ctx);
  let weakestId: string | null = null;
  let worstGain = 0;
  let weakestRest: string[] | null = null;
  let weakestCoherence = 0;
  for (const memberId of members) {
    const rest = ctx.leader.members.filter((member) => member !== memberId);
    try {
      const measured = measureComposition(rest, ctx.pool, ctx.graph);
      const gain = measured.coherence - ctx.leader.coherence;
      if (weakestId === null || gain > worstGain) {
        weakestId = memberId;
        worstGain = gain;
        weakestRest = rest;
        weakestCoherence = measured.coherence;
      }
    } catch (error) {
      const line = toError(error).message.split("\n")[0] ?? "measurement refused";
      return skippedAttack(
        "ablation",
        "drop-one ablation refused by the deterministic engine",
        line.slice(0, 500)
      );
    }
  }
  if (weakestId === null || weakestRest === null) {
    return skippedAttack(
      "ablation",
      "drop-one ablation measured no subset",
      "no member removal produced a reading; nothing is guessed"
    );
  }
  const percentile = coherences.length > 0 ? percentileOf(weakestCoherence, coherences) : null;
  const remainderText =
    worstGain < 0
      ? `without ${ctx.nameOf(weakestId)}, coherence ${signed(worstGain)} and lands at the ${percentileText(percentile)} percentile of size-${members.length - 1} compositions`
      : `removing ${ctx.nameOf(weakestId)} is the least costly cut: ${signed(worstGain)}${percentile === null ? "" : ` (remainder at ${percentileText(percentile)} percentile)`}`;
  const distinctivenessMean = subsetDistinctivenessMean(weakestRest, ctx.distinctiveness);
  let candidate: MutationCandidate | null = null;
  if (worstGain > MUTATION_EPSILON && distinctivenessMean !== null) {
    candidate = {
      operator: "drop",
      memberOut: weakestId,
      memberIn: null,
      leaderAfter: {
        members: [...weakestRest],
        coherence: weakestCoherence,
        percentile,
        distinctivenessMean,
        weakestLink: measureComposition(weakestRest, ctx.pool, ctx.graph).weakestLink
      },
      gain: worstGain,
      scratch: null
    };
  } else if (worstGain > MUTATION_EPSILON && distinctivenessMean === null) {
    return {
      attack: {
        kind: "ablation",
        status: "measured",
        summary: `drop-one ablation over ${members.length} members`,
        detail: `${remainderText}; mutation withheld because the subset carries no distinctiveness reading`
      },
      candidate: null
    };
  }
  return {
    attack: {
      kind: "ablation",
      status: "measured",
      summary: `drop-one ablation over ${members.length} members`,
      detail: remainderText
    },
    candidate,
    ...(candidate === null && worstGain <= MUTATION_EPSILON
      ? { note: "No member could be removed without cost." }
      : {})
  };
}

function substitutionAttack(ctx: AttackContext): AttackResult {
  const alternatives = ctx.pool.filter((component) => !ctx.leader.members.includes(component.id));
  if (alternatives.length === 0) {
    return skippedAttack(
      "substitution",
      "same-role substitution skipped",
      "the candidate pool carries no component outside the leader"
    );
  }
  const coherences = leaderFamilyCoherences(ctx);
  let evaluated = 0;
  let excludedCount = 0;
  let best: {
    memberOut: string;
    memberIn: string;
    gain: number;
    coherence: number;
    percentile: number | null;
    distinctivenessMean: number | null;
    weakestLink: ChallengeLeader["weakestLink"];
  } | null = null;
  for (const member of [...ctx.leader.members].sort()) {
    const component = ctx.pool.find((entry) => entry.id === member);
    if (component === undefined) {
      continue;
    }
    for (const alternative of alternatives) {
      if (alternative.role !== component.role) {
        continue;
      }
      evaluated += 1;
      const swapped = ctx.leader.members.map((entry) => (entry === member ? alternative.id : entry));
      const rankedHit = ctx.ranked.find((composition) => sameMembers(composition.members, swapped));
      let coherence: number;
      let weakestLink: ChallengeLeader["weakestLink"];
      if (rankedHit !== undefined) {
        coherence = rankedHit.coherence;
        weakestLink = { ...rankedHit.weakestLink };
      } else {
        const excludedHit = ctx.compositions.excluded.some((entry) => sameMembers(entry.members, swapped));
        if (excludedHit) {
          excludedCount += 1;
        }
        try {
          const measured = measureComposition(swapped, ctx.pool, ctx.graph);
          coherence = measured.coherence;
          weakestLink = { ...measured.weakestLink };
        } catch {
          continue;
        }
      }
      const percentile =
        rankedHit !== undefined ? rankedHit.percentile : coherences.length > 0 ? percentileOf(coherence, coherences) : null;
      const distinctivenessMean =
        rankedHit !== undefined
          ? rankedHit.distinctivenessMean
          : subsetDistinctivenessMean(swapped, ctx.distinctiveness);
      const gain = coherence - ctx.leader.coherence;
      if (best === null || gain > best.gain) {
        best = { memberOut: member, memberIn: alternative.id, gain, coherence, percentile, distinctivenessMean, weakestLink };
      }
    }
  }
  if (best === null) {
    return skippedAttack(
      "substitution",
      "same-role substitution skipped",
      excludedCount > 0
        ? "every same-role alternative maps to a composition excluded for missing distinctiveness; nothing is guessed"
        : "no same-role alternative in the pool can form a measurable swap with the leader"
    );
  }
  let detail: string;
  if (best.gain > MUTATION_EPSILON) {
    detail = `swap ${best.memberOut} → ${best.memberIn} gains ${signed(best.gain)} (percentile ${percentileText(best.percentile)})`;
  } else if (best.gain >= -MUTATION_EPSILON) {
    detail = `no substitute improves the leader; ${best.memberIn} for ${best.memberOut} holds without loss (${signed(best.gain)})`;
  } else {
    detail = `every same-role substitute loses coherence; best is ${best.memberIn} for ${best.memberOut} at ${signed(best.gain)}`;
  }
  if (excludedCount > 0) {
    detail = `${detail}; ${excludedCount} alternative(s) excluded for missing distinctiveness`;
  }
  const candidate: MutationCandidate | null =
    best.gain > MUTATION_EPSILON && best.distinctivenessMean !== null
      ? {
          operator: "swap",
          memberOut: best.memberOut,
          memberIn: best.memberIn,
          leaderAfter: {
            members: ctx.leader.members.map((entry) => (entry === best!.memberOut ? best!.memberIn : entry)),
            coherence: best.coherence,
            percentile: best.percentile,
            distinctivenessMean: best.distinctivenessMean,
            weakestLink: best.weakestLink
          },
          gain: best.gain,
          scratch: null
        }
      : null;
  return {
    attack: {
      kind: "substitution",
      status: "measured",
      summary: `same-role substitution over ${evaluated} alternative(s)`,
      detail
    },
    candidate,
    ...(candidate === null
      ? {
          note:
            best.gain >= -MUTATION_EPSILON
              ? "One member could be substituted without loss, so nothing was changed."
              : "Every same-role substitute loses coherence."
        }
      : {})
  };
}

async function bridgeAttack(ctx: AttackContext, deps: BridgeProbeDeps): Promise<AttackResult> {
  if (deps.bridgeRecorded.found) {
    return skippedAttack(
      "bridge",
      "bridge search skipped",
      "the recorded bridge probe stands; one connecting category is measured per challenge"
    );
  }
  const pair = ctx.leader.weakestLink;
  const sideA = ctx.pool.find((component) => component.id === pair.a);
  const sideB = ctx.pool.find((component) => component.id === pair.b);
  if (sideA === undefined || sideB === undefined) {
    return skippedAttack(
      "bridge",
      "bridge search skipped",
      "the weakest link references a component outside the measured candidate pool"
    );
  }
  const signals = [...new Set([...sideA.exemplars, ...sideB.exemplars].map((exemplar) => exemplar.id))].slice(0, 10);
  if (signals.length === 0) {
    return skippedAttack(
      "bridge",
      "bridge search skipped",
      "neither side of the weakest link carries exemplar places to probe with"
    );
  }
  if (deps.probesUsed.count >= BRIDGE_PROBE_LIMIT) {
    return skippedAttack(
      "bridge",
      "bridge search skipped",
      `the challenge already spent its ${BRIDGE_PROBE_LIMIT} probe allowance; the recorded probe stands`
    );
  }
  if (deps.gateway.stats.budgetRemaining < 1) {
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge search not completed",
        detail: "the Qloo gateway reports no remaining call budget for the bridge probe"
      },
      candidate: null
    };
  }
  deps.probesUsed.count += 1;
  const excludeTags = [...new Set([...sideA.tags, ...sideB.tags])].slice(0, 10);
  const detail = `what ${pair.a} and ${pair.b} audiences share`;
  let envelope: QlooEnvelope<QlooInsightsResults>;
  try {
    envelope = (await deps.gateway.bridge({
      targetType: "place",
      signals,
      ...(excludeTags.length > 0 ? { excludeTags } : {}),
      limit: 5
    })) as QlooEnvelope<QlooInsightsResults>;
  } catch (error) {
    deps.ledger.append(failedCallEvent("challenge.bridge_probe", detail, error));
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge search not completed",
        detail: toError(error).message.split("\n")[0]?.slice(0, 500) ?? "Qloo bridge probe failed"
      },
      candidate: null
    };
  }
  const entry = deps.ledger.append(observationEvent("challenge.bridge_probe", envelope, detail));
  const record = createEvidenceRecord({
    operation: envelope.operation,
    claim: `Qloo ${envelope.operation} observation · ${detail}`,
    provenance: provenanceFromEnvelope(envelope),
    createdAt: new Date(deps.now()).toISOString(),
    ledgerEventId: entry.id
  });
  deps.evidence.push(record);
  const entities = projectExemplars(envelope);
  if (entities.length === 0) {
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary: `bridge search on the weakest link ${pair.a} – ${pair.b}`,
        detail: "Qloo found no connecting category both audiences share",
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const names = entities.map((entity) => entity.name).join(", ");
  const summary = `bridge candidate on ${pair.a} – ${pair.b}: ${entities[0]!.name}`;
  const brief = ctx.state.brief;
  const baseNeighborhoods = ctx.neighborhoods;
  if (brief === undefined || baseNeighborhoods === undefined) {
    deps.bridgeRecorded.found = true;
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary,
        detail: `what both audiences love: ${names}; the run carries ${
          brief === undefined ? "no brief locality" : "no measured taste neighborhoods"
        } to measure a connecting component, so no insertion was simulated`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const remaining = deps.gateway.stats.budgetRemaining;
  if (remaining < BRIDGE_MEASURE_CALLS) {
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge measurement not completed",
        detail: `measuring a connecting component needs ${BRIDGE_MEASURE_CALLS} Qloo calls and ${remaining} remain; ${names} was recorded but no insertion was simulated`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }

  const query = entities[0]!.name;
  const pushObservation = <T>(label: string, envelope: QlooEnvelope<T>, observation: string): string => {
    const entry = deps.ledger.append(observationEvent(label, envelope, observation));
    const created = createEvidenceRecord({
      operation: envelope.operation,
      claim: `Qloo ${envelope.operation} observation · ${observation}`,
      provenance: provenanceFromEnvelope(envelope),
      createdAt: new Date(deps.now()).toISOString(),
      ledgerEventId: entry.id
    });
    deps.evidence.push(created);
    return created.id;
  };

  let tagEnvelope: QlooEnvelope<QlooTagResults>;
  try {
    tagEnvelope = await deps.gateway.resolveTags({ query, take: 5 });
  } catch (error) {
    deps.ledger.append(failedCallEvent("challenge.bridge_resolve_tag", `bridge category for "${query}"`, error));
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge measurement not completed",
        detail: (toError(error).message.split("\n")[0] ?? "Qloo category resolution failed").slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  pushObservation("challenge.bridge_resolve_tag", tagEnvelope, `bridge category for "${query}"`);
  const tag = firstTag(tagEnvelope);
  if (tag === null) {
    deps.bridgeRecorded.found = true;
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary,
        detail: `what both audiences love: ${names}; Qloo resolved no category for ${query}, so no connecting component was built`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const tagName = tag.name === "" ? query : tag.name;
  const exemplarIds = entities.map((entity) => entity.id);
  const siteLocation = localityLadder(brief.location)[0];

  let siteEnvelope: QlooEnvelope<QlooInsightsResults>;
  try {
    siteEnvelope = await deps.gateway.insights({
      filterType: "artist",
      signalEntities: exemplarIds,
      signalLocation: siteLocation,
      take: NEIGHBORHOOD_TAKE
    });
  } catch (error) {
    deps.ledger.append(failedCallEvent("challenge.bridge_site_fetch", `bridge site audience for "${query}"`, error));
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge measurement not completed",
        detail: (toError(error).message.split("\n")[0] ?? "Qloo site audience fetch failed").slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const siteEvidenceId = pushObservation(
    "challenge.bridge_site_fetch",
    siteEnvelope,
    `bridge component · artist site · signal "${siteLocation}"`
  );
  const siteSignals = projectSignals(siteEnvelope);
  if (siteSignals.length === 0) {
    deps.bridgeRecorded.found = true;
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary,
        detail: `what both audiences love: ${names}; the site audience returned no signals for the connecting category, so no insertion was simulated`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }

  let cityEnvelope: QlooEnvelope<QlooInsightsResults>;
  try {
    cityEnvelope = await deps.gateway.insights({
      filterType: "artist",
      signalEntities: exemplarIds,
      take: NEIGHBORHOOD_TAKE
    });
  } catch (error) {
    deps.ledger.append(failedCallEvent("challenge.bridge_city_fetch", `bridge city baseline for "${query}"`, error));
    return {
      attack: {
        kind: "bridge",
        status: "not completed",
        summary: "bridge measurement not completed",
        detail: (toError(error).message.split("\n")[0] ?? "Qloo city baseline fetch failed").slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const cityEvidenceId = pushObservation(
    "challenge.bridge_city_fetch",
    cityEnvelope,
    "bridge component · artist city baseline"
  );
  const citySignals = projectSignals(cityEnvelope);
  if (citySignals.length === 0) {
    deps.bridgeRecorded.found = true;
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary,
        detail: `what both audiences love: ${names}; the city baseline returned no signals for the connecting category, so no insertion was simulated`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }

  const componentId = bridgeComponentId(entities[0]!.id, ctx.pool);
  const role = bridgeRole(ctx);
  const component: CandidateComponent = {
    id: componentId,
    role,
    tags: [tagName.slice(0, 300)],
    exemplars: entities,
    provenancePath: {
      anchorPlace: brief.location.slice(0, 300),
      qlooSignal: `bridge: ${pair.a} + ${pair.b} audiences`.slice(0, 300),
      resolvedCategory: tag.id.slice(0, 300),
      exemplarSet: names.slice(0, 300),
      tasteNeighborhood: `artist audience for "${tagName}" near ${brief.location}`.slice(0, 300)
    },
    evidenceState: "measured"
  };

  const siteInputs: NeighborhoodSignalInput[] = [{ componentId, domain: "artist", signals: siteSignals }];
  const cityInputs: NeighborhoodSignalInput[] = [{ componentId, domain: "artist", signals: citySignals }];
  const newSite = buildNeighborhoods([component], siteInputs)[0];
  const newCity = buildNeighborhoods([component], cityInputs)[0];
  const siteNeighborhoods: TasteNeighborhood[] = [...baseNeighborhoods.components, newSite];
  const cityNeighborhoods: TasteNeighborhood[] = [...baseNeighborhoods.city, newCity];
  const neighborhoodsAfter: RunNeighborhoods = {
    components: siteNeighborhoods,
    city: cityNeighborhoods,
    sources: [
      ...baseNeighborhoods.sources,
      { componentId, domain: "artist", scope: "site", evidenceId: siteEvidenceId },
      { componentId, domain: "artist", scope: "city", evidenceId: cityEvidenceId }
    ]
  };

  const tempPool: CandidateComponent[] = [...ctx.pool, component];
  const chain = rebuildChain({
    pool: tempPool,
    siteNeighborhoods,
    cityNeighborhoods,
    familySize: ctx.compositions.family.size
  });
  const bridged = [...ctx.leader.members, componentId];
  let measured: ReturnType<typeof measureComposition>;
  try {
    measured = measureComposition(bridged, tempPool, chain.graph);
  } catch (error) {
    deps.bridgeRecorded.found = true;
    return {
      attack: {
        kind: "bridge",
        status: "measured",
        summary,
        detail: `what both audiences love: ${names}; the engine refused the bridged composition: ${(toError(error).message.split("\n")[0] ?? "measurement refused").slice(0, 300)}`.slice(0, 500),
        evidenceId: record.id
      },
      candidate: null
    };
  }
  const gain = measured.coherence - ctx.leader.coherence;

  let sizeCoherences: number[] = [];
  try {
    const bridgedFamily = buildCompositions({
      pool: tempPool,
      graph: chain.graph,
      size: bridged.length,
      requiredRoles: chain.requiredRoles,
      distinctiveness: chain.distinctiveness
    });
    sizeCoherences = bridgedFamily.compositions.map((entry) => entry.coherence);
  } catch {
    sizeCoherences = [];
  }
  const percentile = sizeCoherences.length > 0 ? percentileOf(measured.coherence, sizeCoherences) : null;
  const distinctivenessMean = subsetDistinctivenessMean(bridged, chain.distinctiveness);
  let scratchCoherences: readonly number[] = [];
  if (ctx.compositions.family.size >= 2 && tempPool.length >= ctx.compositions.family.size) {
    try {
      const scratchFamily = buildCompositions({
        pool: tempPool,
        graph: chain.graph,
        size: ctx.compositions.family.size,
        requiredRoles: chain.requiredRoles,
        distinctiveness: chain.distinctiveness
      });
      scratchCoherences = scratchFamily.compositions.map((entry) => entry.coherence);
    } catch {
      scratchCoherences = [];
    }
  }

  deps.bridgeRecorded.found = true;
  deps.ledger.append(
    computeEvent(
      "challenge.bridge_measure",
      `bridge component ${componentId} measured over ${bridged.length} member(s): coherence ${measured.coherence.toFixed(4)} (Δ ${signed(gain)}) against the leader, distinctiveness ${
        distinctivenessMean === null ? "unavailable" : distinctivenessMean.toFixed(4)
      }`,
      0,
      sizeCoherences.length
    )
  );

  const candidate: MutationCandidate | null =
    gain > MUTATION_EPSILON && distinctivenessMean !== null
      ? {
          operator: "bridge",
          memberOut: null,
          memberIn: componentId,
          leaderAfter: {
            members: bridged,
            coherence: measured.coherence,
            percentile,
            distinctivenessMean,
            weakestLink: { ...measured.weakestLink }
          },
          gain,
          scratch: {
            pool: tempPool,
            graph: chain.graph,
            neighborhoods: neighborhoodsAfter,
            distinctiveness: chain.distinctiveness,
            familyCoherences: scratchCoherences
          }
        }
      : null;

  let bridgeDetail: string;
  if (candidate !== null) {
    bridgeDetail = `what both audiences love: ${names}; inserting ${componentId} as ${role} moves coherence ${signed(gain)} (percentile ${percentileText(percentile)})`;
  } else if (distinctivenessMean === null && gain > MUTATION_EPSILON) {
    bridgeDetail = `what both audiences love: ${names}; mutation withheld because the bridged composition carries no distinctiveness reading`;
  } else {
    bridgeDetail = `what both audiences love: ${names}; inserting ${componentId} would move coherence ${signed(gain)}, which does not repair the weak link`;
  }
  return {
    attack: {
      kind: "bridge",
      status: "measured",
      summary,
      detail: bridgeDetail.slice(0, 500),
      evidenceId: record.id
    },
    candidate
  };
}

function bridgeComponentId(seed: string, taken: readonly CandidateComponent[]): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = `comp-bridge-${slug === "" ? "connector" : slug}`;
  const takenIds = new Set(taken.map((component) => component.id));
  let candidate = base;
  let suffix = 2;
  while (takenIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function bridgeRole(ctx: AttackContext): PoolComponentRole {
  const leaderRoles = new Set<string>();
  for (const memberId of ctx.leader.members) {
    const component = ctx.pool.find((entry) => entry.id === memberId);
    if (component !== undefined) {
      leaderRoles.add(component.role);
    }
  }
  return poolComponentRoles.find((role) => role !== "Anchor" && !leaderRoles.has(role)) ?? "Community";
}

function catchmentAttack(ctx: AttackContext): AttackResult {
  const neighborhoods: RunNeighborhoods | undefined = ctx.neighborhoods;
  if (neighborhoods === undefined || neighborhoods.city.length === 0) {
    return skippedAttack(
      "catchment",
      "catchment shift skipped",
      "no stored city-scale neighborhoods exist; the catchment cannot widen without new evidence"
    );
  }
  try {
    const cityIdf = computeIdf(ctx.pool, neighborhoods.city);
    const cityGraph = buildGraph(ctx.pool, neighborhoods.city, cityIdf);
    const measured = measureComposition(ctx.leader.members, ctx.pool, cityGraph);
    const delta = measured.coherence - ctx.leader.coherence;
    return {
      attack: {
        kind: "catchment",
        status: "measured",
        summary: `city-scale coherence ${measured.coherence.toFixed(4)} vs site ${ctx.leader.coherence.toFixed(4)}`,
        detail:
          delta >= -CATCHMENT_HOLD_EPSILON
            ? `the leader holds when the catchment widens to city scale (Δ ${signed(delta)}; measured from stored Qloo city neighborhoods)`
            : `the leader depends on the site catchment: city-scale coherence moves ${signed(delta)} (measured from stored Qloo city neighborhoods)`
      },
      candidate: null
    };
  } catch (error) {
    return skippedAttack(
      "catchment",
      "catchment shift refused by the deterministic engine",
      (toError(error).message.split("\n")[0] ?? "city-scale re-measure failed").slice(0, 500)
    );
  }
}

function rivalAttack(ctx: AttackContext): AttackResult {
  const index = ctx.ranked.findIndex((composition) => sameMembers(composition.members, ctx.leader.members));
  const flips = ctx.compositions.rivalFlips;
  const margin = ctx.ranked.length >= 2 ? ctx.ranked[0]!.rankScore - ctx.ranked[1]!.rankScore : null;
  const summary =
    index >= 0
      ? `the leader holds rank ${index + 1} of ${ctx.ranked.length}`
      : `the mutated leader is not a family entry; the family leader remains ${ctx.ranked[0]!.members
          .map(ctx.nameOf)
          .join(" + ")}`;
  const flipText =
    flips.length === 0
      ? "no rival takes the lead across the dial sweep"
      : `${flips.length} sweep flip(s); at weight ${flips[0]!.weight.toFixed(2)} leadership moves to ${(flips[0]!.to ?? [])
          .map(ctx.nameOf)
          .join(" + ")}`;
  const marginText = margin === null ? "" : `; rank-1 margin ${margin.toFixed(4)}`;
  return {
    attack: {
      kind: "rival",
      status: "measured",
      summary,
      detail: `${flipText}${marginText}`
    },
    candidate: null
  };
}

function moveToFront(order: AttackKind[], kind: AttackKind): void {
  const index = order.indexOf(kind);
  if (index > 0) {
    order.splice(index, 1);
    order.unshift(kind);
  }
}

function diagnosticOrder(state: RunState, leader: ChallengeLeader): AttackKind[] {
  const order: AttackKind[] = [...attackKinds];
  if (leader.weakestLink.value < WEAK_LINK_DIAGNOSTIC) {
    moveToFront(order, "bridge");
  } else if (state.compositions !== undefined && state.compositions.rivalFlips.length > 0) {
    moveToFront(order, "rival");
  }
  return order;
}

function finalizeOrder(base: readonly AttackKind[], focus: AttackKind | undefined): AttackKind[] {
  const missing = attackKinds.filter((kind) => !base.includes(kind));
  const order: AttackKind[] = [...base, ...missing];
  if (focus !== undefined) {
    moveToFront(order, focus);
  }
  return order;
}

function parseOrder(content: string | null): AttackKind[] | null {
  if (content === null) {
    return null;
  }
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { order?: unknown };
    const order = z.array(attackKindSchema).min(1).max(5).safeParse(parsed.order);
    if (!order.success) {
      return null;
    }
    return [...new Set(order.data)];
  } catch {
    return null;
  }
}

function orderRequest(state: RunState, leader: ChallengeLeader): LlmCompletionRequest {
  const flips = state.compositions?.rivalFlips.length ?? 0;
  return {
    label: "challenge.attack_order",
    essential: false,
    maxOutputTokens: 300,
    messages: [
      {
        role: "user",
        content: `Zorq stress test. Leader members: ${leader.members.join(", ")}. Weakest link ${leader.weakestLink.a}–${leader.weakestLink.b} = ${leader.weakestLink.value.toFixed(2)}. Distinctiveness ${leader.distinctivenessMean.toFixed(2)}. Rival sweep flips: ${flips}. Choose the attack order most likely to break this leader. Allowed kinds: ${attackKinds.join(", ")}. Reply with JSON only: {"order":["first","second","third","fourth","fifth"]}.`
      }
    ]
  };
}

async function chooseAttackOrder(input: {
  state: RunState;
  leader: ChallengeLeader;
  ledger: Ledger;
  llm?: LlmClient;
  budget?: LlmBudget;
  focus: AttackKind | undefined;
}): Promise<{ order: AttackKind[]; source: "llm" | "diagnostic" }> {
  if (input.llm !== undefined && input.budget !== undefined) {
    try {
      const result = await completeBounded({
        llm: input.llm,
        budget: input.budget,
        ledger: input.ledger,
        request: orderRequest(input.state, input.leader)
      });
      const parsed = parseOrder(result.content);
      if (parsed !== null) {
        return { order: finalizeOrder(parsed, input.focus), source: "llm" };
      }
      input.ledger.append(
        computeEvent(
          "challenge.order_fallback",
          "the attack-order turn returned no usable JSON order; falling back to the deterministic diagnostic order",
          0,
          0
        )
      );
    } catch (error) {
      input.ledger.append(
        computeEvent(
          "challenge.order_fallback",
          `the attack-order turn failed (${toError(error).message.split("\n")[0]?.slice(0, 200) ?? "unknown failure"}); falling back to the deterministic diagnostic order`,
          0,
          0
        )
      );
    }
  }
  return { order: finalizeOrder(diagnosticOrder(input.state, input.leader), input.focus), source: "diagnostic" };
}

function describeMutation(mutation: ChallengeMutation, nameOf: (id: string) => string): string {
  if (mutation.operator === "swap" && mutation.memberIn !== null) {
    return `swapped ${nameOf(mutation.memberOut ?? "")} for ${nameOf(mutation.memberIn)}`;
  }
  if (mutation.operator === "drop") {
    return `dropped ${nameOf(mutation.memberOut ?? "")}`;
  }
  if (mutation.operator === "bridge" && mutation.memberIn !== null) {
    return `bridged ${nameOf(mutation.memberIn)} beside ${nameOf(mutation.memberOut ?? "the weakest link")}`;
  }
  return `revised ${mutation.memberOut === null ? "the leader" : nameOf(mutation.memberOut)}`;
}

export function resolveVerdict(
  before: ChallengeLeader,
  after: ChallengeLeader,
  mutations: readonly ChallengeMutation[]
): { verdict: ChallengeVerdict; verdictRival?: string[] } {
  if (mutations.length === 0 || sameMembers(before.members, after.members)) {
    return { verdict: "Survived" };
  }
  const present = new Set(after.members);
  const shared = before.members.filter((member) => present.has(member)).length;
  if (shared >= after.members.length - 1) {
    return { verdict: "Revised" };
  }
  return { verdict: "Replaced", verdictRival: [...after.members] };
}

function buildReason(input: {
  verdict: ChallengeVerdict;
  before: ChallengeLeader;
  after: ChallengeLeader;
  mutations: readonly ChallengeMutation[];
  results: readonly AttackResult[];
  pending: MutationCandidate | null;
  nameOf: (id: string) => string;
}): string {
  const { verdict, before, after, mutations, results, pending, nameOf } = input;
  if (verdict === "Survived") {
    const notes = results.map((result) => result.note).filter((note): note is string => note !== undefined);
    const measured = results.filter((result) => result.attack.status === "measured").length;
    const skipped = results.filter((result) => result.attack.status === "skipped").length;
    const missing = results.filter((result) => result.attack.status === "not completed").length;
    const lead =
      results.length === 5 && measured === 5
        ? "The leader held against all five attacks."
        : `The leader held against ${measured} measured attack${measured === 1 ? "" : "s"}${
            skipped > 0 ? `, ${skipped} skipped` : ""
          }${missing > 0 ? `, ${missing} not completed` : ""}.`;
    return [lead, ...notes].join(" ").slice(0, 500);
  }
  const movement = `Coherence moved ${signed(after.coherence - before.coherence)} to ${after.coherence.toFixed(4)}.`;
  const applied = `${mutations.length} mutation${mutations.length === 1 ? "" : "s"} applied: ${mutations
    .map((mutation) => `${mutation.round}·${describeMutation(mutation, nameOf)}`)
    .join("; ")}.`;
  const stopNote =
    pending !== null
      ? pending.operator === "bridge" && pending.memberIn !== null
        ? ` A further bridge ${nameOf(pending.memberIn)} (Δ ${signed(pending.gain)}) remained at the two-round stop.`
        : ` A further ${pending.operator}${
            pending.memberIn === null
              ? ` ${nameOf(pending.memberOut ?? "")}`
              : ` ${nameOf(pending.memberOut ?? "")} → ${nameOf(pending.memberIn)}`
          } (Δ ${signed(pending.gain)}) remained at the two-round stop.`
      : "";
  if (verdict === "Replaced") {
    return `Replaced by ${after.members.map(nameOf).join(" + ")}. ${applied} ${movement}${stopNote}`.slice(0, 500);
  }
  return `${applied} ${movement}${stopNote}`.slice(0, 500);
}

function pickCandidate(results: readonly AttackResult[]): MutationCandidate | null {
  let best: MutationCandidate | null = null;
  for (const result of results) {
    const candidate = result.candidate;
    if (candidate === null || candidate.gain <= MUTATION_EPSILON) {
      continue;
    }
    if (best === null || candidate.gain > best.gain || (candidate.gain === best.gain && candidate.operator === "swap")) {
      best = candidate;
    }
  }
  return best;
}

function hasFailedProbe(results: readonly AttackResult[]): boolean {
  return results.some((result) => result.attack.status === "not completed");
}

export async function runChallenge(input: ChallengeInput): Promise<ChallengeOutcome> {
  const { state, request, gateway, ledger, now } = input;
  guardMutationState(state);

  if (state.candidatePool === undefined || state.candidatePool.length === 0) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured candidate pool to challenge within`, [
      { path: "candidatePool", message: "challenge needs the investigated candidate pool" }
    ]);
  }
  if (state.compositions === undefined) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured compositions to challenge`, [
      { path: "compositions", message: "challenge needs a measured composition family" }
    ]);
  }
  if (state.graph === undefined) {
    throw new OrchestratorStateError(`run ${state.id} carries no measured culture graph`, [
      { path: "graph", message: "challenge recomputes every attack against the measured graph" }
    ]);
  }
  if (state.compositions.ranked.length === 0) {
    throw new OrchestratorStateError(`run ${state.id} has no ranked composition to lead the challenge`, [
      { path: "compositions.ranked", message: "challenge attacks the leader of a ranked family" }
    ]);
  }

  const pool = validatePool(state.candidatePool);
  const graph = state.graph as CultureGraph;
  const compositions = state.compositions;
  const ranked = compositions.ranked;
  const evidence: EvidenceRecord[] = [];
  const probesUsed = { count: 0 };
  const bridgeRecorded = { found: false };
  let scratch: ScratchState | null = null;

  // Display-name resolution for every id that can surface in judge-facing prose
  // (verdict reason, mutation ledger lines). Pool first; components introduced by
  // mutations are registered the moment they are applied.
  const nameLookup = new Map<string, string>(
    pool.map((component) => [component.id, componentDisplayName(component)])
  );
  const nameOf = (id: string): string => nameLookup.get(id) ?? id;

  const leaderBefore = leaderFromRanked(ranked[0]!);
  let leader = leaderBefore;

  const orderChoice = await chooseAttackOrder({
    state,
    leader: leaderBefore,
    ledger,
    llm: input.llm,
    budget: input.budget,
    focus: request.focus
  });
  ledger.append(
    computeEvent(
      "challenge.order",
      `attack order (${orderChoice.source}): ${orderChoice.order.join(" → ")}`,
      0,
      orderChoice.order.length
    )
  );

  const makeContext = (current: ChallengeLeader): AttackContext => ({
    state,
    compositions,
    pool: scratch?.pool ?? pool,
    graph: scratch?.graph ?? graph,
    ranked,
    familyCoherences: scratch?.familyCoherences ?? compositions.family.coherenceDistribution,
    distinctiveness: scratch?.distinctiveness ?? distinctivenessFor(state),
    neighborhoods: scratch?.neighborhoods ?? state.neighborhoods,
    leader: current,
    nameOf
  });

  const runRound = async (round: number): Promise<AttackResult[]> => {
    const ctx = makeContext(leader);
    const results: AttackResult[] = [];
    for (const kind of orderChoice.order) {
      if (kind === "bridge") {
        results.push(
          await bridgeAttack(ctx, { gateway, ledger, now, evidence, probesUsed, bridgeRecorded })
        );
      } else if (kind === "ablation") {
        results.push(ablationAttack(ctx));
      } else if (kind === "substitution") {
        results.push(substitutionAttack(ctx));
      } else if (kind === "catchment") {
        results.push(catchmentAttack(ctx));
      } else {
        results.push(rivalAttack(ctx));
      }
    }
    const measured = results.filter((result) => result.attack.status === "measured").length;
    const skipped = results.filter((result) => result.attack.status === "skipped").length;
    const failed = results.filter((result) => result.attack.status === "not completed").length;
    ledger.append(
      computeEvent(
        "challenge.stress",
        `round ${round}: ${measured} measured, ${skipped} skipped, ${failed} not completed over ${results.length} attack(s) in ${orderChoice.order.join(" → ")}`,
        0,
        results.length
      )
    );
    return results;
  };

  const applyCandidate = (candidate: MutationCandidate): void => {
    if (candidate.scratch !== null) {
      scratch = candidate.scratch;
    }
    const inserted =
      candidate.memberIn !== null && pool.every((component) => component.id !== candidate.memberIn)
        ? (candidate.scratch?.pool.find((component) => component.id === candidate.memberIn) ?? undefined)
        : undefined;
    const mutation: ChallengeMutation = {
      operator: candidate.operator,
      round: mutations.length + 1,
      memberOut: candidate.memberOut,
      memberIn: candidate.memberIn,
      coherenceBefore: leader.coherence,
      coherenceAfter: candidate.leaderAfter.coherence,
      ...(inserted !== undefined ? { component: inserted } : {})
    };
    mutations.push(mutation);
    if (inserted !== undefined) {
      nameLookup.set(inserted.id, componentDisplayName(inserted));
    }
    leader = candidate.leaderAfter;
    ledger.append(
      computeEvent(
        "challenge.mutation",
        `round ${mutation.round}: ${describeMutation(mutation, nameOf)}; coherence ${signed(mutation.coherenceAfter - mutation.coherenceBefore)}`,
        0,
        mutation.round
      )
    );
  };

  const mutations: ChallengeMutation[] = [];
  let results = await runRound(1);
  let rounds = 1;
  let gradeCapB = hasFailedProbe(results);
  let candidate = pickCandidate(results);
  while (candidate !== null && mutations.length < 2) {
    applyCandidate(candidate);
    results = await runRound(rounds + 1);
    rounds += 1;
    gradeCapB = gradeCapB || hasFailedProbe(results);
    candidate = pickCandidate(results);
  }
  const pending = candidate !== null && candidate.gain > MUTATION_EPSILON ? candidate : null;
  if (pending !== null && pending.memberIn !== null && !nameLookup.has(pending.memberIn)) {
    const pendingComponent = pending.scratch?.pool.find((component) => component.id === pending.memberIn);
    if (pendingComponent !== undefined) {
      nameLookup.set(pendingComponent.id, componentDisplayName(pendingComponent));
    }
  }

  const { verdict, verdictRival } = resolveVerdict(leaderBefore, leader, mutations);
  const reason = buildReason({ verdict, before: leaderBefore, after: leader, mutations, results, pending, nameOf });
  const attacksBySpecOrder = [...results]
    .sort(
      (left, right) =>
        attackKinds.indexOf(left.attack.kind) - attackKinds.indexOf(right.attack.kind)
    )
    .map((result) => result.attack);

  const report: ChallengeReport = {
    kind: "challenge",
    verdict,
    ...(verdictRival !== undefined ? { verdictRival } : {}),
    reason,
    attackOrder: orderChoice.order,
    attackOrderSource: orderChoice.source,
    rounds,
    leaderBefore,
    leaderAfter: leader,
    mutations,
    attacks: attacksBySpecOrder,
    gradeCap: gradeCapB ? "B" : "A",
    generatedAt: new Date(now()).toISOString()
  };

  ledger.append(computeEvent("challenge.verdict", `${verdict}: ${reason}`, 0, attacksBySpecOrder.length));

  const next = runStateSchema.parse({
    ...state,
    challengeReport: report
  });

  return { state: next, evidence, report };
}
