/*
 * Honest copy for POST /api/runs failures on S0 (Product Spec §7 S0 error row;
 * Final Design §9). Pure and unit-tested (tests/web/s0Brief.test.ts).
 *
 * Rules:
 *  - Never invent a run id, a phase, or a success — if createRun threw, no run
 *    exists and the copy says so where it matters (Prior/LLM failure).
 *  - Server-provided field details (VALIDATION_FAILED) are surfaced verbatim
 *    under the matching field; nothing is rewritten to sound friendlier than
 *    the truth.
 */
import { ApiClientError } from "../../lib/api.js";
import type { ApiErrorDetail } from "../../../shared/errors.js";

export interface RunFailureView {
  readonly message: string;
  /** detail.path -> message, for details that match a known S0 field. */
  readonly fieldErrors: Readonly<Record<string, string>>;
}

/** Server validation detail paths that map to an S0 form field. */
const FIELD_PATH_KEYS: Readonly<Record<string, string>> = {
  location: "location",
  coordinates: "site",
  "coordinates.lat": "site",
  "coordinates.lon": "site",
  areaSqFt: "area",
  objective: "objective",
  constraints: "constraints",
  customConstraint: "customConstraint",
  admiredPlaces: "admiredPlaces",
  presetId: "location"
};

export function mapServerFieldErrors(details: readonly ApiErrorDetail[]): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const detail of details) {
    const key = FIELD_PATH_KEYS[detail.path];
    if (key !== undefined) mapped[key] = detail.message;
  }
  return mapped;
}

export function describeRunFailure(error: unknown): RunFailureView {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "VALIDATION_FAILED": {
        const details = error.details ?? [];
        return {
          message: "The server rejected this brief. Check the fields below.",
          fieldErrors: mapServerFieldErrors(details)
        };
      }
      case "RATE_LIMITED":
        return {
          message: "Too many investigations started in a row. Wait a moment, then try again.",
          fieldErrors: {}
        };
      case "NETWORK_ERROR":
        return {
          message: "We couldn't reach the server. Check your connection and try again.",
          fieldErrors: {}
        };
      case "DEPENDENCY_UNAVAILABLE":
        return {
          message:
            "The first guess couldn't be generated, so no run was created. Try again in a moment.",
          fieldErrors: {}
        };
      case "SERVICE_UNAVAILABLE":
        return {
          message: "The service isn't ready yet, so no run was created. Try again in a moment.",
          fieldErrors: {}
        };
      case "INVALID_RESPONSE":
        return {
          message: "The server replied in a shape we didn't expect. No run was created — try again.",
          fieldErrors: {}
        };
      default:
        return {
          message: `We couldn't start the investigation (the server reported ${error.code}). Try again.`,
          fieldErrors: {}
        };
    }
  }

  return {
    message: "We couldn't start the investigation. Try again.",
    fieldErrors: {}
  };
}
