import { z } from "zod";
import { malformedResponse, networkError, restHttpError } from "./errors.js";
import { guardMessage } from "./guards.js";
import type { QlooTransport, QlooTransportCall, TransportResponse } from "./transport.js";
import { upstreamResultCount } from "./transport.js";
import {
  insightsTypeUrn,
  searchTypeUrn,
  type BridgeRequest,
  type DescribeRequest,
  type InsightsRequest,
  type QlooOperation,
  type ReplaceRequest,
  type ResolveTagsRequest,
  type SearchRequest,
  type TriangulateRequest
} from "./types.js";

type RestParam = string | number | boolean | readonly unknown[];

interface RestPlan {
  path: string;
  method: "GET" | "POST";
  params: Record<string, RestParam>;
  resultKey: string;
}

const POST_ONLY_PARAMS = ["signal.interests.entities.query", "filter.exclude.entities.query"] as const;

const restResponseSchema = z.looseObject({ results: z.unknown().optional() });

function searchPlan(request: SearchRequest): RestPlan {
  const params: Record<string, RestParam> = { query: request.query };
  if (request.types !== undefined) {
    params.type = request.types.map(searchTypeUrn).join(",");
  }
  if (request.take !== undefined) {
    params.take = Math.min(request.take, 50);
  }
  return { path: "/search", method: "GET", params, resultKey: "entities" };
}

function resolveTagsPlan(request: ResolveTagsRequest): RestPlan {
  const params: Record<string, RestParam> = { "filter.query": request.query };
  if (request.take !== undefined) {
    params.take = Math.min(request.take, 20);
  }
  return { path: "/v2/tags", method: "GET", params, resultKey: "tags" };
}

function insightsPlan(request: InsightsRequest): RestPlan {
  const params: Record<string, RestParam> = { "filter.type": insightsTypeUrn(request.filterType) };
  if (request.signalEntities !== undefined) {
    params["signal.interests.entities"] = [...request.signalEntities];
  }
  if (request.signalEntitiesQuery !== undefined) {
    params["signal.interests.entities.query"] = [...request.signalEntitiesQuery];
  }
  if (request.signalTags !== undefined) {
    params["signal.interests.tags"] = [...request.signalTags];
  }
  if (request.signalLocation !== undefined) {
    params["signal.location.query"] = request.signalLocation;
  }
  if (request.excludeEntities !== undefined) {
    params["filter.exclude.entities"] = [...request.excludeEntities];
  }
  if (request.excludeEntitiesQuery !== undefined) {
    params["filter.exclude.entities.query"] = [...request.excludeEntitiesQuery];
  }
  if (request.excludeTags !== undefined) {
    params["filter.exclude.tags"] = [...request.excludeTags];
  }
  if (request.filterEntities !== undefined) {
    params["filter.results.entities"] = [...request.filterEntities];
  }
  if (request.filterTags !== undefined) {
    params["filter.tags"] = [...request.filterTags];
  }
  if (request.location?.query !== undefined) {
    params["filter.location.query"] = request.location.query;
  }
  if (request.location?.point !== undefined) {
    params["filter.location"] = `POINT(${request.location.point.lon} ${request.location.point.lat})`;
  }
  if (request.location?.radiusM !== undefined) {
    params["filter.location.radius"] = request.location.radiusM;
  }
  if (request.popularityMin !== undefined) {
    params["filter.popularity.min"] = request.popularityMin;
  }
  if (request.popularityMax !== undefined) {
    params["filter.popularity.max"] = request.popularityMax;
  }
  if (request.explainability === true) {
    params["feature.explainability"] = true;
  }
  if (request.take !== undefined) {
    params.take = Math.min(request.take, 50);
  }
  if (request.page !== undefined) {
    params.page = request.page;
  }
  const requiresPost = POST_ONLY_PARAMS.some((key) => params[key] !== undefined);
  return {
    path: "/v2/insights",
    method: requiresPost ? "POST" : "GET",
    params,
    resultKey: request.filterType === "heatmap" ? "heatmap" : "entities"
  };
}

function describePlan(request: DescribeRequest): RestPlan {
  if (request.type !== undefined) {
    throw guardMessage("transport rest describe does not support the optional type hint; use transport auto or mcp");
  }
  return { path: "/entities", method: "GET", params: { entity_ids: request.entity }, resultKey: "entities" };
}

function bridgePlan(request: BridgeRequest): RestPlan {
  const params: Record<string, RestParam> = { "filter.type": insightsTypeUrn(request.targetType) };
  if (request.signals !== undefined) {
    params["signal.interests.entities"] = [...request.signals];
  }
  if (request.signalTags !== undefined) {
    params["signal.interests.tags"] = [...request.signalTags];
  }
  if (request.signalLocation !== undefined) {
    params["signal.location.query"] = request.signalLocation;
  }
  if (request.filterLocation !== undefined) {
    params["filter.location.query"] = request.filterLocation;
  }
  if (request.includeTags !== undefined) {
    params["filter.tags"] = [...request.includeTags];
  }
  if (request.excludeTags !== undefined) {
    params["filter.exclude.tags"] = [...request.excludeTags];
  }
  if (request.limit !== undefined) {
    params.take = Math.min(request.limit, 20);
  }
  return { path: "/v2/insights", method: "GET", params, resultKey: "entities" };
}

