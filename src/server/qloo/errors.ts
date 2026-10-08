import { ApiError, type ApiErrorCode, type ApiErrorDetail } from "../../shared/errors.js";

export class QlooUpstreamError extends ApiError {
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { retryable?: boolean; retryAfterMs?: number } = {},
    details?: ApiErrorDetail[]
  ) {
    super(code, message, details);
    this.name = "QlooUpstreamError";
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function upstreamDetail(message: string): ApiErrorDetail[] {
  return [{ path: "upstream", message }];
}

export function truncateText(value: string, max = 300): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

export function scrubSecrets(value: string, secrets: ReadonlyArray<string | undefined>): string {
  let out = value;
  for (const secret of secrets) {
    if (secret !== undefined && secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null || header === "") {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 4000);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return undefined;
  }
  return Math.min(Math.max(date - Date.now(), 0), 4000);
}

function extractUpstreamMessage(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (trimmed === "") {
    return "empty upstream error body";
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const errors = record.errors;
      if (Array.isArray(errors)) {
        const first = errors.find(
          (entry) => entry !== null && typeof entry === "object" && typeof (entry as Record<string, unknown>).message === "string"
        );
        if (first !== undefined) {
          return (first as Record<string, unknown>).message as string;
        }
      }
      for (const key of ["message", "reason", "error"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim() !== "") {
          return value;
        }
      }
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function restHttpError(
  status: number,
  bodyText: string,
  retryAfterHeader: string | null,
  path: string,
  secrets: ReadonlyArray<string | undefined>
): QlooUpstreamError {
  const detail = scrubSecrets(truncateText(extractUpstreamMessage(bodyText)), secrets);
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  const message = scrubSecrets(truncateText(`Qloo responded HTTP ${status} for ${path}: ${detail}`), secrets);
  const details: ApiErrorDetail[] = [{ path: "upstream", message: detail }];
  if (status === 429) {
    return new QlooUpstreamError("RATE_LIMITED", message, { retryable: true, retryAfterMs }, details);
  }
  if (status >= 500) {
    return new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", message, { retryable: true, retryAfterMs }, details);
  }
  if (status === 401) {
    return new QlooUpstreamError(
      "DEPENDENCY_UNAVAILABLE",
      `${message} — the configured credential was rejected`,
      { retryable: false },
      details
    );
  }
  if (status === 400 || status === 403) {
    return new QlooUpstreamError("VALIDATION_FAILED", message, { retryable: false }, details);
  }
  return new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", message, { retryable: false }, details);
}

export function networkError(
  error: unknown,
  path: string,
  options: { timedOut?: boolean; timeoutMs?: number; secrets: ReadonlyArray<string | undefined> }
): QlooUpstreamError {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = scrubSecrets(truncateText(raw), options.secrets);
  if (options.timedOut === true) {
    return new QlooUpstreamError(
      "DEPENDENCY_UNAVAILABLE",
      `Qloo request timed out after ${options.timeoutMs ?? 0}ms for ${path}`,
      { retryable: true },
      [{ path: "upstream", message: detail }]
    );
  }
  return new QlooUpstreamError("DEPENDENCY_UNAVAILABLE", `Qloo request failed for ${path}: ${detail}`, { retryable: true }, [
    { path: "upstream", message: detail }
  ]);
}

export function malformedResponse(path: string, detail: string, secrets: ReadonlyArray<string | undefined>): QlooUpstreamError {
  return new QlooUpstreamError(
    "DEPENDENCY_UNAVAILABLE",
    `Qloo returned an unexpected response for ${path}`,
    { retryable: false },
    [{ path: "upstream", message: scrubSecrets(truncateText(detail), secrets) }]
  );
}

export function missingQlooConfiguration(issues: ApiErrorDetail[]): ApiError {
  return new ApiError("SERVICE_UNAVAILABLE", "Qloo gateway is not configured for use", issues);
}
