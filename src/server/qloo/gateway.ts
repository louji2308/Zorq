import type { ZodType } from "zod";
import { z } from "zod";
import pLimit from "p-limit";
import { ApiError } from "../../shared/errors.js";
import type { ZorqConfig } from "../config.js";
import { QlooCallBudget } from "./budget.js";
import { QlooEnvelopeCache } from "./cache.js";
import { QLOO_LIMITS, resolveQlooSettings, type QlooSettings } from "./config.js";
import { QlooUpstreamError, scrubSecrets, truncateText } from "./errors.js";
import { guardInsights, parseRequest, resolveTransport, stableKey } from "./guards.js";
import { McpTransport } from "./mcpTransport.js";
import {
  capabilitiesResult,
  projectCapabilities,
  projectCompareResults,
  projectEntities,
  projectHeatmapCells,
  projectResolution,
  projectTags
} from "./project.js";
import { createRestTransport } from "./restTransport.js";
import { buildProvenance, type QlooTransport, type TransportResponse } from "./transport.js";
import {
  bridgeRequestSchema,
  describeRequestSchema,
  insightsRequestSchema,
  qlooCallOptionsSchema,
  replaceRequestSchema,
  resolveTagsRequestSchema,
  searchRequestSchema,
  triangulateRequestSchema,
  type BridgeRequest,
  type DescribeRequest,
  type InsightsRequest,
  type QlooCallOptions,
  type ProjectedCompareResults,
  type QlooEnvelope,
  type QlooEnvelopeStatus,
  type QlooInsightsResults,
  type QlooOperation,
  type QlooTagResults,
  type QlooTransportKind,
  type ReplaceRequest,
  type ResolveTagsRequest,
  type SearchRequest,
  type TriangulateRequest,
  type QlooCapabilitiesResult,
  type QlooEntityResults
} from "./types.js";

const capabilitiesRequestSchema = z.object({});

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2000;
const MAX_JITTER_MS = 250;
const MAX_RETRY_DELAY_MS = 4000;

export interface QlooGatewayStats {
  budgetUsed: number;
  budgetRemaining: number;
  cacheSize: number;
  cacheHits: number;
}

