import { z, type ZodError } from "zod";
import {
  bridgeRequestSchema,
  describeRequestSchema,
  insightsRequestSchema,
  qlooEnvelopeStatuses,
  qlooOperations,
  qlooTransportKinds,
  replaceRequestSchema,
  resolveTagsRequestSchema,
  searchRequestSchema,
  triangulateRequestSchema,
  type QlooEnvelope,
  type QlooGateway
} from "../qloo/index.js";
import {
  createEvidenceRecord,
  type EvidenceProvenance,
  type EvidenceRecord
} from "../evidence/index.js";
import { ApiError, zodIssuesToDetails } from "../../shared/errors.js";
import { ledgerEventSchema, type LedgerEvent } from "../../shared/events.js";
import {
  boundedActivityRequest,
  boundedActivityValue,
  clipActivityText,
  collectActivityNames,
  formatActivityRequest
} from "./activity.js";
import { AgentToolError } from "./errors.js";
import type { LlmToolCall, LlmToolDefinition } from "./llm.js";
import type { Ledger, LedgerEntry } from "./ledger.js";

const MAX_OBSERVATION_CHARS = 6000;

const envelopeSchema = z.object({
  status: z.enum(qlooEnvelopeStatuses),
  operation: z.enum(qlooOperations),
  transport: z.enum(qlooTransportKinds),
  cache: z.enum(["live", "cached"]),
  resultCount: z.number().int().nonnegative(),
  results: z.unknown(),
  provenance: z.object({
    transport: z.enum(qlooTransportKinds),
    operation: z.enum(qlooOperations),
    endpoint: z.string().min(1),
    durationMs: z.number().finite().nonnegative()
  })
});

interface AgentToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (gateway: QlooGateway, args: unknown) => Promise<QlooEnvelope<unknown>>;
}

function defineTool<T>(
  name: string,
  description: string,
  schema: z.ZodType<T>,
  handler: (gateway: QlooGateway, request: T) => Promise<QlooEnvelope<unknown>>
): AgentToolSpec {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return {
    name,
    description,
    parameters: json,
    run: (gateway, args) => handler(gateway, schema.parse(args))
  };
}

const toolSpecs: AgentToolSpec[] = [
  defineTool(
    "qloo_capabilities",
    "Diagnostic probe: check Qloo gateway readiness, contract version, and supported operations. Use only after a tool call fails with a transport error; do not spend a planning turn on it before your first cultural probe.",
    z.object({}),
    (gateway) => gateway.capabilities()
  ),
  defineTool(
    "qloo_search",
    "Search Qloo entities (places, artists, movies, brands, destinations, ...) by free-text query. Use for role-preserving candidate discovery: when a component needs replacing, search the same role rather than a different one.",
    searchRequestSchema,
    (gateway, request) => gateway.search(request)
  ),
  defineTool(
    "qloo_resolve_tags",
    "Resolve a free-text concept to canonical Qloo tags with ids. Use whenever a brief concept or component name is unresolved and must become a concrete tag before other probes.",
    resolveTagsRequestSchema,
    (gateway, request) => gateway.resolveTags(request)
  ),
  defineTool(
    "qloo_insights",
    "Primary measurement probe: audience/affinity insights, locality heatmaps, and taste neighborhoods around tags, entities, or locations. For filterType=heatmap you must provide at least one signal (signalEntities, signalEntitiesQuery, or signalTags) and a location (location.query or location.point). Use to gather site-local evidence. If site-local data is thin, widen the scale (larger take, broader location) and compare local vs. city signals.",
    insightsRequestSchema,
    (gateway, request) => gateway.insights(request)
  ),
  defineTool(
    "qloo_describe",
    "Inspect a single entity in detail (type, tags, popularity, location, hours). Use to verify an anchor or candidate before committing to it.",
    describeRequestSchema,
    (gateway, request) => gateway.describe(request)
  ),
  defineTool(
    "qloo_bridge",
    "Find entities that bridge two weakly related signals (target type plus two signal sets). Use when a relationship between components is weak or missing and needs a connecting entity.",
    bridgeRequestSchema,
    (gateway, request) => gateway.bridge(request)
  ),
  defineTool(
    "qloo_replace",
    "Role-preserving replacement: given candidate options of one entity type, find replacements that fit the same signals and constraints. Use when an existing component must be swapped without changing its role.",
    replaceRequestSchema,
    (gateway, request) => gateway.replace(request)
  ),
  defineTool(
    "qloo_triangulate",
    "Independently re-measure a relationship between two groups through a second Qloo route. Use whenever evidence is uncertain or contested and needs independent confirmation.",
    triangulateRequestSchema,
    (gateway, request) => gateway.triangulate(request)
  )
];

const specByName = new Map(toolSpecs.map((spec) => [spec.name, spec]));

export const AGENT_TOOLS: LlmToolDefinition[] = toolSpecs.map((spec) => ({
  name: spec.name,
  description: spec.description,
  parameters: spec.parameters
}));

