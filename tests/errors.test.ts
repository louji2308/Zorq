import { describe, expect, it } from "vitest";
import {
  ApiError,
  apiErrorBodySchema,
  apiErrorCodes,
  apiErrorStatus,
  toApiErrorBody,
  validationFailed,
  zodIssuesToDetails
} from "../src/shared/errors.js";

describe("typed error model", () => {
  it("serializes an ApiError to the exact §3.0 body shape", () => {
    const err = new ApiError("RUN_NOT_FOUND", "run 42 does not exist");
    const body = err.toBody("req-1");
    expect(body).toEqual({
      error: {
        code: "RUN_NOT_FOUND",
        message: "run 42 does not exist",
        requestId: "req-1"
      }
    });
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
    expect(err.status).toBe(404);
  });

  it("round-trips a detailed VALIDATION_FAILED body through the schema", () => {
    const err = validationFailed([
      { path: ["brief", "areaSqFt"], message: "expected number" },
      { path: ["brief", "objective"], message: "too long" }
    ]);
    const body = err.toBody("req-2");
    const parsed = apiErrorBodySchema.parse(body);
    expect(parsed).toEqual(body);
    expect(parsed.error.details).toEqual([
      { path: "brief.areaSqFt", message: "expected number" },
      { path: "brief.objective", message: "too long" }
    ]);
    expect(err.status).toBe(400);
  });

  it("maps every documented code to its documented HTTP status", () => {
    expect(apiErrorCodes).toEqual([
      "VALIDATION_FAILED",
      "RUN_NOT_FOUND",
      "SNAPSHOT_EXPIRED",
      "CONFLICT",
      "UNKNOWN_ENTITY",
      "RATE_LIMITED",
      "DEPENDENCY_UNAVAILABLE",
      "SERVICE_UNAVAILABLE",
      "INTERNAL"
    ]);
    expect(apiErrorStatus).toEqual({
      VALIDATION_FAILED: 400,
      RUN_NOT_FOUND: 404,
      SNAPSHOT_EXPIRED: 410,
      CONFLICT: 409,
      UNKNOWN_ENTITY: 422,
      RATE_LIMITED: 429,
      DEPENDENCY_UNAVAILABLE: 502,
      SERVICE_UNAVAILABLE: 503,
      INTERNAL: 500
    });
    for (const code of apiErrorCodes) {
      expect(apiErrorStatus[code]).toBeGreaterThanOrEqual(400);
      expect(apiErrorStatus[code]).toBeLessThan(600);
    }
  });

  it("converts Zod issues to dotted-path details", () => {
    expect(zodIssuesToDetails([{ path: ["brief", 0, "areaSqFt"], message: "expected number" }])).toEqual([
      { path: "brief.0.areaSqFt", message: "expected number" }
    ]);
  });

  it("never leaks the original message of an unknown error", () => {
    const body = toApiErrorBody(new Error("QLOO_API_KEY hunter2"), "req-3");
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(apiErrorBodySchema.parse(body)).toEqual(body);
  });

  it("rejects an unknown error code", () => {
    expect(
      apiErrorBodySchema.safeParse({
        error: { code: "TEAPOT", message: "x", requestId: "r" }
      }).success
    ).toBe(false);
  });
});