export interface QlooGateway {
  capabilities(options?: QlooCallOptions): Promise<QlooEnvelope<QlooCapabilitiesResult>>;
  search(request: SearchRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooEntityResults>>;
  resolveTags(request: ResolveTagsRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooTagResults>>;
  insights(request: InsightsRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooInsightsResults>>;
  describe(request: DescribeRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooEntityResults>>;
  bridge(request: BridgeRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooEntityResults>>;
  replace(request: ReplaceRequest, options?: QlooCallOptions): Promise<QlooEnvelope<QlooEntityResults>>;
  triangulate(
    request: TriangulateRequest,
    options?: QlooCallOptions
  ): Promise<QlooEnvelope<ProjectedCompareResults>>;
  readonly stats: QlooGatewayStats;
  close(): Promise<void>;
}

export interface QlooGatewayOptions {
  config: ZorqConfig;
  transport?: QlooTransport;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

interface InvokeArgs<TRequest, TResults> {
  operation: QlooOperation;
  schema: ZodType<TRequest>;
  rawRequest: unknown;
  options: QlooCallOptions | undefined;
  project: (payload: unknown, response: TransportResponse, transport: QlooTransportKind) => TResults;
  count: (results: TResults) => number;
}

function createDefaultTransport(): QlooTransport {
  const rest = createRestTransport();
  const mcp = new McpTransport();
  return {
    call: (call) => (call.transport === "mcp" ? mcp : rest).call(call),
    close: () => mcp.close()
  };
}

function scrubDetails(
  details: QlooUpstreamError["details"],
  secrets: ReadonlyArray<string | undefined>
): QlooUpstreamError["details"] {
  if (details === undefined) {
    return undefined;
  }
  return details.map((detail) => ({ path: detail.path, message: scrubSecrets(detail.message, secrets) }));
}

function toSafeError(error: unknown, secrets: ReadonlyArray<string | undefined>): ApiError {
  if (error instanceof QlooUpstreamError) {
    return new QlooUpstreamError(
      error.code,
      scrubSecrets(error.message, secrets),
      { retryable: error.retryable, retryAfterMs: error.retryAfterMs },
      scrubDetails(error.details, secrets)
    );
  }
  if (error instanceof ApiError) {
    return new ApiError(error.code, scrubSecrets(error.message, secrets), scrubDetails(error.details, secrets));
  }
  const raw = error instanceof Error ? error.message : String(error);
  return new QlooUpstreamError(
    "DEPENDENCY_UNAVAILABLE",
    scrubSecrets(`Qloo gateway call failed: ${truncateText(raw)}`, secrets),
    { retryable: false },
    [{ path: "upstream", message: scrubSecrets(truncateText(raw), secrets) }]
  );
}

export function createQlooGateway(options: QlooGatewayOptions): QlooGateway {
  const { config } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const transport = options.transport ?? createDefaultTransport();
  const budget = new QlooCallBudget(config.maxQlooCalls);
  const cache = new QlooEnvelopeCache({
    maxEntries: QLOO_LIMITS.cacheMaxEntries,
    ttlMs: Math.max(0, config.qlooCacheTtlSec) * 1000,
    ...(options.now !== undefined ? { now: options.now } : {})
  });
  const limit = pLimit(config.qlooConcurrency);

  async function callWithRetry(run: () => Promise<TransportResponse>): Promise<TransportResponse> {
    let attempt = 0;
    for (;;) {
      try {
        return await run();
      } catch (error) {
        if (!(error instanceof QlooUpstreamError) || !error.retryable || attempt >= MAX_RETRIES) {
          throw error;
        }
        const backoff =
          Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + Math.floor(random() * MAX_JITTER_MS);
        const delay = Math.min(error.retryAfterMs ?? backoff, MAX_RETRY_DELAY_MS);
        attempt += 1;
        await sleep(delay);
      }
    }
  }

  async function invoke<TRequest, TResults>(args: InvokeArgs<TRequest, TResults>): Promise<QlooEnvelope<TResults>> {
    const settings: QlooSettings = resolveQlooSettings(config);
    const secrets: ReadonlyArray<string | undefined> = [settings.apiKey];
    try {
      const request = parseRequest(args.schema, args.rawRequest);
      if (args.operation === "insights") {
        guardInsights(request as InsightsRequest);
      }
      const callOptions = parseRequest(qlooCallOptionsSchema, args.options ?? {});
      const selection = callOptions.transport ?? "auto";
      const kind = resolveTransport(args.operation, selection, request);
      const cacheKey = stableKey({ transport: kind, operation: args.operation, request });

      const cached = cache.get(cacheKey) as QlooEnvelope<TResults> | undefined;
      if (cached !== undefined) {
        return { ...cached, cache: "cached" };
      }

      budget.assertAcquire();
      const response = await limit(() =>
        callWithRetry(() => transport.call({ operation: args.operation, transport: kind, request, settings }))
      );

      const results = args.project(response.payload, response, kind);
      const resultCount = args.count(results);
      const upstreamCount = response.upstreamResultCount ?? 0;
      const warnings = [...(response.warnings ?? [])];
      let status: QlooEnvelopeStatus;
      if (
        response.upstreamStatus === "needs_input" ||
        response.upstreamStatus === "partial" ||
        response.upstreamStatus === "degraded"
      ) {
        status = response.upstreamStatus;
      } else if (resultCount > 0) {
        status = "ok";
      } else if (upstreamCount > 0) {
        status = "partial";
        warnings.push(`Qloo reported ${upstreamCount} results but none matched the projected fields`);
      } else {
        status = "empty";
      }

      const envelope: QlooEnvelope<TResults> = {
        status,
        operation: args.operation,
        transport: kind,
        cache: "live",
        resultCount,
        results,
        provenance: buildProvenance(
          { operation: args.operation, transport: kind, request, settings },
          response
        )
      };
      if (response.interpretation !== undefined) {
        envelope.interpretation = response.interpretation;
      }
      const resolution = projectResolution(response.resolution);
      if (resolution !== undefined) {
        envelope.resolution = resolution;
      }
      if (warnings.length > 0) {
        envelope.warnings = warnings;
      }
      if (response.explainability !== undefined) {
        envelope.explainability = response.explainability;
      }

      cache.set(cacheKey, envelope);
      return envelope;
    } catch (error) {
      throw toSafeError(error, secrets);
    }
  }

  function entityCount(results: QlooEntityResults): number {
    return results.entities.length;
  }

  return {
    capabilities(callOptions?: QlooCallOptions) {
      return invoke({
        operation: "capabilities",
        schema: capabilitiesRequestSchema,
        rawRequest: {},
        options: callOptions,
        project: (payload, response, kind) =>
          capabilitiesResult(kind, response.endpoint, projectCapabilities(payload), response.contractChecksumChanged),
        count: (results) => results.supportedOperationIds?.length ?? (results.ready ? 1 : 0)
      });
    },

    search(request: SearchRequest, callOptions?: QlooCallOptions) {
      return invoke<SearchRequest, QlooEntityResults>({
        operation: "search",
        schema: searchRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => ({ entities: projectEntities(payload) }),
        count: entityCount
      });
    },

    resolveTags(request: ResolveTagsRequest, callOptions?: QlooCallOptions) {
      return invoke<ResolveTagsRequest, QlooTagResults>({
        operation: "resolveTags",
        schema: resolveTagsRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => ({ tags: projectTags(payload) }),
        count: (results) => results.tags.length
      });
    },

    insights(request: InsightsRequest, callOptions?: QlooCallOptions) {
      return invoke<InsightsRequest, QlooInsightsResults>({
        operation: "insights",
        schema: insightsRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) =>
          request.filterType === "heatmap"
            ? { heatmap: projectHeatmapCells(payload) }
            : { entities: projectEntities(payload) },
        count: (results) => (results.entities?.length ?? 0) + (results.heatmap?.length ?? 0)
      });
    },

    describe(request: DescribeRequest, callOptions?: QlooCallOptions) {
      return invoke<DescribeRequest, QlooEntityResults>({
        operation: "describe",
        schema: describeRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => ({ entities: projectEntities(payload) }),
        count: entityCount
      });
    },

    bridge(request: BridgeRequest, callOptions?: QlooCallOptions) {
      return invoke<BridgeRequest, QlooEntityResults>({
        operation: "bridge",
        schema: bridgeRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => ({ entities: projectEntities(payload) }),
        count: entityCount
      });
    },

    replace(request: ReplaceRequest, callOptions?: QlooCallOptions) {
      return invoke<ReplaceRequest, QlooEntityResults>({
        operation: "replace",
        schema: replaceRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => ({ entities: projectEntities(payload) }),
        count: entityCount
      });
    },

    triangulate(request: TriangulateRequest, callOptions?: QlooCallOptions) {
      return invoke<TriangulateRequest, ProjectedCompareResults>({
        operation: "triangulate",
        schema: triangulateRequestSchema,
        rawRequest: request,
        options: callOptions,
        project: (payload) => projectCompareResults(payload),
        count: (results) => results.a.length + results.b.length + results.matchEntities.length + results.tags.length
      });
    },

    get stats(): QlooGatewayStats {
      return {
        budgetUsed: budget.used,
        budgetRemaining: budget.remaining,
        cacheSize: cache.size,
        cacheHits: cache.hits
      };
    },

    async close(): Promise<void> {
      await transport.close?.();
    }
  };
}