function replacePlan(request: ReplaceRequest): RestPlan {
  const params: Record<string, RestParam> = {
    "filter.type": insightsTypeUrn(request.optionType),
    "filter.results.entities": [...request.options],
    take: request.options.length
  };
  if (request.signals !== undefined) {
    params["signal.interests.entities"] = [...request.signals];
  }
  if (request.signalLocation !== undefined) {
    params["signal.location.query"] = request.signalLocation;
  }
  if (request.includeTags !== undefined) {
    params["filter.tags"] = [...request.includeTags];
  }
  if (request.excludeTags !== undefined) {
    params["filter.exclude.tags"] = [...request.excludeTags];
  }
  return { path: "/v2/insights", method: "GET", params, resultKey: "entities" };
}

function triangulatePlan(request: TriangulateRequest): RestPlan {
  const params: Record<string, RestParam> = {
    "a.signal.interests.entities": [...request.groupA],
    "b.signal.interests.entities": [...request.groupB]
  };
  if (request.targetType !== undefined) {
    params["filter.type"] = insightsTypeUrn(request.targetType);
  }
  if (request.limit !== undefined) {
    params.take = Math.min(request.limit, 20);
  }
  return { path: "/v2/analysis/compare", method: "GET", params, resultKey: "results" };
}

function buildPlan(operation: QlooOperation, request: unknown): RestPlan {
  switch (operation) {
    case "search":
      return searchPlan(request as SearchRequest);
    case "resolveTags":
      return resolveTagsPlan(request as ResolveTagsRequest);
    case "insights":
      return insightsPlan(request as InsightsRequest);
    case "describe":
      return describePlan(request as DescribeRequest);
    case "bridge":
      return bridgePlan(request as BridgeRequest);
    case "replace":
      return replacePlan(request as ReplaceRequest);
    case "triangulate":
      return triangulatePlan(request as TriangulateRequest);
    case "capabilities":
      throw guardMessage("capabilities has no REST request plan");
  }
}

function serializeParams(params: Record<string, RestParam>): Record<string, string> {
  const serialized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const text = Array.isArray(value)
      ? value.map((entry) => String(entry)).join(",")
      : value === undefined || value === null
        ? ""
        : String(value);
    if (text !== "") {
      serialized[key] = text;
    }
  }
  return serialized;
}

export interface RestTransportOptions {
  fetchImpl?: typeof fetch;
}

export function createRestTransport(options: RestTransportOptions = {}): QlooTransport {
  const fetchImpl = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  return {
    async call(input: QlooTransportCall): Promise<TransportResponse> {
      const { operation, request, settings } = input;
      const secrets: ReadonlyArray<string | undefined> = [settings.apiKey];
      const startedAt = Date.now();

      if (operation === "capabilities") {
        return {
          payload: {},
          durationMs: Date.now() - startedAt,
          endpoint: settings.baseUrl,
          warnings: [
            "REST capabilities reports configuration readiness only; contract metadata is available over the MCP transport."
          ]
        };
      }

      const plan = buildPlan(operation, request);
      const url = new URL(plan.path, settings.baseUrl);
      const headers: Record<string, string> = { Accept: "application/json", "X-Api-Key": settings.apiKey };
      const init: RequestInit = { method: plan.method, headers };
      let sentParams: Record<string, unknown>;

      if (plan.method === "POST") {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(plan.params);
        sentParams = { ...plan.params };
      } else {
        const serialized = serializeParams(plan.params);
        for (const [key, value] of Object.entries(serialized)) {
          url.searchParams.set(key, value);
        }
        sentParams = serialized;
      }

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, settings.requestTimeoutMs);
      init.signal = controller.signal;

      let response: Response;
      try {
        response = await fetchImpl(url, init);
      } catch (error) {
        throw networkError(error, plan.path, {
          timedOut,
          timeoutMs: settings.requestTimeoutMs,
          secrets
        });
      } finally {
        clearTimeout(timer);
      }

      let bodyText: string;
      try {
        bodyText = await response.text();
      } catch (error) {
        throw networkError(error, plan.path, { timedOut: false, timeoutMs: settings.requestTimeoutMs, secrets });
      }

      if (!response.ok) {
        throw restHttpError(response.status, bodyText, response.headers.get("retry-after"), plan.path, secrets);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        throw malformedResponse(plan.path, "response body was not valid JSON", secrets);
      }
      const parsed = restResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw malformedResponse(
          plan.path,
          `response body was not a JSON object (${parsed.error.issues.map((issue) => issue.message).join("; ")})`,
          secrets
        );
      }

      return {
        payload: parsed.data,
        durationMs: Date.now() - startedAt,
        endpoint: settings.baseUrl,
        requests: [{ method: plan.method, path: plan.path, params: sentParams }],
        upstreamResultCount: upstreamResultCount(parsed.data, plan.resultKey)
      };
    }
  };
}
