import {
  asNumber,
  asRecord,
  asString,
  asStringArray,
  upstreamResults
} from "./transport.js";
import type {
  ProjectedCandidate,
  ProjectedCompareResults,
  ProjectedEntity,
  ProjectedEntityExplainabilityEntry,
  ProjectedHeatmapCell,
  ProjectedHoursSlot,
  ProjectedResolution,
  ProjectedTag,
  QlooCapabilitiesResult
} from "./types.js";

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function normalizeEntityType(value: unknown): string | undefined {
  const raw = asString(value);
  if (raw === undefined) {
    return undefined;
  }
  return raw.startsWith("urn:entity:") ? raw.slice("urn:entity:".length) : raw;
}

function firstUrnType(value: unknown): string | undefined {
  if (typeof value === "string") {
    return normalizeEntityType(value);
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  for (const entry of value) {
    if (typeof entry === "string" && entry.startsWith("urn:entity:")) {
      return normalizeEntityType(entry);
    }
  }
  for (const entry of value) {
    const normalized = normalizeEntityType(entry);
    if (normalized !== undefined) {
      return normalized;
    }
  }
  return undefined;
}

function addressText(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct !== undefined) {
    return direct;
  }
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  return (
    asString(record.formatted) ??
    asString(record.formatted_address) ??
    asString(record.display_name) ??
    asString(record.name)
  );
}

function imageHref(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct !== undefined) {
    return direct;
  }
  return asString(asRecord(value)?.url);
}

function projectHours(value: unknown): Record<string, ProjectedHoursSlot[]> | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const days: Record<string, ProjectedHoursSlot[]> = {};
  for (const [day, entry] of Object.entries(record)) {
    if (entry === null || entry === false) {
      days[day] = [{ closed: true }];
      continue;
    }
    if (!Array.isArray(entry)) {
      continue;
    }
    const slots: ProjectedHoursSlot[] = [];
    for (const rawSlot of entry) {
      const slotRecord = asRecord(rawSlot);
      if (slotRecord === undefined) {
        continue;
      }
      const opens = asString(slotRecord.opens) ?? asString(slotRecord.open);
      const closes = asString(slotRecord.closes) ?? asString(slotRecord.close);
      const closed = typeof slotRecord.closed === "boolean" ? slotRecord.closed : undefined;
      if (opens === undefined && closes === undefined && closed === undefined) {
        continue;
      }
      slots.push({
        ...(opens !== undefined ? { opens } : {}),
        ...(closes !== undefined ? { closes } : {}),
        ...(closed !== undefined ? { closed } : {})
      });
    }
    if (slots.length > 0) {
      days[day] = slots;
    }
  }
  return Object.keys(days).length > 0 ? days : undefined;
}

function projectMeasurements(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const measurements: Record<string, number> = {};
  for (const [name, entry] of Object.entries(record)) {
    const numeric = asNumber(entry);
    if (numeric !== undefined) {
      measurements[name] = numeric;
    }
  }
  return Object.keys(measurements).length > 0 ? measurements : undefined;
}

function projectExplainability(
  value: unknown
): Record<string, ProjectedEntityExplainabilityEntry[]> | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const explainability: Record<string, ProjectedEntityExplainabilityEntry[]> = {};
  for (const [entityId, entry] of Object.entries(record)) {
    if (!Array.isArray(entry)) {
      continue;
    }
    const rows: ProjectedEntityExplainabilityEntry[] = [];
    for (const raw of entry) {
      const row = asRecord(raw);
      if (row === undefined) {
        continue;
      }
      const score = asNumber(row.score) ?? asNumber(row.affinity) ?? asNumber(row.value);
      if (score === undefined) {
        continue;
      }
      rows.push({ entityId: asString(row.entityId) ?? asString(row.entity_id) ?? entityId, score });
    }
    if (rows.length > 0) {
      explainability[entityId] = rows;
    }
  }
  return Object.keys(explainability).length > 0 ? explainability : undefined;
}

function locationOf(record: Record<string, unknown>, properties: Record<string, unknown>): ProjectedEntity["location"] {
  const location = asRecord(record.location);
  const geocode = asRecord(properties.geocode) ?? asRecord(record.geocode);
  const lat = asNumber(location?.lat) ?? asNumber(location?.latitude) ?? asNumber(geocode?.latitude);
  const lon = asNumber(location?.lon) ?? asNumber(location?.longitude) ?? asNumber(geocode?.longitude);
  if (lat === undefined || lon === undefined) {
    return undefined;
  }
  const geohash = asString(location?.geohash) ?? asString(geocode?.geohash);
  return { lat, lon, ...(geohash !== undefined ? { geohash } : {}) };
}

