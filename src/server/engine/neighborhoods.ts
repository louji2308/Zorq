import { z } from "zod";
import {
  EngineError,
  type CandidateComponent,
  type NeighborhoodDomain,
  type NeighborhoodEntry,
  type NeighborhoodSignalInput,
  type RawNeighborhoodSignal,
  type TasteNeighborhood,
  neighborhoodDomains
} from "./types.js";

const NEIGHBORHOOD_CAP = 30;

const signalKeySchema = z.object({
  entityId: z.string().trim().min(1).max(200),
  rank: z.number().int().min(1)
});

function signalErrorMessage(context: string, error: z.ZodError): string {
  const detail = error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return `${context}: ${detail}`;
}

function signalWeight(affinity: unknown, rank: number): { weight: number; affinityUsed: boolean } {
  if (typeof affinity === "number" && Number.isFinite(affinity) && affinity > 0) {
    return { weight: affinity, affinityUsed: true };
  }
  return { weight: 1 / rank, affinityUsed: false };
}

function parseSignal(raw: unknown, componentId: string, domain: NeighborhoodDomain): RawNeighborhoodSignal {
  if (typeof raw !== "object" || raw === null) {
    throw new EngineError(
      "INVALID_NEIGHBORHOOD_SIGNAL",
      `signal for component "${componentId}" domain "${domain}" must be an object`
    );
  }
  const record = raw as Record<string, unknown>;
  const parsed = signalKeySchema.safeParse({ entityId: record.entityId, rank: record.rank });
  if (!parsed.success) {
    throw new EngineError(
      "INVALID_NEIGHBORHOOD_SIGNAL",
      signalErrorMessage(
        `signal for component "${componentId}" domain "${domain}" is invalid`,
        parsed.error
      )
    );
  }
  const affinity = record.affinity;
  if (affinity !== undefined && typeof affinity !== "number") {
    throw new EngineError(
      "INVALID_NEIGHBORHOOD_SIGNAL",
      `signal for component "${componentId}" domain "${domain}" has non-numeric affinity`
    );
  }
  const rawName = record.name;
  if (rawName !== undefined && typeof rawName !== "string") {
    throw new EngineError(
      "INVALID_NEIGHBORHOOD_SIGNAL",
      `signal for component "${componentId}" domain "${domain}" has non-string name`
    );
  }
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 200) : "";
  return {
    entityId: parsed.data.entityId,
    rank: parsed.data.rank,
    affinity,
    ...(name !== "" ? { name } : {})
  };
}

function buildDomainEntries(
  rawSignals: readonly unknown[],
  componentId: string,
  domain: NeighborhoodDomain
): NeighborhoodEntry[] {
  const weighted = rawSignals.map((raw) => {
    const signal = parseSignal(raw, componentId, domain);
    const { weight, affinityUsed } = signalWeight(signal.affinity, signal.rank);
    return {
      entityId: signal.entityId,
      rank: signal.rank,
      weight,
      affinityUsed,
      ...(signal.name !== undefined ? { name: signal.name } : {})
    };
  });
  weighted.sort((left, right) => {
    if (left.weight !== right.weight) {
      return right.weight - left.weight;
    }
    return left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0;
  });
  const deduped: typeof weighted = [];
  const seen = new Set<string>();
  for (const entry of weighted) {
    if (seen.has(entry.entityId)) {
      continue;
    }
    seen.add(entry.entityId);
    deduped.push(entry);
  }
  const capped = deduped.slice(0, NEIGHBORHOOD_CAP);
  if (capped.length === 0) {
    return [];
  }
  const total = capped.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return [];
  }
  return capped.map((entry) => ({
    ...entry,
    weight: entry.weight / total
  }));
}

function neighborhoodState(domains: TasteNeighborhood["domains"]): TasteNeighborhood["state"] {
  const filled = neighborhoodDomains.filter((domain) => domains[domain].length > 0).length;
  if (filled === 0) {
    return "not measured";
  }
  if (filled === neighborhoodDomains.length) {
    return "measured";
  }
  return "incomplete";
}

export function buildNeighborhoods(
  components: readonly CandidateComponent[],
  inputs: readonly NeighborhoodSignalInput[]
): TasteNeighborhood[] {
  const componentIds = new Set<string>();
  for (const component of components) {
    if (componentIds.has(component.id)) {
      throw new EngineError("INVALID_COMPONENT", `duplicate component id "${component.id}"`);
    }
    componentIds.add(component.id);
  }
  const byComponent = new Map<string, Map<NeighborhoodDomain, readonly unknown[]>>();
  for (const input of inputs) {
    if (!componentIds.has(input.componentId)) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `signal input references unknown component "${input.componentId}"`
      );
    }
    if (!neighborhoodDomains.includes(input.domain)) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `unknown neighborhood domain "${String(input.domain)}"`
      );
    }
    const domainMap = byComponent.get(input.componentId) ?? new Map<NeighborhoodDomain, readonly unknown[]>();
    if (domainMap.has(input.domain)) {
      throw new EngineError(
        "INVALID_NEIGHBORHOOD_SIGNAL",
        `duplicate signal input for component "${input.componentId}" domain "${input.domain}"`
      );
    }
    domainMap.set(input.domain, input.signals ?? []);
    byComponent.set(input.componentId, domainMap);
  }
  const sortedComponents = [...components].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  return sortedComponents.map((component) => {
    const domainMap = byComponent.get(component.id) ?? new Map<NeighborhoodDomain, readonly unknown[]>();
    const domains = {
      artist: buildDomainEntries(domainMap.get("artist") ?? [], component.id, "artist"),
      movie: buildDomainEntries(domainMap.get("movie") ?? [], component.id, "movie"),
      brand: buildDomainEntries(domainMap.get("brand") ?? [], component.id, "brand")
    };
    return { componentId: component.id, domains, state: neighborhoodState(domains) };
  });
}
