import { z } from "zod";

export const qlooOperations = [
  "capabilities",
  "search",
  "resolveTags",
  "insights",
  "describe",
  "bridge",
  "replace",
  "triangulate"
] as const;

export type QlooOperation = (typeof qlooOperations)[number];

export const qlooTransportKinds = ["mcp", "rest"] as const;

export type QlooTransportKind = (typeof qlooTransportKinds)[number];

export const qlooTransportSelections = ["auto", "mcp", "rest"] as const;

export type QlooTransportSelection = (typeof qlooTransportSelections)[number];

export const qlooEnvelopeStatuses = ["ok", "empty", "needs_input", "partial", "degraded"] as const;

export type QlooEnvelopeStatus = (typeof qlooEnvelopeStatuses)[number];

export const insightsEntityTypes = [
  "artist",
  "book",
  "brand",
  "destination",
  "movie",
  "person",
  "place",
  "podcast",
  "tv_show",
  "videogame"
] as const;

export type InsightsEntityType = (typeof insightsEntityTypes)[number];

export const insightsFilterTypes = [...insightsEntityTypes, "heatmap"] as const;

export type InsightsFilterType = (typeof insightsFilterTypes)[number];

export const mcpTargetTypes = [
  "artist",
  "book",
  "brand",
  "movie",
  "person",
  "place",
  "podcast",
  "tv_show",
  "videogame"
] as const;

export type McpTargetType = (typeof mcpTargetTypes)[number];

export const searchEntityTypes = [
  ...insightsEntityTypes,
  "locality",
  "actor",
  "album",
  "author",
  "director"
] as const;

export type SearchEntityType = (typeof searchEntityTypes)[number];

export const describeEntityTypes = searchEntityTypes;

export type DescribeEntityType = SearchEntityType;

export function insightsTypeUrn(type: InsightsFilterType): string {
  return type === "heatmap" ? "urn:heatmap" : `urn:entity:${type}`;
}

export function searchTypeUrn(type: SearchEntityType): string {
  return `urn:entity:${type}`;
}

export const entityPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180)
});

export type EntityPoint = z.infer<typeof entityPointSchema>;

export const locationFilterSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    point: entityPointSchema.optional(),
    radiusM: z.number().int().min(0).max(100000).optional()
  })
  .refine((value) => value.query !== undefined || value.point !== undefined, {
    message: "location requires query or point"
  });

export type LocationFilter = z.infer<typeof locationFilterSchema>;

export const entityQueryTermSchema = z.union([
  z.string().trim().min(1).max(200),
  z.object({
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().min(1).max(300).optional()
  })
]);

export type EntityQueryTerm = z.infer<typeof entityQueryTermSchema>;

const shortStringList = z.array(z.string().trim().min(1).max(200)).min(1).max(10);
const tagStringList = z.array(z.string().trim().min(1).max(300)).min(1).max(10);

export const insightsRequestSchema = z.object({
  filterType: z.enum(insightsFilterTypes),
  signalEntities: shortStringList.optional(),
  signalEntitiesQuery: z.array(entityQueryTermSchema).min(1).max(10).optional(),
  signalTags: tagStringList.optional(),
  signalLocation: z.string().trim().min(1).max(200).optional(),
  excludeEntities: shortStringList.optional(),
  excludeEntitiesQuery: z.array(entityQueryTermSchema).min(1).max(10).optional(),
  excludeTags: tagStringList.optional(),
  filterEntities: shortStringList.optional(),
  filterTags: tagStringList.optional(),
  location: locationFilterSchema.optional(),
  popularityMin: z.number().min(0).max(1).optional(),
  popularityMax: z.number().min(0).max(1).optional(),
  explainability: z.boolean().optional(),
  take: z.number().int().min(1).max(50).optional(),
  page: z.number().int().min(1).max(100).optional()
});

export type InsightsRequest = z.infer<typeof insightsRequestSchema>;

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  types: z.array(z.enum(searchEntityTypes)).min(1).max(8).optional(),
  take: z.number().int().min(1).max(50).optional()
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const resolveTagsRequestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  take: z.number().int().min(1).max(20).optional()
});

export type ResolveTagsRequest = z.infer<typeof resolveTagsRequestSchema>;

export const describeRequestSchema = z.object({
  entity: z.string().trim().min(1).max(200),
  type: z.enum(describeEntityTypes).optional()
});

export type DescribeRequest = z.infer<typeof describeRequestSchema>;