export function projectEntity(value: unknown): ProjectedEntity | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const entityId = asString(record.entity_id) ?? asString(record.id);
  if (entityId === undefined) {
    return undefined;
  }
  const properties = asRecord(record.properties) ?? {};
  const query = asRecord(record.query) ?? {};
  const entity: ProjectedEntity = { entityId };

  const name = asString(record.name);
  if (name !== undefined) {
    entity.name = name;
  }
  const type = normalizeEntityType(record.type) ?? firstUrnType(record.types);
  if (type !== undefined) {
    entity.type = type;
  }
  const subtype = asString(record.subtype);
  if (subtype !== undefined) {
    entity.subtype = subtype;
  }
  const affinity = asNumber(record.affinity) ?? asNumber(query.affinity);
  if (affinity !== undefined) {
    entity.affinity = affinity;
  }
  const popularity = asNumber(record.popularity);
  if (popularity !== undefined) {
    entity.popularity = popularity;
  }
  const distance = asNumber(record.distance_meters) ?? asNumber(record.distance);
  if (distance !== undefined) {
    entity.distanceMeters = distance;
  }
  const location = locationOf(record, properties);
  if (location !== undefined) {
    entity.location = location;
  }
  const address = addressText(record.address) ?? addressText(properties.address);
  if (address !== undefined) {
    entity.address = truncate(address, 300);
  }
  const city = asString(record.city) ?? asString(properties.city);
  if (city !== undefined) {
    entity.city = city;
  }
  const admin1Region =
    asString(record.admin1_region) ??
    asString(properties.admin1_region) ??
    asString(record.region) ??
    asString(properties.region);
  if (admin1Region !== undefined) {
    entity.admin1Region = admin1Region;
  }
  const country = asString(record.country) ?? asString(properties.country) ?? asString(asRecord(properties.geocode)?.country);
  if (country !== undefined) {
    entity.country = country;
  }
  const imageUrl = imageHref(properties.image) ?? asString(record.image_url) ?? imageHref(record.image);
  if (imageUrl !== undefined) {
    entity.imageUrl = imageUrl;
  }
  const description =
    asString(properties.description) ?? asString(properties.short_description) ?? asString(record.description);
  if (description !== undefined) {
    entity.description = truncate(description, 500);
  }
  const businessRating = asNumber(properties.business_rating) ?? asNumber(record.business_rating);
  if (businessRating !== undefined) {
    entity.businessRating = businessRating;
  }
  const priceLevel = properties.price_level ?? record.price_level;
  if (priceLevel === null || typeof priceLevel === "number") {
    entity.priceLevel = priceLevel;
  }
  const hours = projectHours(properties.hours ?? record.hours);
  if (hours !== undefined) {
    entity.hours = hours;
  }
  const tags = projectTags(record.tags ?? properties.tags);
  if (tags.length > 0) {
    entity.tags = tags;
  }
  const measurements = projectMeasurements(query.measurements);
  if (measurements !== undefined) {
    entity.measurements = measurements;
  }
  const explainability = projectExplainability(query.explainability ?? record.explainability);
  if (explainability !== undefined) {
    entity.explainability = explainability;
  }
  return entity;
}

export function projectEntities(payload: unknown): ProjectedEntity[] {
  const entities: ProjectedEntity[] = [];
  for (const entry of Array.isArray(payload) ? payload : upstreamResults(payload, "entities")) {
    const entity = projectEntity(entry);
    if (entity !== undefined) {
      entities.push(entity);
    }
  }
  return entities;
}

export function projectTag(value: unknown): ProjectedTag | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const id = asString(record.id) ?? asString(record.tag_id);
  if (id === undefined) {
    return undefined;
  }
  const query = asRecord(record.query) ?? {};
  const tag: ProjectedTag = { id };
  const name = asString(record.name);
  if (name !== undefined) {
    tag.name = name;
  }
  const type = asString(record.type) ?? asString(record.subtype);
  if (type !== undefined) {
    tag.type = type;
  }
  const popularity = asNumber(record.popularity);
  if (popularity !== undefined) {
    tag.popularity = popularity;
  }
  const score =
    asNumber(record.score) ?? asNumber(record.affinity) ?? asNumber(query.affinity) ?? asNumber(record.value);
  if (score !== undefined) {
    tag.score = score;
  }
  return tag;
}

export function projectTags(payload: unknown): ProjectedTag[] {
  const tags: ProjectedTag[] = [];
  for (const entry of Array.isArray(payload) ? payload : upstreamResults(payload, "tags")) {
    const tag = projectTag(entry);
    if (tag !== undefined) {
      tags.push(tag);
    }
  }
  return tags;
}

