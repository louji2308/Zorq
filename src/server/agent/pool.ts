import { z } from "zod";
import { candidateComponentSchema, validatePool, type CandidateComponent } from "../engine/index.js";
import type { QlooEnvelope } from "../qloo/index.js";
import type { CandidatePool, SiteHeatCell, SiteRead } from "../../shared/run.js";
import { siteAnchorLetters } from "../../shared/run.js";
import { AgentToolError } from "./errors.js";
import type { LlmToolDefinition } from "./llm.js";

export const PROPOSE_CANDIDATE_POOL_TOOL = "propose_candidate_pool";

export const POOL_EVENT_LABEL = "agent.candidate_pool";

export const POOL_DRAFT_COMPONENT_CAP = 10;

export const SITE_READ_ANCHOR_CAP = 5;

export const SITE_READ_HEAT_CAP = 200;

const poolDraftSchema = z.object({
  components: z.array(z.unknown()).min(1).max(POOL_DRAFT_COMPONENT_CAP)
});

const toolParametersSchema = z.object({
  components: z.array(candidateComponentSchema).min(1).max(POOL_DRAFT_COMPONENT_CAP)
});

const toolParametersJson = z.toJSONSchema(toolParametersSchema) as Record<string, unknown>;
delete toolParametersJson.$schema;

export const proposeCandidatePoolTool: LlmToolDefinition = {
  name: PROPOSE_CANDIDATE_POOL_TOOL,
  description:
    "Propose the candidate pool for this run: 1 to " +
    String(POOL_DRAFT_COMPONENT_CAP) +
    " components (the design target is about 8 to 10 when the evidence supports it; propose fewer when the evidence is honestly thin), each with a role (Anchor, Social, Discovery, Experience, Night, Community), tags, 1-5 exemplars (id + name), a provenance path (anchorPlace, qlooSignal, resolvedCategory, exemplarSet, tasteNeighborhood) and an evidenceState (measured, not measured, incomplete, unavailable). Call this once, as your last action, only after you have gathered real observations. Every exemplar must be an entity you actually saw in a tool result, with the same id and the same name, and every tag must be a tag you actually saw (from qloo_resolve_tags or on an observed entity). The draft is validated by the deterministic engine; a rejected draft is returned to you as an error and is never repaired into lookalike data.",
  parameters: toolParametersJson
};

export interface ObservedEntity {
  entityId: string;
  name: string | null;
  location: { lat: number; lon: number } | null;
  evidenceId: string;
}

