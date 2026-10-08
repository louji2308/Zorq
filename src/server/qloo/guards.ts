import type { ZodType } from "zod";
import { ApiError, validationFailed } from "../../shared/errors.js";
import type {
  InsightsRequest,
  QlooOperation,
  QlooTransportKind,
  QlooTransportSelection
} from "./types.js";

export function guardMessage(message: string): ApiError {
  return new ApiError("VALIDATION_FAILED", message);
}

export function parseRequest<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationFailed(result.error.issues, "Qloo request validation failed");
  }
  return result.data;
}

export function isQlooUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function guardInsights(request: InsightsRequest): void {
  const hasSignal =
    hasEntries(request.signalEntities) ||
    hasEntries(request.signalEntitiesQuery) ||
    hasEntries(request.signalTags);
  if (request.filterType === "heatmap") {
    if (!hasSignal) {
      throw guardMessage("heatmap insights require at least one signal (signalEntities or signalTags)");
    }
    if (request.location === undefined) {
      throw guardMessage("heatmap insights require a location (location.query or location.point)");
    }
    return;
  }
  if (request.location !== undefined && request.filterType !== "place" && request.filterType !== "destination") {
    throw guardMessage(`location filters are only supported for place and destination insights, not ${request.filterType}`);
  }
}

const PRIMARY_TRANSPORT: Record<QlooOperation, QlooTransportKind> = {
  capabilities: "mcp",
  search: "rest",
  resolveTags: "mcp",
  insights: "rest",
  describe: "mcp",
  bridge: "mcp",
  replace: "mcp",
  triangulate: "mcp"
};

const SUPPORTED_TRANSPORTS: Record<QlooOperation, readonly QlooTransportKind[]> = {
  capabilities: ["mcp", "rest"],
  search: ["rest"],
  resolveTags: ["mcp", "rest"],
  insights: ["rest"],
  describe: ["mcp", "rest"],
  bridge: ["mcp", "rest"],
  replace: ["mcp", "rest"],
  triangulate: ["mcp", "rest"]
};

function targetFieldFor(operation: QlooOperation): string | undefined {
  if (operation === "replace") {
    return "optionType";
  }
  if (operation === "bridge" || operation === "triangulate") {
    return "targetType";
  }
  return undefined;
}

function isDestinationTarget(operation: QlooOperation, request: unknown): boolean {
  const field = targetFieldFor(operation);
  if (field === undefined || !isRecord(request)) {
    return false;
  }
  return request[field] === "destination";
}

function allUuid(values: unknown): boolean {
  return Array.isArray(values) && values.every((entry) => typeof entry === "string" && isQlooUuid(entry));
}

export function resolveTransport(
  operation: QlooOperation,
  selection: QlooTransportSelection,
  request?: unknown
): QlooTransportKind {
  const supported = SUPPORTED_TRANSPORTS[operation];
  const destinationTarget = isDestinationTarget(operation, request);
  if (destinationTarget && selection === "mcp") {
    throw guardMessage("destination targets are not supported by the MCP workflow tools; use transport auto or rest");
  }
  let preferred: QlooTransportKind = PRIMARY_TRANSPORT[operation];
  if (destinationTarget) {
    preferred = "rest";
  }
  let kind: QlooTransportKind;
  if (selection === "auto") {
    if (!supported.includes(preferred)) {
      throw guardMessage(`transport routing error for operation ${operation}`);
    }
    kind = preferred;
  } else {
    if (!supported.includes(selection)) {
      throw guardMessage(`operation ${operation} is not available over the ${selection} transport`);
    }
    kind = selection;
  }
  if (kind === "rest") {
    guardRestRequest(operation, request);
  }
  return kind;
}

function guardRestRequest(operation: QlooOperation, request: unknown): void {
  if (!isRecord(request)) {
    return;
  }
  if (operation === "describe") {
    const entity = request.entity;
    if (typeof entity !== "string" || !isQlooUuid(entity)) {
      throw guardMessage("transport rest describe requires a Qloo entity UUID; use transport auto or mcp to resolve names");
    }
    return;
  }
  if (operation === "triangulate") {
    if (!allUuid(request.groupA) || !allUuid(request.groupB)) {
      throw guardMessage("transport rest triangulate requires Qloo entity UUIDs in groupA and groupB; use transport auto or mcp to resolve names");
    }
    return;
  }
  if (operation === "bridge" || operation === "replace") {
    if (typeof request.demographic === "string" && request.demographic !== "") {
      throw guardMessage(`transport rest ${operation} does not support demographic signals; use transport auto or mcp`);
    }
  }
}

export function stableKey(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    );
    return Object.fromEntries(entries.map(([key, entry]) => [key, sortValue(entry)]));
  }
  return value;
}