export function projectHeatmapCells(payload: unknown): ProjectedHeatmapCell[] {
  const cells: ProjectedHeatmapCell[] = [];
  for (const entry of Array.isArray(payload) ? payload : upstreamResults(payload, "heatmap")) {
    const record = asRecord(entry);
    if (record === undefined) {
      continue;
    }
    const query = asRecord(record.query) ?? {};
    const latitude = asNumber(record.latitude) ?? asNumber(record.lat);
    const longitude = asNumber(record.longitude) ?? asNumber(record.lon) ?? asNumber(record.lng);
    if (latitude === undefined || longitude === undefined) {
      continue;
    }
    const cell: ProjectedHeatmapCell = { latitude, longitude };
    const geohash = asString(record.geohash) ?? asString(query.geohash);
    if (geohash !== undefined) {
      cell.geohash = geohash;
    }
    const affinity = asNumber(record.affinity) ?? asNumber(query.affinity);
    if (affinity !== undefined) {
      cell.affinity = affinity;
    }
    const affinityRank = asNumber(record.affinity_rank) ?? asNumber(query.affinity_rank) ?? asNumber(record.rank);
    if (affinityRank !== undefined) {
      cell.affinityRank = affinityRank;
    }
    const popularity = asNumber(record.popularity);
    if (popularity !== undefined) {
      cell.popularity = popularity;
    }
    const entityPlaceAffinity =
      asNumber(record.entity_place_affinity) ?? asNumber(query.entity_place_affinity);
    if (entityPlaceAffinity !== undefined) {
      cell.entityPlaceAffinity = entityPlaceAffinity;
    }
    const entityPlaceAffinityRank =
      asNumber(record.entity_place_affinity_rank) ?? asNumber(query.entity_place_affinity_rank);
    if (entityPlaceAffinityRank !== undefined) {
      cell.entityPlaceAffinityRank = entityPlaceAffinityRank;
    }
    cells.push(cell);
  }
  return cells;
}

function projectCandidate(value: unknown): ProjectedCandidate | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const id = asString(record.id) ?? asString(record.entity_id) ?? asString(record.tag_id);
  if (id === undefined) {
    return undefined;
  }
  const candidate: ProjectedCandidate = { id };
  const name = asString(record.name);
  if (name !== undefined) {
    candidate.name = name;
  }
  const type = asString(record.type);
  if (type !== undefined) {
    candidate.type = type;
  }
  const popularity = asNumber(record.popularity);
  if (popularity !== undefined) {
    candidate.popularity = popularity;
  }
  const description = asString(record.description);
  if (description !== undefined) {
    candidate.description = truncate(description, 500);
  }
  const address = addressText(record.address);
  if (address !== undefined) {
    candidate.address = truncate(address, 300);
  }
  return candidate;
}

function projectCandidates(value: unknown): ProjectedCandidate[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const candidates = value
    .map((entry) => projectCandidate(entry))
    .filter((entry): entry is ProjectedCandidate => entry !== undefined);
  return candidates.length > 0 ? candidates : undefined;
}

