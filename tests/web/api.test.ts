import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/shared/brief.js";
import type { RunState } from "../../src/shared/run.js";
import { ApiClientError, createRun, getRun, stopRun } from "../../src/web/lib/api.js";

const TEST_BRIEF: Brief = {
  location: "Broadway & 7th, Los Angeles",
  objective: "Late-night cinema bar"
};

const TEST_PRIOR = {
  composition: { note: "fixture prior" },
  generatedAt: "2026-10-10T00:00:00.000Z",
  model: "deepseek-chat",
  qlooUsed: false as const
};

const TEST_RUN_STATE: RunState = {
  id: "run-1",
  status: "prior_pending",
  phase: "prior",
  brief: TEST_BRIEF,
  prior: TEST_PRIOR
};

const TEST_CREATED_RUN: RunState = TEST_RUN_STATE;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function fakeFetch(handler: FetchHandler): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return handler(input, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function expectApiClientError(promise: Promise<unknown>): Promise<ApiClientError> {
  return promise.then(
    () => {
      throw new Error("expected the call to reject with ApiClientError");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ApiClientError);
      return error as ApiClientError;
    }
  );
}

describe("api client", () => {
  it("createRun posts the brief as JSON and returns the validated created run", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ run: TEST_CREATED_RUN }, 201)
    );

    const run = await createRun(TEST_BRIEF, { fetchImpl });

    expect(run).toEqual(TEST_CREATED_RUN);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/runs");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toEqual({ "content-type": "application/json" });
    expect(calls[0]?.init?.body).toBe(JSON.stringify(TEST_BRIEF));
  });

  it("getRun fetches the run by id and returns the validated projection", async () => {
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ run: TEST_RUN_STATE }));

    const run = await getRun("run-1", { fetchImpl });

    expect(run).toEqual(TEST_RUN_STATE);
    expect(calls[0]?.url).toBe("/api/runs/run-1");
    expect(calls[0]?.init).toBeUndefined();
  });

  it("getRun encodes the run id in the path", async () => {
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ run: TEST_RUN_STATE }));

    await getRun("a/b c", { fetchImpl });

    expect(calls[0]?.url).toBe("/api/runs/a%2Fb%20c");
  });

  it("stopRun posts the optional reason and returns the stopped run", async () => {
    const stopped: RunState = { ...TEST_RUN_STATE, status: "stopped" };
    const { fetchImpl, calls } = fakeFetch(async () => jsonResponse({ run: stopped }));

    const run = await stopRun("run-1", "not the right site", { fetchImpl });

    expect(run).toEqual(stopped);
    expect(calls[0]?.url).toBe("/api/runs/run-1/stop");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ reason: "not the right site" }));
  });

  it("stopRun without a reason posts an empty object body", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ run: { ...TEST_RUN_STATE, status: "stopped" } })
    );

    await stopRun("run-1", undefined, { fetchImpl });

    expect(calls[0]?.init?.body).toBe(JSON.stringify({}));
  });

  it("maps a typed 503 SERVICE_UNAVAILABLE body onto ApiClientError with status preserved", async () => {
    const body = {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "The method content endpoint is not implemented yet.",
        requestId: "req-7"
      }
    };
    const { fetchImpl } = fakeFetch(async () => jsonResponse(body, 503));

    const error = await expectApiClientError(getRun("run-1", { fetchImpl }));

    expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.status).toBe(503);
    expect(error.requestId).toBe("req-7");
    expect(error.message).toBe(body.error.message);
  });

  it("maps a typed 429 RATE_LIMITED body including details", async () => {
    const body = {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests",
        details: [{ path: "ip", message: "try again in 15 minutes" }],
        requestId: "req-9"
      }
    };
    const { fetchImpl } = fakeFetch(async () => jsonResponse(body, 429));

    const error = await expectApiClientError(stopRun("run-1", "stop", { fetchImpl }));

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(error.details).toEqual(body.error.details);
  });

  it("maps RUN_NOT_FOUND with its status and requestId", async () => {
    const body = {
      error: { code: "RUN_NOT_FOUND", message: "run not found: nope", requestId: "req-404" }
    };
    const { fetchImpl } = fakeFetch(async () => jsonResponse(body, 404));

    const error = await expectApiClientError(getRun("nope", { fetchImpl }));

    expect(error.code).toBe("RUN_NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.requestId).toBe("req-404");
  });

  it("surfaces an untyped error body as INVALID_RESPONSE while preserving the status", async () => {
    const { fetchImpl } = fakeFetch(
      async () => new Response("<html>Bad Gateway</html>", { status: 502 })
    );

    const error = await expectApiClientError(getRun("run-1", { fetchImpl }));

    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.status).toBe(502);
  });

  it("surfaces a network failure as NETWORK_ERROR with status 0", async () => {
    const { fetchImpl } = fakeFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const error = await expectApiClientError(getRun("run-1", { fetchImpl }));

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(0);
    expect(error.message).toContain("fetch failed");
  });

  it("rejects a 2xx body that does not match the shared schema", async () => {
    const { fetchImpl } = fakeFetch(async () => jsonResponse({ run: { id: "run-1" } }));

    const error = await expectApiClientError(getRun("run-1", { fetchImpl }));

    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.status).toBe(200);
  });

  it("rejects a 2xx response with a malformed JSON body", async () => {
    const { fetchImpl } = fakeFetch(
      async () => new Response("{not json", { status: 200, headers: { "content-type": "application/json" } })
    );

    const error = await expectApiClientError(createRun(TEST_BRIEF, { fetchImpl }));

    expect(error.code).toBe("INVALID_RESPONSE");
  });
});
