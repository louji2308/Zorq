import type { LedgerEvent } from "../../shared/events.js";
import type { Brief } from "../../shared/brief.js";
import type {
  CulturalDna,
  PoolExemplar,
  Prior,
  RunCompositions,
  RunGraph,
  RunNeighborhoods,
  RunPriorMarker,
  RunRankedComposition,
  RunState
} from "../../shared/run.js";
import { extractPriorMemberEntries } from "../../shared/run.js";
import { provenanceFromEnvelope } from "../agent/tools.js";
import type { Ledger, LedgerEntry } from "../agent/ledger.js";
import {
  TRIANGULATION_MIN_USABLE_RESULTS,
  buildCompositions,
  buildGraph,
  buildNeighborhoods,
  classifyTriangulation,
  computeDistinctivenessMap,
  computeIdf,
  gradeEvidence,
  measureComposition,
  neighborhoodDomains,
  percentileOf,
  rankCompositionSet,
  rivalSweep,
  route1FromGraph,
  sharedEntitiesForEdge,
  validatePool,
  type CandidateComponent,
  type ComponentRole,
  type CompositionFamily,
  type CultureGraph,
  type IdfLookup,
  type NeighborhoodDomain,
  type NeighborhoodSignalInput,
  type RawNeighborhoodSignal,
  type RankingResult,
  type TasteNeighborhood,
  type TriangulationClassification,
  type WeightedEntity
} from "../engine/index.js";
import { createEvidenceRecord, type EvidenceRecord } from "../evidence/index.js";
import { toError } from "../agent/errors.js";
import type { QlooEnvelope, QlooGateway, QlooInsightsResults } from "../qloo/index.js";

export const NEIGHBORHOOD_TAKE = 30;
const MEASUREMENT_BUDGET_RESERVE = 54;
const MAX_CONSECUTIVE_FETCH_FAILURES = 2;
export const COMPOSITION_SIZE = 5;
const FINALIST_COUNT = 3;
const MAX_TRIANGULATION_PROBES = 24;
const ROUTE2_DEFAULT_RADIUS_M = 400;
const ROUTE2_MAX_RADIUS_M = 5000;
const ROUTE2_WIDEN_FACTOR = 5;
const EDGE_SHARED_ENTITY_CAP = 8;
const DNA_ENTITY_CAP = 30;

export interface MeasurementInput {
  state: RunState;
  gateway: QlooGateway;
  ledger: Ledger;
  now: () => number;
  shouldStop: () => boolean;
}

export interface MeasurementResult {
  state: RunState;
  evidence: EvidenceRecord[];
  degraded: boolean;
}

interface MeasurementContext {
  gateway: QlooGateway;
  ledger: Ledger;
  now: () => number;
  shouldStop: () => boolean;
  evidence: EvidenceRecord[];
  entityNames: Map<string, string>;
  consecutiveFailures: number;
  budgetStopped: boolean;
  failureStopped: boolean;
}

interface ScopeFetch {
  signals: RawNeighborhoodSignal[];
  evidenceId: string | null;
}

export function computeEvent(label: string, summary: string, duration: number, resultCount: number): LedgerEvent {
  return { kind: "Compute", label, summary, duration, cacheState: "n/a", resultCount };
}

export function observationEvent(label: string, envelope: QlooEnvelope<unknown>, detail: string): LedgerEvent {
  return {
    kind: "Qloo",
    label,
    summary: `${envelope.status} ${envelope.operation} via ${envelope.transport} | ${envelope.cache} | ${envelope.resultCount} result(s) · ${detail}`,
    duration: envelope.provenance.durationMs,
    cacheState: envelope.cache,
    resultCount: envelope.resultCount
  };
}

export function failedCallEvent(label: string, detail: string, error: unknown): LedgerEvent {
  const failure = toError(error);
  const line = failure.message.split("\n")[0] ?? failure.name;
  return {
    kind: "Qloo",
    label,
    summary: `call failed · ${detail} · ${line.slice(0, 200)}`,
    duration: 0,
    cacheState: "n/a",
    resultCount: 0
  };
}

export function localityLadder(location: string): string[] {
  const trimmed = location.trim();
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const attempts = [trimmed === "" ? location : trimmed];
  if (parts.length >= 2) {
    const broader = parts.slice(-2).join(", ");
    if (broader.toLowerCase() !== attempts[0].toLowerCase()) {
      attempts.push(broader);
    }
  }
  return attempts;
}