export interface ObservationIndex {
  record(envelope: QlooEnvelope<unknown>, evidenceId: string): void;
  entity(id: string): ObservedEntity | undefined;
  hasTag(key: string): boolean;
  locatedEntities(): ObservedEntity[];
  heatCells(): SiteHeatCell[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readEntity(value: unknown): Omit<ObservedEntity, "evidenceId"> | null {
  if (!isRecord(value)) {
    return null;
  }
  const entityId = readString(value.entityId);
  if (entityId === null) {
    return null;
  }
  const location =
    isRecord(value.location) &&
    finiteInRange(value.location.lat, -90, 90) &&
    finiteInRange(value.location.lon, -180, 180)
      ? { lat: value.location.lat, lon: value.location.lon }
      : null;
  return { entityId, name: readString(value.name), location };
}

function readTagKeys(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  const keys: string[] = [];
  const id = readString(value.id);
  if (id !== null) {
    keys.push(id.toLowerCase());
  }
  const name = readString(value.name);
  if (name !== null) {
    keys.push(name.toLowerCase());
  }
  return keys;
}

function readHeatCell(value: unknown): SiteHeatCell | null {
  if (!isRecord(value)) {
    return null;
  }
  const lat = value.latitude;
  const lon = value.longitude;
  if (!finiteInRange(lat, -90, 90) || !finiteInRange(lon, -180, 180)) {
    return null;
  }
  const affinity = value.affinity;
  const fallback = value.entityPlaceAffinity;
  const weight = finiteInRange(affinity, 0, 100)
    ? affinity
    : finiteInRange(fallback, 0, 100)
      ? fallback
      : null;
  if (weight === null) {
    return null;
  }
  return { lat, lon, weight };
}

export function createObservationIndex(): ObservationIndex {
  const entities = new Map<string, ObservedEntity>();
  const located: ObservedEntity[] = [];
  const tagKeys = new Set<string>();
  const heat: SiteHeatCell[] = [];

  return {
    record(envelope, evidenceId) {
      if (!isRecord(envelope.results)) {
        return;
      }
      const results = envelope.results;
      const rawEntities: unknown[] = [];
      if (Array.isArray(results.entities)) {
        rawEntities.push(...results.entities);
      }
      if (Array.isArray(results.matchEntities)) {
        rawEntities.push(...results.matchEntities);
      }
      for (const raw of rawEntities) {
        const entity = readEntity(raw);
        if (entity === null || entities.has(entity.entityId)) {
          continue;
        }
        const observed: ObservedEntity = { ...entity, evidenceId };
        entities.set(observed.entityId, observed);
        if (observed.location !== null) {
          located.push(observed);
        }
      }

      const rawTags: unknown[] = [];
      if (Array.isArray(results.tags)) {
        rawTags.push(...results.tags);
      }
      if (Array.isArray(results.a)) {
        rawTags.push(...results.a);
      }
      if (Array.isArray(results.b)) {
        rawTags.push(...results.b);
      }
      for (const raw of rawEntities) {
        if (isRecord(raw) && Array.isArray(raw.tags)) {
          rawTags.push(...raw.tags);
        }
      }
      for (const raw of rawTags) {
        for (const key of readTagKeys(raw)) {
          tagKeys.add(key);
        }
      }

      if (Array.isArray(results.heatmap)) {
        for (const raw of results.heatmap) {
          if (heat.length >= SITE_READ_HEAT_CAP) {
            break;
          }
          const cell = readHeatCell(raw);
          if (cell !== null) {
            heat.push(cell);
          }
        }
      }
    },
    entity(id) {
      return entities.get(id);
    },
    hasTag(key) {
      return tagKeys.has(key.trim().toLowerCase());
    },
    locatedEntities() {
      return [...located];
    },
    heatCells() {
      return [...heat];
    }
  };
}

export function deriveSiteRead(index: ObservationIndex): SiteRead | undefined {
  const located = index.locatedEntities().slice(0, SITE_READ_ANCHOR_CAP);
  const anchors = located.flatMap((entity, position) => {
    if (entity.location === null) {
      return [];
    }
    return [
      {
        id: entity.entityId,
        label: entity.name ?? entity.entityId,
        letter: siteAnchorLetters[position],
        lat: entity.location.lat,
        lon: entity.location.lon,
        evidenceId: entity.evidenceId
      }
    ];
  });
  const heat = index.heatCells();
  if (anchors.length === 0 && heat.length === 0) {
    return undefined;
  }
  return {
    ...(anchors.length > 0 ? { anchors } : {}),
    ...(heat.length > 0 ? { heat } : {})
  };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function reject(message: string): never {
  throw new AgentToolError("invalid_arguments", PROPOSE_CANDIDATE_POOL_TOOL, message);
}

export function formCandidatePool(input: {
  draft: unknown;
  index: ObservationIndex;
}): CandidatePool {
  const draft = poolDraftSchema.safeParse(input.draft);
  if (!draft.success) {
    reject(`candidate pool draft is invalid: ${describeIssues(draft.error)}`);
  }
  let pool: CandidateComponent[];
  try {
    pool = validatePool(draft.data.components);
  } catch (error) {
    reject(
      `candidate pool failed engine validation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  for (const component of pool) {
    for (const exemplar of component.exemplars) {
      const observed = input.index.entity(exemplar.id);
      if (observed === undefined) {
        reject(
          `component "${component.id}" cites exemplar "${exemplar.name}" (${exemplar.id}) that was never observed in a tool result; only entities you actually saw may be used`
        );
      }
      if (observed.name === null || observed.name.toLowerCase() !== exemplar.name.toLowerCase()) {
        reject(
          `component "${component.id}" cites exemplar name "${exemplar.name}" for ${exemplar.id} but the observed name is "${observed.name ?? "unnamed"}"; copy the observed name exactly`
        );
      }
    }
    for (const tag of component.tags) {
      if (!input.index.hasTag(tag)) {
        reject(
          `component "${component.id}" cites tag "${tag}" that was never observed; resolve it with qloo_resolve_tags or cite a tag you saw on an observed entity`
        );
      }
    }
  }
  return pool;
}

export function poolFormationSummary(pool: CandidatePool): string {
  return `candidate pool accepted: ${pool.length} component(s) grounded in observed entities and tags, validated by the engine`;
}

export function poolRejectionSummary(message: string): string {
  return `candidate pool rejected: ${message}`;
}
