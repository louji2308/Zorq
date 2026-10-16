import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/shared/brief.js";
import { blueprintSchema } from "../../src/shared/routes.js";
import { challengeReportSchema, type RunState } from "../../src/shared/run.js";
import {
  ApiClientError,
  challengeRun,
  createRun,
  getBlueprint,
  getRun,
  stopRun
} from "../../src/web/lib/api.js";

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

const TEST_CHALLENGE_REPORT = challengeReportSchema.parse({
  kind: "challenge",
  verdict: "Survived",
  reason: "the leader held against all five attacks",
  attackOrder: ["ablation", "substitution", "bridge", "catchment", "rival"],
  attackOrderSource: "diagnostic",
  rounds: 2,
  leaderBefore: {
    members: ["coffee", "cinema"],
    coherence: 0.7,
    percentile: 80,
    distinctivenessMean: 0.5,
    weakestLink: { a: "coffee", b: "cinema", value: 0.4 }
  },
  leaderAfter: {
    members: ["coffee", "cinema"],
    coherence: 0.7,
    percentile: 80,
    distinctivenessMean: 0.5,
    weakestLink: { a: "coffee", b: "cinema", value: 0.4 }
  },
  mutations: [],
  attacks: [
    { kind: "ablation", status: "measured", summary: "held without cinema", detail: "coherence stayed 0.68" },
    { kind: "substitution", status: "measured", summary: "no same-role alternative", detail: "pool had no fit" },
    { kind: "bridge", status: "measured", summary: "no bridge candidate", detail: "empty intersection" },
    { kind: "catchment", status: "measured", summary: "reading held", detail: "east shift only" },
    { kind: "rival", status: "measured", summary: "rival behind", detail: "coherence gap 0.06" }
  ],
  gradeCap: "A",
  generatedAt: "2026-10-15T00:00:00.000Z"
});

const TEST_BLUEPRINT = blueprintSchema.parse({
  title: "Cinema corner",
  rationale: "A micro-screening anchor [ev-1] beside the station.",
  narrativeSource: "llm",
  compositionByRole: [
    {
      role: "Anchor",
      members: [
        {
          memberId: "comp-cinema",
          name: "Micro-cinema",
          role: "Anchor",
          format: {
            typeDisplayName: "cinema",
            formatName: "micro-screening",
            footprintSqFtMin: 900,
            footprintSqFtMax: 1200,
            noiseClass: "quiet",
            open: "14:00",
            close: "23:00",
            downshiftedFrom: "cinema"
          },
          receipts: [{ kind: "path", text: "anchor → coffee → café", evidenceIds: ["ev-1"] }]
        }
      ]
    }
  ],
  fitToSite: {
    footprint: {
      areaSqFt: 5000,
      usableSqFt: 4250,
      totalFootprintSqFt: 3200,
      withinUsable: true,
      rule: "85% circulation rule"
    },
    hours: {
      timeline: [{ memberId: "comp-cinema", name: "Micro-cinema", open: "14:00", close: "23:00" }],
      constraintReads: [{ key: "lateNight", source: "from the brief" }]
    },
    downshifts: [
      { memberId: "comp-cinema", name: "Micro-cinema", sentence: "cinema becomes micro-screening" }
    ]
  },
  whatQlooChanged: {
    kept: [{ member: "Micro-cinema", evidenceIds: ["ev-1"] }],
    added: [],
    removed: [],
    reformatted: []
  },
  risks: [],
  evidenceGrade: { grade: "A", reasons: ["all members measured"], rule: "worst-of rule" },
  revisionHistory: [],
  methodUrl: "/method",
  shareUrl: "http://localhost:3000/run/run-1/blueprint?share=abc",
  generatedAt: "2026-10-12T00:00:00.000Z",
  expiresAt: "2026-11-11T00:00:00.000Z"
});

describe("s4/s5 api client", () => {
  it("challengeRun POSTs and returns the validated run plus report", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ run: TEST_RUN_STATE, report: TEST_CHALLENGE_REPORT })
    );

    const response = await challengeRun("run-1", {}, { fetchImpl });

    expect(response.report).toEqual(TEST_CHALLENGE_REPORT);
    expect(response.run).toEqual(TEST_RUN_STATE);
    expect(calls[0]?.url).toBe("/api/runs/run-1/challenge");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toEqual({ "content-type": "application/json" });
    expect(calls[0]?.init?.body).toBe(JSON.stringify({}));
  });

  it("challengeRun sends an optional focus and encodes the run id", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ run: TEST_RUN_STATE, report: TEST_CHALLENGE_REPORT })
    );

    await challengeRun("a/b c", { focus: "bridge" }, { fetchImpl });

    expect(calls[0]?.url).toBe("/api/runs/a%2Fb%20c/challenge");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ focus: "bridge" }));
  });

  it("challengeRun surfaces a server guard refusal as a typed CONFLICT error", async () => {
    const body = {
      error: {
        code: "CONFLICT",
        message: "run run-1 has no ranked composition to lead the challenge",
        requestId: "req-11"
      }
    };
    const { fetchImpl } = fakeFetch(async () => jsonResponse(body, 409));

    const error = await expectApiClientError(challengeRun("run-1", {}, { fetchImpl }));

    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
    expect(error.message).toBe(body.error.message);
  });

  it("challengeRun rejects a 2xx body that does not match the shared schema", async () => {
    const { fetchImpl } = fakeFetch(async () => jsonResponse({ run: TEST_RUN_STATE }));

    const error = await expectApiClientError(challengeRun("run-1", {}, { fetchImpl }));

    expect(error.code).toBe("INVALID_RESPONSE");
  });

  it("getBlueprint fetches and returns the validated blueprint", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ blueprint: TEST_BLUEPRINT })
    );

    const blueprint = await getBlueprint("run-1", undefined, { fetchImpl });

    expect(blueprint).toEqual(TEST_BLUEPRINT);
    expect(calls[0]?.url).toBe("/api/runs/run-1/blueprint");
    expect(calls[0]?.init).toBeUndefined();
  });

  it("getBlueprint encodes the optional share token as a query parameter", async () => {
    const { fetchImpl, calls } = fakeFetch(async () =>
      jsonResponse({ blueprint: TEST_BLUEPRINT })
    );

    await getBlueprint("run-1", "a b&c", { fetchImpl });

    expect(calls[0]?.url).toBe("/api/runs/run-1/blueprint?share=a%20b%26c");
  });

  it("getBlueprint maps an expired snapshot to its typed error", async () => {
    const body = {
      error: {
        code: "SNAPSHOT_EXPIRED",
        message: "This snapshot has expired.",
        requestId: "req-12"
      }
    };
    const { fetchImpl } = fakeFetch(async () => jsonResponse(body, 410));

    const error = await expectApiClientError(getBlueprint("run-1", "abc", { fetchImpl }));

    expect(error.code).toBe("SNAPSHOT_EXPIRED");
    expect(error.status).toBe(410);
    expect(error.message).toBe(body.error.message);
  });
});