function budgetAvailable(context: MeasurementContext): boolean {
  return context.gateway.stats.budgetRemaining > MEASUREMENT_BUDGET_RESERVE;
}

function aborting(context: MeasurementContext): boolean {
  return context.shouldStop() || context.budgetStopped || context.failureStopped;
}

function recordEntityNames(context: MeasurementContext, envelope: QlooEnvelope<QlooInsightsResults>): void {
  for (const entity of envelope.results.entities ?? []) {
    if (typeof entity.entityId !== "string" || entity.entityId.trim() === "") {
      continue;
    }
    const id = entity.entityId.trim();
    if (context.entityNames.has(id)) {
      continue;
    }
    if (typeof entity.name === "string" && entity.name.trim() !== "") {
      context.entityNames.set(id, entity.name.trim());
    }
  }
}

export function projectSignals(envelope: QlooEnvelope<QlooInsightsResults>): RawNeighborhoodSignal[] {
  const signals: RawNeighborhoodSignal[] = [];
  const seen = new Set<string>();
  (envelope.results.entities ?? []).forEach((entity, index) => {
    if (typeof entity.entityId !== "string" || entity.entityId.trim() === "") {
      return;
    }
    const id = entity.entityId.trim();
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const affinity = entity.affinity;
    const name = typeof entity.name === "string" ? entity.name.trim().slice(0, 200) : "";
    signals.push({
      entityId: id,
      rank: index + 1,
      ...(typeof affinity === "number" && Number.isFinite(affinity) && affinity > 0 ? { affinity } : {}),
      ...(name !== "" ? { name } : {})
    });
  });
  return signals;
}

