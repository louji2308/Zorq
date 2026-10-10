import { apiErrorCodeSchema, type ApiErrorBody, type ApiErrorCode } from "../../shared/errors.js";
import type { StreamFrame } from "./hub.js";

export const HEARTBEAT_COMMENT = ": heartbeat\n\n";

export function toErrorBody(data: unknown, requestId: string): ApiErrorBody {
  const record = (
    typeof data === "object" && data !== null ? data : {}
  ) as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" && record.message !== "" ? record.message : "stream error";
  const parsedCode = apiErrorCodeSchema.safeParse(record.code);
  const code: ApiErrorCode = parsedCode.success ? parsedCode.data : "INTERNAL";
  return { error: { code, message, requestId } };
}

export function serializeFrame(frame: StreamFrame, requestId: string): string {
  const data = frame.event === "error" ? toErrorBody(frame.data, requestId) : frame.data;
  return `event: ${frame.event}\nid: ${frame.id}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseLastEventId(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}
