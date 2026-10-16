/*
 * Typed same-origin API client for the real Phase 5—8 routes:
 *   POST /api/runs              -> create a Run (201 { run: created run })
 *   GET  /api/runs/:id          -> canonical RunState (200 { run })
 *   POST /api/runs/:id/stop     -> stop a run (200 { run })
 *   POST /api/runs/:id/replace  -> role-preserving replacement (200 ReplaceResponse)
 *   POST /api/runs/:id/challenge -> S4 challenge pass (200 { run, report })
 *   GET  /api/runs/:id/blueprint -> Place Blueprint, ?share= optional (200 { blueprint })
 * (GET /api/runs/:id/events is SSE — owned by ./sse.ts, the single stream owner.)
 *
 * Contract:
 *  - Every success body is validated with the shared Zod schemas before it is
 *    returned; a mismatch surfaces as ApiClientError("INVALID_RESPONSE") rather
 *    than a silently wrong object.
 *  - Non-2xx responses are mapped to ApiClientError, preserving the HTTP status
 *    and the typed error body ({ error: { code, message, requestId? } }) from
 *    src/shared/errors.ts. Untyped error bodies (e.g. a proxy HTML page) become
 *    ApiClientError("INVALID_RESPONSE") with the status preserved — never hidden.
 *  - The remaining API routes currently answer 503 SERVICE_UNAVAILABLE; that
 *    code flows through unchanged so screens can surface it honestly.
 *  - No secrets, no credentials, no logging: paths are same-origin, bodies are
 *    the caller's own data, and nothing is echoed to the console.
 */
import type { Brief } from "../../shared/brief.js";
import {
  apiErrorBodySchema,
  type ApiErrorDetail,
  type ApiErrorCode
} from "../../shared/errors.js";
import {
  blueprintResponseSchema,
  challengeResponseSchema,
  postRunsResponseSchema,
  replaceResponseSchema,
  runResponseSchema,
  type Blueprint,
  type ChallengeRequest,
  type ChallengeResponse,
  type PostRunsResponse,
  type ReplaceRequest,
  type ReplaceResponse
} from "../../shared/routes.js";
import type { RunState } from "../../shared/run.js";

/** Error codes the client can produce: the server's typed codes plus two
 *  transport/contract codes the server can never send. */
export type ApiClientErrorCode = ApiErrorCode | "NETWORK_ERROR" | "INVALID_RESPONSE";

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode;
  readonly status: number;
  readonly requestId: string | undefined;
  readonly details: ApiErrorDetail[] | undefined;

  constructor(
    code: ApiClientErrorCode,
    message: string,
    status: number,
    requestId?: string,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

/** The created run carries the frozen brief + Prior (createdRunSchema). */
export type CreatedRun = PostRunsResponse["run"];

export interface ApiCallOptions {
  /** Injectable fetch for tests; defaults to same-origin global fetch. */
  fetchImpl?: typeof fetch;
}

interface JsonResponse {
  status: number;
  body: unknown;
}

async function requestJson(
  path: string,
  init: RequestInit | undefined,
  options: ApiCallOptions | undefined
): Promise<JsonResponse> {
  const doFetch =
    options?.fetchImpl ??
    ((input: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> =>
      globalThis.fetch(input, requestInit));

  let response: Response;
  try {
    response = await doFetch(path, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "network request failed";
    throw new ApiClientError("NETWORK_ERROR", `network request failed: ${message}`, 0);
  }

  const raw = await response.text().catch(() => "");
  let parsedBody: unknown;
  let jsonMalformed = false;
  try {
    parsedBody = raw === "" ? undefined : JSON.parse(raw);
  } catch {
    jsonMalformed = true;
  }

  if (!response.ok) {
    const typed = apiErrorBodySchema.safeParse(parsedBody);
    if (typed.success) {
      throw new ApiClientError(
        typed.data.error.code,
        typed.data.error.message,
        response.status,
        typed.data.error.requestId,
        typed.data.error.details
      );
    }
    throw new ApiClientError(
      "INVALID_RESPONSE",
      `request failed with status ${response.status} and a non-typed error body`,
      response.status
    );
  }

  if (jsonMalformed || parsedBody === undefined) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      `expected a JSON body from ${path}, received none that parses`,
      response.status
    );
  }
  return { status: response.status, body: parsedBody };
}

/** Create a Run from a brief. Returns the created run (brief + frozen Prior). */
export async function createRun(brief: Brief, options?: ApiCallOptions): Promise<CreatedRun> {
  const response = await requestJson(
    "/api/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(brief)
    },
    options
  );
  const parsed = postRunsResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "POST /api/runs response did not match the expected contract",
      response.status
    );
  }
  return parsed.data.run;
}

/** Read the canonical RunState projection. */
export async function getRun(id: string, options?: ApiCallOptions): Promise<RunState> {
  const response = await requestJson(`/api/runs/${encodeURIComponent(id)}`, undefined, options);
  const parsed = runResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "GET /api/runs/:id response did not match the expected contract",
      response.status
    );
  }
  return parsed.data.run;
}

/** Cooperatively stop a run. Returns the stopped run projection. */
export async function stopRun(
  id: string,
  reason?: string,
  options?: ApiCallOptions
): Promise<RunState> {
  const response = await requestJson(
    `/api/runs/${encodeURIComponent(id)}/stop`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reason === undefined ? {} : { reason })
    },
    options
  );
  const parsed = runResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "POST /api/runs/:id/stop response did not match the expected contract",
      response.status
    );
  }
  return parsed.data.run;
}

/** Role-preserving replacement. Returns the full ReplaceResponse projection. */
export async function replaceComponent(
  id: string,
  request: ReplaceRequest,
  options?: ApiCallOptions
): Promise<ReplaceResponse> {
  const response = await requestJson(
    `/api/runs/${encodeURIComponent(id)}/replace`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    },
    options
  );
  const parsed = replaceResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "POST /api/runs/:id/replace response did not match the expected contract",
      response.status
    );
  }
  return parsed.data;
}

/** Synchronous S4 challenge pass. Returns the run projection plus the report. */
export async function challengeRun(
  id: string,
  request: ChallengeRequest = {},
  options?: ApiCallOptions
): Promise<ChallengeResponse> {
  const response = await requestJson(
    `/api/runs/${encodeURIComponent(id)}/challenge`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    },
    options
  );
  const parsed = challengeResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "POST /api/runs/:id/challenge response did not match the expected contract",
      response.status
    );
  }
  return parsed.data;
}

/** Evidence-bound Place Blueprint, optionally read through a share token. */
export async function getBlueprint(
  id: string,
  share?: string,
  options?: ApiCallOptions
): Promise<Blueprint> {
  const query = share === undefined || share === "" ? "" : `?share=${encodeURIComponent(share)}`;
  const response = await requestJson(
    `/api/runs/${encodeURIComponent(id)}/blueprint${query}`,
    undefined,
    options
  );
  const parsed = blueprintResponseSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "GET /api/runs/:id/blueprint response did not match the expected contract",
      response.status
    );
  }
  return parsed.data.blueprint;
}