export function projectExemplars(envelope: QlooEnvelope<QlooInsightsResults>): PoolExemplar[] {
  const entities = envelope.results.entities ?? [];
  const exemplars: PoolExemplar[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    if (typeof entity.entityId !== "string" || entity.entityId.trim() === "") {
      continue;
    }
    const id = entity.entityId.trim();
    if (id.length > 200 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const name =
      typeof entity.name === "string" && entity.name.trim() !== "" ? entity.name.trim().slice(0, 200) : id;
    exemplars.push({ id, name });
    if (exemplars.length >= 5) {
      break;
    }
  }
  return exemplars;
}

async function callGateway(
  context: MeasurementContext,
  label: string,
  detail: string,
  call: () => Promise<QlooEnvelope<unknown>>
): Promise<{ envelope: QlooEnvelope<unknown>; evidenceId: string } | null> {
  if (!budgetAvailable(context)) {
    context.budgetStopped = true;
    return null;
  }
  try {
    const envelope = await call();
    context.consecutiveFailures = 0;
    const entry: LedgerEntry = context.ledger.append(observationEvent(label, envelope, detail));
    const record = createEvidenceRecord({
      operation: envelope.operation,
      claim: `Qloo ${envelope.operation} observation · ${detail}`,
      provenance: provenanceFromEnvelope(envelope),
      createdAt: new Date(context.now()).toISOString(),
      ledgerEventId: entry.id
    });
    context.evidence.push(record);
    recordEntityNames(context, envelope as QlooEnvelope<QlooInsightsResults>);
    return { envelope, evidenceId: record.id };
  } catch (error) {
    context.consecutiveFailures += 1;
    if (context.consecutiveFailures >= MAX_CONSECUTIVE_FETCH_FAILURES) {
      context.failureStopped = true;
    }
    context.ledger.append(failedCallEvent(label, detail, error));
    return null;
  }
}

async function fetchNeighborhoodScope(
  context: MeasurementContext,
  component: CandidateComponent,
  domain: NeighborhoodDomain,
  scope: "site" | "city",
  brief: Brief
): Promise<ScopeFetch> {
  const base = {
    filterType: domain,
    signalEntities: component.exemplars.map((exemplar) => exemplar.id),
    take: NEIGHBORHOOD_TAKE
  };
  const attempts: Array<string | null> = scope === "site" ? localityLadder(brief.location) : [null];
  let lastEvidenceId: string | null = null;
  for (const attempt of attempts) {
    if (aborting(context)) {
      break;
    }
    const detail = `component ${component.id} · ${domain} ${scope}${
      attempt === null ? "" : ` · signal "${attempt}"`
    }`;
    const outcome = await callGateway(context, "measure.neighborhood_fetch", detail, () =>
      context.gateway.insights({
        ...base,
        ...(attempt === null ? {} : { signalLocation: attempt })
      })
    );
    if (outcome === null) {
      break;
    }
    lastEvidenceId = outcome.evidenceId;
    const envelope = outcome.envelope as QlooEnvelope<QlooInsightsResults>;
    const signals = projectSignals(envelope);
    if (signals.length > 0) {
      return { signals, evidenceId: outcome.evidenceId };
    }
  }
  return { signals: [], evidenceId: lastEvidenceId };
}

function neighborhoodSummary(neighborhoods: readonly TasteNeighborhood[]): string {
  const measured = neighborhoods.filter((entry) => entry.state === "measured").length;
  const incomplete = neighborhoods.filter((entry) => entry.state === "incomplete").length;
  const missing = neighborhoods.filter((entry) => entry.state === "not measured").length;
  return `${measured} measured, ${incomplete} incomplete, ${missing} not measured`;
}

function pairKey(a: string, b: string): string {
  return JSON.stringify(a <= b ? [a, b] : [b, a]);
}

async function resolveComponentTag(
  context: MeasurementContext,
  component: CandidateComponent,
  memo: Map<string, string | null>,
  tagMemo: Map<string, string | null>
): Promise<string | null> {
  if (memo.has(component.id)) {
    return memo.get(component.id) ?? null;
  }
  for (const tag of component.tags) {
    if (aborting(context)) {
      break;
    }
    if (!tagMemo.has(tag)) {
      const outcome = await callGateway(context, "measure.resolve_tag", `tag query "${tag}"`, () =>
        context.gateway.resolveTags({ query: tag, take: 5 })
      );
      if (outcome === null) {
        tagMemo.set(tag, null);
        continue;
      }
      const tags = (outcome.envelope as { results?: { tags?: Array<{ id?: string }> } }).results?.tags ?? [];
      const id = tags[0]?.id;
      tagMemo.set(tag, typeof id === "string" && id.trim() !== "" ? id.trim() : null);
    }
    const resolved = tagMemo.get(tag);
    if (typeof resolved === "string" && resolved !== "") {
      memo.set(component.id, resolved);
      return resolved;
    }
  }
  memo.set(component.id, null);
  return null;
}

async function probeRoute2(
  context: MeasurementContext,
  signalComponent: CandidateComponent,
  typeComponent: CandidateComponent,
  brief: Brief,
  componentTagMemo: Map<string, string | null>,
  tagMemo: Map<string, string | null>
): Promise<{ resultCount: number; focalInTopHalf: boolean | null }> {
  if (brief.coordinates === undefined) {
    return { resultCount: 0, focalInTopHalf: null };
  }
  const tagId = await resolveComponentTag(context, typeComponent, componentTagMemo, tagMemo);
  if (tagId === null || aborting(context)) {
    return { resultCount: 0, focalInTopHalf: null };
  }
  const initialRadius =
    typeof brief.radius === "number" && Number.isFinite(brief.radius) && brief.radius > 0
      ? Math.round(brief.radius)
      : ROUTE2_DEFAULT_RADIUS_M;
  const focalIds = new Set(typeComponent.exemplars.map((exemplar) => exemplar.id));
  let radius = initialRadius;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (aborting(context)) {
      return { resultCount: 0, focalInTopHalf: null };
    }
    const detail = `edge probe ${signalComponent.id} → ${typeComponent.id} · tag ${tagId} · radius ${radius}m`;
    const outcome = await callGateway(context, "measure.triangulate_probe", detail, () =>
      context.gateway.insights({
        filterType: "place",
        signalEntities: signalComponent.exemplars.map((exemplar) => exemplar.id),
        filterTags: [tagId],
        location: { point: { lat: brief.coordinates?.lat ?? 0, lon: brief.coordinates?.lon ?? 0 }, radiusM: radius },
        take: 10
      })
    );
    if (outcome === null) {
      return { resultCount: 0, focalInTopHalf: null };
    }
    const entities =
      (outcome.envelope as QlooEnvelope<QlooInsightsResults>).results.entities ?? [];
    if (entities.length >= TRIANGULATION_MIN_USABLE_RESULTS || attempt === 1) {
      const half = Math.ceil(entities.length / 2);
      const focalInTopHalf = entities.slice(0, half).some((entity) => focalIds.has(entity.entityId));
      return { resultCount: entities.length, focalInTopHalf };
    }
    const widened = Math.min(ROUTE2_MAX_RADIUS_M, radius * ROUTE2_WIDEN_FACTOR);
    if (widened <= radius) {
      return { resultCount: entities.length, focalInTopHalf: false };
    }
    radius = widened;
  }
  return { resultCount: 0, focalInTopHalf: null };
}