export function projectResolution(value: unknown): ProjectedResolution | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const resolution: ProjectedResolution = {};
  if (Array.isArray(record.issues)) {
    const issues = record.issues
      .map((raw) => {
        const issue = asRecord(raw);
        if (issue === undefined) {
          return undefined;
        }
        const input = asString(issue.input);
        const kind = asString(issue.kind) ?? asString(issue.status);
        const field = asString(issue.field) ?? asString(issue.input_kind);
        const candidates = projectCandidates(issue.candidates);
        if (input === undefined && kind === undefined && field === undefined && candidates === undefined) {
          return undefined;
        }
        return {
          ...(input !== undefined ? { input } : {}),
          ...(kind !== undefined ? { kind } : {}),
          ...(field !== undefined ? { field } : {}),
          ...(candidates !== undefined ? { candidates } : {})
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    if (issues.length > 0) {
      resolution.issues = issues;
    }
  }
  if (Array.isArray(record.outcomes)) {
    const outcomes = record.outcomes
      .map((raw) => {
        const outcome = asRecord(raw);
        if (outcome === undefined) {
          return undefined;
        }
        const input = asString(outcome.input);
        const status = asString(outcome.status);
        const match = asString(outcome.match);
        const selected = projectCandidate(outcome.selected);
        if (input === undefined && status === undefined && match === undefined && selected === undefined) {
          return undefined;
        }
        return {
          ...(input !== undefined ? { input } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(match !== undefined ? { match } : {}),
          ...(selected !== undefined ? { selected } : {})
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    if (outcomes.length > 0) {
      resolution.outcomes = outcomes;
    }
  }
  return resolution.issues !== undefined || resolution.outcomes !== undefined ? resolution : undefined;
}

const COMPARE_GROUP_KEYS = ["a", "group_a", "audience_a", "a_entities"] as const;
const COMPARE_MATCH_KEYS = ["matchEntities", "match_entities", "matches", "entities"] as const;

function projectComparableGroup(value: unknown): { tags: ProjectedTag[]; entities: ProjectedEntity[] } {
  if (Array.isArray(value)) {
    const entities: ProjectedEntity[] = [];
    const tags: ProjectedTag[] = [];
    for (const entry of value) {
      const record = asRecord(entry);
      if (record === undefined) {
        continue;
      }
      if (asString(record.entity_id) !== undefined) {
        const entity = projectEntity(record);
        if (entity !== undefined) {
          entities.push(entity);
        }
      } else {
        const tag = projectTag(record);
        if (tag !== undefined) {
          tags.push(tag);
        }
      }
    }
    return { tags, entities };
  }
  return { tags: projectTags(value), entities: projectEntities(value) };
}

export function projectCompareResults(payload: unknown): ProjectedCompareResults {
  const record = asRecord(payload);
  const groups = record === undefined ? undefined : record.results !== undefined ? asRecord(record.results) : record;
  const projected: ProjectedCompareResults = { tags: [], a: [], b: [], matchEntities: [] };
  if (Array.isArray(payload)) {
    const matched = projectComparableGroup(payload);
    projected.matchEntities = matched.entities;
    projected.tags = matched.tags;
    return projected;
  }
  if (groups === undefined) {
    return projected;
  }
  projected.tags = projectTags(groups.tags);
  const groupA = COMPARE_GROUP_KEYS.map((key) => groups[key]).find((value) => value !== undefined);
  const groupB = (["b", "group_b", "audience_b", "b_entities"] as const)
    .map((key) => groups[key])
    .find((value) => value !== undefined);
  const matches = COMPARE_MATCH_KEYS.map((key) => groups[key]).find((value) => value !== undefined);
  if (groupA !== undefined) {
    projected.a = projectTags(groupA);
  }
  if (groupB !== undefined) {
    projected.b = projectTags(groupB);
  }
  if (matches !== undefined) {
    const matched = projectComparableGroup(matches);
    projected.matchEntities = matched.entities;
    projected.tags = [...projected.tags, ...matched.tags];
  }
  return projected;
}

export interface ProjectedCapabilities {
  ready?: boolean;
  contractVersion?: string;
  contractChecksum?: string;
  contractChecksumChanged?: boolean;
  compatibility?: string;
  supportedOperationIds?: string[];
}

export function projectCapabilities(payload: unknown): ProjectedCapabilities {
  const record = asRecord(payload);
  if (record === undefined) {
    return {};
  }
  const adapter = asRecord(record.adapter);
  const projected: ProjectedCapabilities = {};
  const contractVersion = asString(record.contract_version);
  if (contractVersion !== undefined) {
    projected.contractVersion = contractVersion;
  }
  const contractChecksum = asString(record.contract_checksum);
  if (contractChecksum !== undefined) {
    projected.contractChecksum = contractChecksum;
  }
  const ready = typeof record.ready === "boolean" ? record.ready : typeof adapter?.ready === "boolean" ? adapter.ready : undefined;
  if (ready !== undefined) {
    projected.ready = ready;
  }
  const compatibility = asString(adapter?.compatibility);
  if (compatibility !== undefined) {
    projected.compatibility = compatibility;
  }
  const supported = asStringArray(adapter?.supported_operation_ids) ?? asStringArray(record.supported_operation_ids);
  if (supported !== undefined) {
    projected.supportedOperationIds = supported;
  }
  return projected;
}

export function capabilitiesResult(
  transport: QlooCapabilitiesResult["transport"],
  endpoint: string,
  projected: ProjectedCapabilities,
  contractChecksumChanged: boolean | undefined
): QlooCapabilitiesResult {
  const ready = projected.ready ?? transport === "rest";
  const result: QlooCapabilitiesResult = { transport, endpoint, ready };
  if (projected.contractVersion !== undefined) {
    result.contractVersion = projected.contractVersion;
  }
  if (projected.contractChecksum !== undefined) {
    result.contractChecksum = projected.contractChecksum;
  }
  if (contractChecksumChanged ?? projected.contractChecksumChanged) {
    result.contractChecksumChanged = true;
  }
  if (projected.compatibility !== undefined) {
    result.compatibility = projected.compatibility;
  }
  if (projected.supportedOperationIds !== undefined) {
    result.supportedOperationIds = projected.supportedOperationIds;
  }
  return result;
}