export function provenanceFromEnvelope(envelope: QlooEnvelope<unknown>): EvidenceProvenance {
  return {
    transport: envelope.transport,
    operation: envelope.operation,
    endpoint: envelope.provenance.endpoint,
    durationMs: envelope.provenance.durationMs,
    cacheState: envelope.cache,
    resultCount: envelope.resultCount
  };
}

function renderObservation(name: string, envelope: QlooEnvelope<unknown>): string {
  const payload = {
    tool: name,
    status: envelope.status,
    operation: envelope.operation,
    transport: envelope.transport,
    cache: envelope.cache,
    resultCount: envelope.resultCount,
    endpoint: envelope.provenance.endpoint,
    durationMs: envelope.provenance.durationMs,
    warnings: envelope.warnings ?? [],
    results: envelope.results
  };
  const json = JSON.stringify(payload);
  if (json.length <= MAX_OBSERVATION_CHARS) {
    return json;
  }
  return `${json.slice(0, MAX_OBSERVATION_CHARS)}...[truncated]`;
}

export function parseToolArguments(call: LlmToolCall): unknown {
  const raw = typeof call.arguments === "string" ? call.arguments.trim() : "";
  if (raw === "") {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AgentToolError("invalid_arguments", call.name, `tool "${call.name}" arguments are not valid JSON`);
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof z.ZodError;
}

function describeEnvelope(
  tool: string,
  args: unknown,
  envelope: QlooEnvelope<unknown>
): Pick<LedgerEvent, "detail" | "parameters"> {
  const names = collectActivityNames(envelope.results);
  const returned =
    names.length > 0 ? `returned ${names.join(", ")}` : `returned ${envelope.resultCount} result(s)`;
  return {
    detail: clipActivityText(`request ${formatActivityRequest(args)} | ${returned}`),
    parameters: {
      tool,
      request: boundedActivityRequest(args),
      operation: envelope.operation,
      status: envelope.status,
      transport: envelope.transport,
      cache: envelope.cache,
      endpoint: envelope.provenance.endpoint,
      durationMs: envelope.provenance.durationMs,
      resultCount: envelope.resultCount,
      resultNames: names,
      warnings: boundedActivityValue(envelope.warnings ?? [])
    }
  };
}

export interface ExecuteToolCallOptions {
  gateway: QlooGateway;
  call: LlmToolCall;
  ledger: Ledger;
  now?: () => number;
}

export interface ToolObservation {
  toolCall: LlmToolCall;
  envelope: QlooEnvelope<unknown>;
  ledgerEntry: LedgerEntry;
  evidence: EvidenceRecord;
  observation: string;
}

export async function executeToolCall(options: ExecuteToolCallOptions): Promise<ToolObservation> {
  const spec = specByName.get(options.call.name);
  if (spec === undefined) {
    throw new AgentToolError("unknown_tool", options.call.name, `unknown tool "${options.call.name}"`);
  }
  const args = parseToolArguments(options.call);

  let envelope: QlooEnvelope<unknown>;
  try {
    envelope = await spec.run(options.gateway, args);
  } catch (error) {
    if (isZodError(error)) {
      throw new AgentToolError(
        "invalid_arguments",
        spec.name,
        `tool "${spec.name}" arguments failed validation: ${error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
        zodIssuesToDetails(error.issues)
      );
    }
    if (error instanceof ApiError && error.code === "VALIDATION_FAILED" && !(error instanceof AgentToolError)) {
      throw new AgentToolError(
        "invalid_arguments",
        spec.name,
        `tool "${spec.name}" was rejected: ${error.message}`,
        error.details
      );
    }
    throw error;
  }

  const validEnvelope = envelopeSchema.safeParse(envelope);
  if (!validEnvelope.success) {
    throw new AgentToolError(
      "invalid_envelope",
      spec.name,
      `tool "${spec.name}" returned an envelope that failed validation: ${validEnvelope.error.issues
        .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
      zodIssuesToDetails(validEnvelope.error.issues)
    );
  }

  const activity = describeEnvelope(spec.name, args, envelope);
  const event: LedgerEvent = {
    kind: "Qloo",
    label: spec.name,
    summary: `${envelope.status} ${envelope.operation} via ${envelope.transport} | ${envelope.cache} | ${envelope.resultCount} result(s)`,
    ...activity,
    duration: envelope.provenance.durationMs,
    cacheState: envelope.cache,
    resultCount: envelope.resultCount
  };
  const ledgerEntry = options.ledger.append(ledgerEventSchema.parse(event));

  const now = options.now ?? Date.now;
  const evidence = createEvidenceRecord({
    operation: envelope.operation,
    claim: `Qloo ${envelope.operation} observation via ${spec.name}`,
    provenance: provenanceFromEnvelope(envelope),
    createdAt: new Date(now()).toISOString(),
    ledgerEventId: ledgerEntry.id
  });

  return {
    toolCall: options.call,
    envelope,
    ledgerEntry,
    evidence,
    observation: renderObservation(spec.name, envelope)
  };
}