export const bridgeRequestSchema = z.object({
  targetType: z.enum(insightsEntityTypes),
  signals: shortStringList.optional(),
  signalTags: tagStringList.optional(),
  signalLocation: z.string().trim().min(1).max(200).optional(),
  filterLocation: z.string().trim().min(1).max(200).optional(),
  demographic: z.string().trim().min(1).max(200).optional(),
  includeTags: tagStringList.optional(),
  excludeTags: tagStringList.optional(),
  limit: z.number().int().min(1).max(20).optional()
});

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export const replaceRequestSchema = z.object({
  options: shortStringList,
  optionType: z.enum(insightsEntityTypes),
  signals: shortStringList.optional(),
  signalLocation: z.string().trim().min(1).max(200).optional(),
  demographic: z.string().trim().min(1).max(200).optional(),
  includeTags: tagStringList.optional(),
  excludeTags: tagStringList.optional()
});

export type ReplaceRequest = z.infer<typeof replaceRequestSchema>;

export const triangulateRequestSchema = z.object({
  groupA: shortStringList,
  groupB: shortStringList,
  targetType: z.enum(insightsEntityTypes).optional(),
  limit: z.number().int().min(1).max(20).optional()
});

export type TriangulateRequest = z.infer<typeof triangulateRequestSchema>;

export const qlooCallOptionsSchema = z.object({
  transport: z.enum(qlooTransportSelections).optional()
});

export type QlooCallOptions = z.infer<typeof qlooCallOptionsSchema>;

export interface ProjectedTag {
  id: string;
  name?: string;
  type?: string;
  popularity?: number;
  score?: number;
}

export interface ProjectedHoursSlot {
  opens?: string | null;
  closes?: string | null;
  closed?: boolean;
}

export interface ProjectedEntityExplainabilityEntry {
  entityId: string;
  score: number;
}

export interface ProjectedEntity {
  entityId: string;
  name?: string;
  type?: string;
  subtype?: string;
  affinity?: number;
  popularity?: number;
  distanceMeters?: number;
  location?: { lat: number; lon: number; geohash?: string };
  address?: string;
  city?: string;
  admin1Region?: string;
  country?: string;
  imageUrl?: string;
  description?: string;
  businessRating?: number;
  priceLevel?: number | null;
  hours?: Record<string, ProjectedHoursSlot[]>;
  tags?: ProjectedTag[];
  measurements?: Record<string, number>;
  explainability?: Record<string, ProjectedEntityExplainabilityEntry[]>;
}

export interface ProjectedHeatmapCell {
  latitude: number;
  longitude: number;
  geohash?: string;
  affinity?: number;
  affinityRank?: number;
  popularity?: number;
  entityPlaceAffinity?: number;
  entityPlaceAffinityRank?: number;
}

export interface ProjectedCompareResults {
  tags: ProjectedTag[];
  a: ProjectedTag[];
  b: ProjectedTag[];
  matchEntities: ProjectedEntity[];
}

export interface ProjectedCandidate {
  id: string;
  name?: string;
  type?: string;
  popularity?: number;
  description?: string;
  address?: string;
}

export interface ProjectedResolution {
  issues?: Array<{ input?: string; kind?: string; field?: string; candidates?: ProjectedCandidate[] }>;
  outcomes?: Array<{ input?: string; status?: string; match?: string; selected?: ProjectedCandidate }>;
}

export interface QlooEntityResults {
  entities: ProjectedEntity[];
}

export interface QlooTagResults {
  tags: ProjectedTag[];
}

export interface QlooInsightsResults {
  entities?: ProjectedEntity[];
  heatmap?: ProjectedHeatmapCell[];
}

export interface QlooCapabilitiesResult {
  transport: QlooTransportKind;
  endpoint: string;
  ready: boolean;
  contractVersion?: string;
  contractChecksum?: string;
  contractChecksumChanged?: boolean;
  compatibility?: string;
  supportedOperationIds?: string[];
}

export interface QlooProvenanceRequest {
  method: "GET" | "POST";
  path: string;
  params?: Record<string, unknown>;
}

export interface QlooProvenance {
  transport: QlooTransportKind;
  operation: QlooOperation;
  endpoint: string;
  durationMs: number;
  correlationId?: string;
  contractChecksum?: string;
  contractChecksumChanged?: boolean;
  requests?: QlooProvenanceRequest[];
}

export interface QlooEnvelope<R> {
  status: QlooEnvelopeStatus;
  operation: QlooOperation;
  transport: QlooTransportKind;
  cache: "live" | "cached";
  resultCount: number;
  results: R;
  provenance: QlooProvenance;
  interpretation?: unknown;
  resolution?: ProjectedResolution;
  warnings?: string[];
  explainability?: unknown;
}