export function resolvePriorMarker(
  prior: Prior | undefined,
  pool: readonly CandidateComponent[],
  graph: CultureGraph,
  family: CompositionFamily | null
): RunPriorMarker {
  if (prior === undefined) {
    return { state: "not measured", reason: "the run carries no persisted Prior" };
  }
  const entries = extractPriorMemberEntries(prior.composition);
  const resolvedIds = new Set<string>();
  for (const entry of entries) {
    const needle = entry.name.toLowerCase();
    for (const component of pool) {
      if (entry.role !== undefined && component.role !== entry.role) {
        continue;
      }
      const matches =
        component.id.toLowerCase() === needle ||
        component.exemplars.some((exemplar) => exemplar.name.toLowerCase() === needle) ||
        component.tags.some((tag) => tag.toLowerCase() === needle);
      if (matches) {
        resolvedIds.add(component.id);
      }
    }
  }
  const members = [...resolvedIds].sort();
  if (members.length < 2) {
    return {
      state: "not measured",
      reason: `only ${members.length} Prior member(s) resolve against the measured pool; no Prior reading is guessed`
    };
  }
  try {
    const measured = measureComposition(members, pool, graph);
    const coherences = (family?.compositions ?? []).map((composition) => composition.coherence);
    const percentile =
      family !== null && members.length === family.size
        ? percentileOf(measured.coherence, coherences)
        : null;
    return { state: "measured", members: measured.members, coherence: measured.coherence, percentile };
  } catch {
    return {
      state: "not measured",
      reason: "Prior members resolve against the pool but their pairwise edges are not measured"
    };
  }
}

function buildCulturalDna(
  siteNeighborhoods: readonly TasteNeighborhood[],
  cityNeighborhoods: readonly TasteNeighborhood[],
  entityNames: ReadonlyMap<string, string>
): CulturalDna | undefined {
  const domainKeys: Array<{ key: "artists" | "films" | "brands"; domain: NeighborhoodDomain }> = [
    { key: "artists", domain: "artist" },
    { key: "films", domain: "movie" },
    { key: "brands", domain: "brand" }
  ];
  const dna: CulturalDna = {};
  for (const { key, domain } of domainKeys) {
    const siteAgg = new Map<string, number>();
    const cityAgg = new Map<string, number>();
    for (const neighborhood of siteNeighborhoods) {
      for (const entry of neighborhood.domains[domain]) {
        siteAgg.set(entry.entityId, (siteAgg.get(entry.entityId) ?? 0) + entry.weight);
      }
    }
    for (const neighborhood of cityNeighborhoods) {
      for (const entry of neighborhood.domains[domain]) {
        cityAgg.set(entry.entityId, (cityAgg.get(entry.entityId) ?? 0) + entry.weight);
      }
    }
    if (siteAgg.size === 0 || cityAgg.size === 0) {
      continue;
    }
    const totalSite = [...siteAgg.values()].reduce((sum, weight) => sum + weight, 0);
    const totalCity = [...cityAgg.values()].reduce((sum, weight) => sum + weight, 0);
    if (!(totalSite > 0) || !(totalCity > 0)) {
      continue;
    }
    const entities = [...siteAgg.entries()]
      .map(([entityId, weight]) => ({
        entityId,
        name: entityNames.get(entityId),
        local: (weight / totalSite) * 100,
        city: ((cityAgg.get(entityId) ?? 0) / totalCity) * 100
      }))
      .filter((entry): entry is typeof entry & { name: string } => typeof entry.name === "string")
      .map((entry) => ({ name: entry.name, local: entry.local, city: entry.city }))
      .sort((left, right) => {
        if (right.local !== left.local) {
          return right.local - left.local;
        }
        return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
      })
      .slice(0, DNA_ENTITY_CAP);
    if (entities.length > 0) {
      dna[key] = entities;
    }
  }
  return Object.keys(dna).length > 0 ? dna : undefined;
}

