/*
 * S0 — POST /api/runs failure copy (Product Spec §7 S0 error row; Final
 * Design §9). The client path is exercised end to end with an injected fetch so
 * the ApiClientError -> RunFailureView mapping is proven, not simulated.
 *
 * Rule under test: a failed createRun never yields a run id, and the copy never
 * pretends one exists.
 */
import { describe, expect, it } from "vitest";
import type { Brief } from "../../src/shared/brief.js";
import { ApiClientError, createRun } from "../../src/web/lib/api.js";
import {
  describeRunFailure,
  mapServerFieldErrors,
  type RunFailureView
} from "../../src/web/screens/s0/runFailure.js";

const BRIEF: Brief = {
  location: "Crosby Street, Manhattan, New York 10012, United States",
  objective: "A ground-floor place where downtown locals and visitors both feel they belong."
};

const SERVER_RUN = {
  id: "run-server-9",
  status: "prior_pending",
  phase: "prior",
  brief: BRIEF,
  prior: {
    composition: { note: "fixture prior" },
    generatedAt: "2026-10-10T00:00:00.000Z",
    model: "deepseek-chat",
    qlooUsed: false as const
  }
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function fetchReturning(body: unknown, status: number): typeof fetch {
  return (async (): Promise<Response> => jsonResponse(body, status)) as typeof fetch;
}

async function expectRunFailure(promise: Promise<unknown>): Promise<RunFailureView> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiClientError);
    return describeRunFailure(error);
  }
  throw new Error("expected createRun to reject");
}

describe("S0 createRun failure mapping", () => {
  it("returns the server's run id on success (the only id the screen ever uses)", async () => {
    const run = await createRun(BRIEF, { fetchImpl: fetchReturning({ run: SERVER_RUN }, 201) });

    expect(run.id).toBe("run-server-9");
    expect(run).toEqual(SERVER_RUN);
  });

  it("surfaces VALIDATION_FAILED as a rejection with server field details intact", async () => {
    const body = {
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        details: [
          { path: "objective", message: "Too small: expected string to have >=1 characters" },
          { path: "coordinates.lat", message: "Invalid input: expected number, received nan" }
        ],
        requestId: "req-1"
      }
    };

    const view = await expectRunFailure(createRun(BRIEF, { fetchImpl: fetchReturning(body, 400) }));

    expect(view.message).toBe("The server rejected this brief. Check the fields below.");
    expect(view.fieldErrors).toEqual({
      objective: "Too small: expected string to have >=1 characters",
      site: "Invalid input: expected number, received nan"
    });
    expect(view.message).not.toContain("run-");
  });

  it("maps every S0-relevant validation path onto its form field", () => {
    expect(
      mapServerFieldErrors([
        { path: "location", message: "required" },
        { path: "coordinates", message: "invalid" },
        { path: "coordinates.lat", message: "invalid lat" },
        { path: "coordinates.lon", message: "invalid lon" },
        { path: "areaSqFt", message: "must be positive" },
        { path: "objective", message: "too long" },
        { path: "admiredPlaces", message: "at most 3" },
        { path: "presetId", message: "unknown preset" },
        { path: "unmapped.path", message: "ignored" }
      ])
    ).toEqual({
      location: "unknown preset",
      site: "invalid lon",
      area: "must be positive",
      objective: "too long",
      admiredPlaces: "at most 3"
    });
  });

  it("keeps only the last detail when two details target the same field", () => {
    expect(
      mapServerFieldErrors([
        { path: "coordinates.lat", message: "first" },
        { path: "coordinates.lon", message: "second" }
      ])
    ).toEqual({ site: "second" });
  });

  it("maps RATE_LIMITED onto honest retry copy with no field errors", async () => {
    const body = {
      error: { code: "RATE_LIMITED", message: "Too many requests", requestId: "req-9" }
    };

    const view = await expectRunFailure(createRun(BRIEF, { fetchImpl: fetchReturning(body, 429) }));

    expect(view.message).toBe(
      "Too many investigations started in a row. Wait a moment, then try again."
    );
    expect(view.fieldErrors).toEqual({});
    expect(view.message).not.toContain("run-");
  });

  it("maps a transport failure onto couldn't-reach-server copy", async () => {
    const fetchImpl = (async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const view = await expectRunFailure(createRun(BRIEF, { fetchImpl }));

    expect(view.message).toBe(
      "We couldn't reach the server. Check your connection and try again."
    );
    expect(view.fieldErrors).toEqual({});
    expect(view.message).not.toContain("run-");
  });

  it("states that no run was created when the Prior could not be generated", async () => {
    const body = {
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "LLM unavailable",
        requestId: "req-502"
      }
    };

    const view = await expectRunFailure(createRun(BRIEF, { fetchImpl: fetchReturning(body, 502) }));

    expect(view.message).toContain("no run was created");
    expect(view.fieldErrors).toEqual({});
  });

  it("falls back to generic honest copy for an unknown error shape", () => {
    const view = describeRunFailure(new Error("something else entirely"));

    expect(view.message).toBe("We couldn't start the investigation. Try again.");
    expect(view.fieldErrors).toEqual({});
    expect(view.message).not.toContain("run-");
  });
});
