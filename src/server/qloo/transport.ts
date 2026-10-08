import type { QlooOperation, QlooProvenance, QlooProvenanceRequest, QlooTransportKind } from "./types.js";
import type { QlooSettings } from "./config.js";

export type QlooUpstreamStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded";

export interface QlooTransportCall {
  operation: QlooOperation;
  transport: QlooTransportKind;
  request: unknown;
  settings: QlooSettings;
}

export interface TransportResponse {
  payload: unknown;
  durationMs: number;
  endpoint: string;
  requests?: QlooProvenanceRequest[];
  correlationId?: string;
  contractChecksum?: string;
  contractChecksumChanged?: boolean;
  upstreamStatus?: QlooUpstreamStatus;
  upstreamResultCount?: number;
  interpretation?: unknown;
  resolution?: unknown;
  warnings?: string[];
  explainability?: unknown;
}

export interface QlooTransport {
  call(input: QlooTransportCall): Promise<TransportResponse>;
  close?(): Promise<void>;
}

export function buildProvenance(call: QlooTransportCall, response: TransportResponse): QlooProvenance {
  const provenance: QlooProvenance = {
    transport: call.transport,
    operation: call.operation,
    endpoint: response.endpoint,
    durationMs: response.durationMs
  };
  if (response.correlationId !== undefined) {
    provenance.correlationId = response.correlationId;
  }
  if (response.contractChecksum !== undefined) {
    provenance.contractChecksum = response.contractChecksum;
  }
  if (response.contractChecksumChanged !== undefined) {
    provenance.contractChecksumChanged = response.contractChecksumChanged;
  }
  if (response.requests !== undefined && response.requests.length > 0) {
    provenance.requests = response.requests;
  }
  return provenance;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Mirrors the official Qloo client: results live either in a bare array or under a named key. */
export function upstreamResults(payload: unknown, key: string): unknown[] {
  const record = asRecord(payload);
  if (record === undefined) {
    return [];
  }
  const results = record.results;
  if (Array.isArray(results)) {
    return results;
  }
  const nested = asRecord(results)?.[key];
  if (Array.isArray(nested)) {
    return nested;
  }
  return [];
}

export function upstreamResultCount(payload: unknown, key: string): number {
  const record = asRecord(payload);
  if (record === undefined) {
    return 0;
  }
  const results = record.results;
  if (Array.isArray(results)) {
    return results.length;
  }
  const nested = asRecord(results)?.[key];
  if (Array.isArray(nested)) {
    return nested.length;
  }
  return results === undefined ? 0 : 1;
}