function emptyFamily(poolSize: number, size: number, requiredRoles: ComponentRole[]): CompositionFamily {
  return {
    poolSize,
    size,
    requiredRoles,
    totalCandidates: 0,
    totalValid: 0,
    compositions: []
  };
}

function familyReason(pool: readonly CandidateComponent[], family: CompositionFamily): string | undefined {
  if (pool.length < 2) {
    return "fewer than 2 pool components; no composition can be measured from this pool";
  }
  if (family.totalValid === 0) {
    return `no size-${family.size} subset of this pool is both role-valid and fully measured; nothing is ranked or fabricated`;
  }
  return undefined;
}

export function projectRunGraph(
  graph: CultureGraph,
  siteNeighborhoods: readonly TasteNeighborhood[],
  idf: IdfLookup
): RunGraph {
  const neighborhoodsById = new Map(siteNeighborhoods.map((entry) => [entry.componentId, entry]));
  const runGraph: RunGraph = {
    nodes: [...graph.nodes],
    edges: graph.edges.map((edge) => {
      if (edge.state !== "measured") {
        return { a: edge.a, b: edge.b, value: edge.value, band: edge.band, state: edge.state };
      }
      const a = neighborhoodsById.get(edge.a);
      const b = neighborhoodsById.get(edge.b);
      if (a === undefined || b === undefined) {
        return { a: edge.a, b: edge.b, value: edge.value, band: edge.band, state: edge.state };
      }
      const shared = sharedEntitiesForEdge(a, b, idf, EDGE_SHARED_ENTITY_CAP);
      if (shared.length === 0) {
        return { a: edge.a, b: edge.b, value: edge.value, band: edge.band, state: edge.state };
      }
      return { a: edge.a, b: edge.b, value: edge.value, band: edge.band, state: edge.state, sharedEntities: shared };
    })
  };
  return runGraph;
}

export interface CompositionsProjection {
  pool: readonly CandidateComponent[];
  family: CompositionFamily | null;
  familyError: string | null;
  ranking: RankingResult | null;
  triangulation: TriangulationClassification[];
  prior: RunPriorMarker;
}

export function projectCompositionsNode(input: CompositionsProjection): RunCompositions {
  const { pool, family, familyError, ranking, triangulation, prior } = input;
  const requiredRoles: ComponentRole[] = pool.some((component) => component.role === "Anchor") ? ["Anchor"] : [];
  const effectiveFamily: CompositionFamily =
    family ??
    emptyFamily(pool.length, pool.length >= 2 ? Math.min(COMPOSITION_SIZE, pool.length) : 0, requiredRoles);
  const reason = familyReason(pool, effectiveFamily) ?? familyError ?? undefined;
  const classifiedStates = new Map<string, TriangulationClassification["state"]>();
  for (const entry of triangulation) {
    classifiedStates.set(pairKey(entry.a, entry.b), entry.state);
  }
  const ranked: RunRankedComposition[] = (ranking?.ranked ?? []).map((composition) => {
    const edges: Array<{ a: string; b: string; state: TriangulationClassification["state"] }> = [];
    for (let left = 0; left < composition.members.length; left += 1) {
      for (let right = left + 1; right < composition.members.length; right += 1) {
        const [lowId, highId] =
          composition.members[left] <= composition.members[right]
            ? [composition.members[left], composition.members[right]]
            : [composition.members[right], composition.members[left]];
        const state = classifiedStates.get(pairKey(lowId, highId));
        if (state !== undefined) {
          edges.push({ a: lowId, b: highId, state });
        }
      }
    }
    const gradeResult = gradeEvidence({ members: composition.members, pool, edges });
    return {
      members: composition.members,
      size: composition.size,
      coherence: composition.coherence,
      percentile: composition.percentile,
      distinctivenessMean: composition.distinctivenessMean,
      weakestLink: composition.weakestLink,
      rankScore: composition.rankScore,
      grade: gradeResult.grade,
      gradeReasons: [...gradeResult.reasons]
    };
  });
  const excluded = (ranking?.excluded ?? []).map((entry) => ({
    members: entry.members,
    reason: entry.reason
  }));
  const compositionsNode: RunCompositions = {
    family: {
      poolSize: effectiveFamily.poolSize,
      size: effectiveFamily.size,
      requiredRoles: effectiveFamily.requiredRoles,
      totalCandidates: effectiveFamily.totalCandidates,
      totalValid: effectiveFamily.totalValid,
      coherenceDistribution: effectiveFamily.compositions.map((composition) => composition.coherence),
      ...(reason !== undefined ? { reason } : {})
    },
    ranked,
    excluded,
    triangulation,
    rivalFlips: (ranking?.sweep.flips ?? []).map((flip) => ({
      index: flip.index,
      weight: flip.weight,
      from: flip.from,
      to: flip.to
    })),
    prior
  };
  return compositionsNode;
}

export interface RebuildChainResult {
  idf: IdfLookup;
  graph: CultureGraph;
  runGraph: RunGraph;
  distinctiveness: Record<string, number | null>;
  requiredRoles: ComponentRole[];
  family: CompositionFamily | null;
  familyError: string | null;
  ranking: RankingResult | null;
}

export function rebuildChain(input: {
  pool: CandidateComponent[];
  siteNeighborhoods: readonly TasteNeighborhood[];
  cityNeighborhoods: readonly TasteNeighborhood[];
  familySize: number;
}): RebuildChainResult {
  const { pool, siteNeighborhoods, cityNeighborhoods, familySize } = input;
  const idf = computeIdf(pool, siteNeighborhoods);
  const graph = buildGraph(pool, siteNeighborhoods, idf);
  const runGraph = projectRunGraph(graph, siteNeighborhoods, idf);
  const cityVectors: Record<string, WeightedEntity[]> = {};
  for (const neighborhood of cityNeighborhoods) {
    cityVectors[neighborhood.componentId] = neighborhood.domains.artist.map((entry) => ({
      entityId: entry.entityId,
      weight: entry.weight
    }));
  }
  const distinctiveness = computeDistinctivenessMap(siteNeighborhoods, cityVectors);
  const requiredRoles: ComponentRole[] = pool.some((component) => component.role === "Anchor") ? ["Anchor"] : [];
  const size = Math.min(familySize, pool.length);
  let family: CompositionFamily | null = null;
  let ranking: RankingResult | null = null;
  let familyError: string | null = null;
  if (pool.length >= 2) {
    try {
      family = buildCompositions({ pool, graph, size, requiredRoles, distinctiveness });
      ranking = { ...rankCompositionSet(family.compositions), sweep: rivalSweep(family.compositions) };
    } catch (error) {
      familyError = toError(error).message.split("\n")[0] ?? "engine refused the composition family";
    }
  }
  return { idf, graph, runGraph, distinctiveness, requiredRoles, family, familyError, ranking };
}

export async function runMeasurement(input: MeasurementInput): Promise<MeasurementResult> {
  const { state } = input;
  if (state.candidatePool === undefined || state.candidatePool.length === 0 || state.brief === undefined) {
    return { state, evidence: [], degraded: false };
  }
  const pool = validatePool(state.candidatePool);
  const brief = state.brief;
  const context: MeasurementContext = {
    gateway: input.gateway,
    ledger: input.ledger,
    now: input.now,
    shouldStop: input.shouldStop,
    evidence: [],
    entityNames: new Map(),
    consecutiveFailures: 0,
    budgetStopped: false,
    failureStopped: false
  };

  const sortedPool = [...pool].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const siteSignals = new Map<string, Map<NeighborhoodDomain, RawNeighborhoodSignal[]>>();
  const citySignals = new Map<string, Map<NeighborhoodDomain, RawNeighborhoodSignal[]>>();
  const sources: RunNeighborhoods["sources"] = [];
  for (const component of sortedPool) {
    siteSignals.set(component.id, new Map());
    citySignals.set(component.id, new Map());
  }
  const fetchStartedAt = input.now();
  for (const component of sortedPool) {
    for (const domain of neighborhoodDomains) {
      const site = await fetchNeighborhoodScope(context, component, domain, "site", brief);
      siteSignals.get(component.id)?.set(domain, site.signals);
      if (site.evidenceId !== null) {
        sources.push({ componentId: component.id, domain, scope: "site", evidenceId: site.evidenceId });
      }
      const city = await fetchNeighborhoodScope(context, component, domain, "city", brief);
      citySignals.get(component.id)?.set(domain, city.signals);
      if (city.evidenceId !== null) {
        sources.push({ componentId: component.id, domain, scope: "city", evidenceId: city.evidenceId });
      }
    }
  }
  const fetchDuration = Math.max(0, input.now() - fetchStartedAt);

  const siteInputs: NeighborhoodSignalInput[] = [];
  const cityInputs: NeighborhoodSignalInput[] = [];
  for (const component of sortedPool) {
    for (const domain of neighborhoodDomains) {
      siteInputs.push({
        componentId: component.id,
        domain,
        signals: siteSignals.get(component.id)?.get(domain) ?? []
      });
      cityInputs.push({
        componentId: component.id,
        domain,
        signals: citySignals.get(component.id)?.get(domain) ?? []
      });
    }
  }
  const siteNeighborhoods = buildNeighborhoods(pool, siteInputs);
  const cityNeighborhoods = buildNeighborhoods(pool, cityInputs);
  input.ledger.append(
    computeEvent(
      "measure.neighborhoods",
      `taste neighborhoods from ${context.evidence.length} Qloo observation(s) — site: ${neighborhoodSummary(
        siteNeighborhoods
      )}; city baseline (unlocalized Qloo audience): ${neighborhoodSummary(cityNeighborhoods)}`,
      fetchDuration,
      siteNeighborhoods.filter((entry) => entry.state === "measured").length
    )
  );

  const idf = computeIdf(pool, siteNeighborhoods);
  const graph = buildGraph(pool, siteNeighborhoods, idf);
  const runGraph = projectRunGraph(graph, siteNeighborhoods, idf);
  const measuredEdges = graph.edges.filter((edge) => edge.state === "measured").length;
  input.ledger.append(
    computeEvent(
      "measure.graph",
      `culture graph: ${measuredEdges} measured edge(s) of ${graph.edges.length}; unmeasured pairs stay hatched, never guessed`,
      0,
      measuredEdges
    )
  );

  const cityVectors: Record<string, WeightedEntity[]> = {};
  for (const neighborhood of cityNeighborhoods) {
    cityVectors[neighborhood.componentId] = neighborhood.domains.artist.map((entry) => ({
      entityId: entry.entityId,
      weight: entry.weight
    }));
  }
  const distinctiveness = computeDistinctivenessMap(siteNeighborhoods, cityVectors);

  const requiredRoles: ComponentRole[] = pool.some((component) => component.role === "Anchor") ? ["Anchor"] : [];
  const size = Math.min(COMPOSITION_SIZE, pool.length);
  let family: CompositionFamily | null = null;
  let ranking: RankingResult | null = null;
  let familyError: string | null = null;
  if (pool.length >= 2) {
    try {
      family = buildCompositions({ pool, graph, size, requiredRoles, distinctiveness });
      ranking = {
        ...rankCompositionSet(family.compositions),
        sweep: rivalSweep(family.compositions)
      };
    } catch (error) {
      familyError = toError(error).message.split("\n")[0] ?? "engine refused the composition family";
    }
  }

  const finalists = (ranking?.ranked ?? []).slice(0, FINALIST_COUNT);
  const pairSet = new Set<string>();
  const finalistPairs: Array<[CandidateComponent, CandidateComponent]> = [];
  const componentsById = new Map(pool.map((component) => [component.id, component]));
  for (const finalist of finalists) {
    for (let left = 0; left < finalist.members.length; left += 1) {
      for (let right = left + 1; right < finalist.members.length; right += 1) {
        const [lowId, highId] =
          finalist.members[left] <= finalist.members[right]
            ? [finalist.members[left], finalist.members[right]]
            : [finalist.members[right], finalist.members[left]];
        const key = pairKey(lowId, highId);
        if (pairSet.has(key)) {
          continue;
        }
        pairSet.add(key);
        const low = componentsById.get(lowId);
        const high = componentsById.get(highId);
        if (low !== undefined && high !== undefined) {
          finalistPairs.push([low, high]);
        }
      }
    }
  }
  finalistPairs.sort(([leftA, leftB], [rightA, rightB]) =>
    pairKey(leftA.id, leftB.id) < pairKey(rightA.id, rightB.id) ? -1 : 1
  );
  const probedPairs = finalistPairs.slice(0, MAX_TRIANGULATION_PROBES);
  const triangulation: TriangulationClassification[] = [];
  const componentTagMemo = new Map<string, string | null>();
  const tagMemo = new Map<string, string | null>();
  for (const [a, b] of probedPairs) {
    const route2 = await probeRoute2(context, a, b, brief, componentTagMemo, tagMemo);
    const route1 = route1FromGraph(graph, a.id, b.id);
    triangulation.push(classifyTriangulation({ a: a.id, b: b.id, route1, route2 }));
  }
  const triCounts = {
    confirmed: triangulation.filter((entry) => entry.state === "confirmed").length,
    contested: triangulation.filter((entry) => entry.state === "contested").length,
    thin: triangulation.filter((entry) => entry.state === "thin").length,
    failed: triangulation.filter((entry) => entry.state === "failed").length
  };
  input.ledger.append(
    computeEvent(
      "measure.triangulate",
      `triangulation for ${finalists.length} finalist composition(s): ${triCounts.confirmed} confirmed, ${triCounts.contested} contested, ${triCounts.thin} thin, ${triCounts.failed} failed over ${triangulation.length} edge probe(s)`,
      0,
      triangulation.length
    )
  );

  const prior = resolvePriorMarker(state.prior, pool, graph, family);
  const compositionsNode = projectCompositionsNode({
    pool,
    family,
    familyError,
    ranking,
    triangulation,
    prior
  });
  const ranked = compositionsNode.ranked;
  const excluded = compositionsNode.excluded;
  input.ledger.append(
    computeEvent(
      "measure.compositions",
      `composition family: ${compositionsNode.family.totalValid} role-valid of ${compositionsNode.family.totalCandidates} candidate(s) at size ${compositionsNode.family.size}; ${ranked.length} ranked with ${ranked.filter((entry) => entry.grade === "A").length} A / ${ranked.filter((entry) => entry.grade === "B").length} B / ${ranked.filter((entry) => entry.grade === "C").length} C; ${excluded.length} excluded honestly`,
      0,
      ranked.length
    )
  );

  const culturalDna = buildCulturalDna(siteNeighborhoods, cityNeighborhoods, context.entityNames);
  if (culturalDna !== undefined) {
    const counts = [
      culturalDna.artists?.length ?? 0,
      culturalDna.films?.length ?? 0,
      culturalDna.brands?.length ?? 0
    ];
    input.ledger.append(
      computeEvent(
        "measure.dna",
        `cultural DNA from over-index shares: ${counts[0]} artist(s), ${counts[1]} film(s), ${counts[2]} brand(s); each dot is the entity's share of local vs city taste mass, entities missing names are omitted, never invented`,
        0,
        counts[0] + counts[1] + counts[2]
      )
    );
  }

  const neighborhoodsNode: RunNeighborhoods = {
    components: siteNeighborhoods.map((entry) => ({
      componentId: entry.componentId,
      domains: {
        artist: entry.domains.artist.map((item) => ({ ...item })),
        movie: entry.domains.movie.map((item) => ({ ...item })),
        brand: entry.domains.brand.map((item) => ({ ...item }))
      },
      state: entry.state
    })),
    city: cityNeighborhoods.map((entry) => ({
      componentId: entry.componentId,
      domains: {
        artist: entry.domains.artist.map((item) => ({ ...item })),
        movie: entry.domains.movie.map((item) => ({ ...item })),
        brand: entry.domains.brand.map((item) => ({ ...item }))
      },
      state: entry.state
    })),
    sources
  };

  const degraded = context.budgetStopped || context.failureStopped || context.shouldStop();
  return {
    state: {
      ...state,
      neighborhoods: neighborhoodsNode,
      graph: runGraph,
      compositions: compositionsNode,
      ...(culturalDna !== undefined ? { culturalDna } : {})
    },
    evidence: context.evidence,
    degraded
  };
}
