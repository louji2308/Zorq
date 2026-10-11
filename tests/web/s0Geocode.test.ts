/*
 * S0 address search — MapTiler forward geocoding with an injected fetch.
 *
 * The provider response is untrusted input (AGENTS §14): malformed features are
 * dropped, never coerced or guessed, and every transport/contract failure is a
 * typed GeocodeError. No network is touched and no Qloo endpoint is ever
 * involved in browser geocoding (AGENTS §1: the QLOO key never reaches the
 * bundle).
 */
import { describe, expect, it } from "vitest";
import {
  GEOCODE_ENDPOINT,
  GeocodeError,
  geocode,
  geocodeUrl
} from "../../src/web/lib/geocode.js";

const API_KEY = "public-maptiler-key";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

interface Call {
  url: string;
}

function fetchCapturing(response: Response | (() => Promise<Response>)): {
  fetchImpl: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    calls.push({ url: String(input) });
    return typeof response === "function" ? response() : response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function feature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "abc-1",
    place_name: "Crosby Street, New York, United States",
    geometry: { type: "Point", coordinates: [-73.9963, 40.7247] },
    ...overrides
  };
}

async function expectGeocodeError(promise: Promise<unknown>): Promise<GeocodeError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GeocodeError);
    return error as GeocodeError;
  }
  throw new Error("expected geocode to reject with GeocodeError");
}

describe("geocode request shape", () => {
  it("puts the query in the path and the public key in the query string", () => {
    const url = new URL(geocodeUrl("Crosby St & Prince St", { apiKey: API_KEY, limit: 5 }));

    expect(`${url.origin}${url.pathname}`).toBe(
      `${GEOCODE_ENDPOINT}/Crosby%20St%20%26%20Prince%20St.json`
    );
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.host).toBe("api.maptiler.com");
    expect(url.href).not.toMatch(/qloo/i);
  });

  it("resolves an empty query to no suggestions without calling the provider", async () => {
    const { fetchImpl, calls } = fetchCapturing(jsonResponse({ features: [] }));

    await expect(geocode("   ", { apiKey: API_KEY, fetchImpl })).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("geocode response validation", () => {
  it("returns validated suggestions from a well-formed response", async () => {
    const { fetchImpl, calls } = fetchCapturing(
      jsonResponse({
        features: [
          feature(),
          feature({ id: 2, text: "Crosby Street", place_name: undefined }),
          feature({ id: "xyz", place_name: "  Crosby St, New York  " })
        ]
      })
    );

    const suggestions = await geocode("crosby street", { apiKey: API_KEY, fetchImpl, limit: 5 });

    expect(suggestions).toEqual([
      { id: "abc-1", label: "Crosby Street, New York, United States", lat: 40.7247, lon: -73.9963 },
      { id: "2", label: "Crosby Street", lat: 40.7247, lon: -73.9963 },
      { id: "xyz", label: "Crosby St, New York", lat: 40.7247, lon: -73.9963 }
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("crosby%20street");
  });

  it("drops malformed features instead of coercing or guessing them", async () => {
    const { fetchImpl } = fetchCapturing(
      jsonResponse({
        features: [
          feature(),
          feature({ geometry: undefined }),
          feature({ geometry: { type: "Point", coordinates: ["-73.9", "40.7"] } }),
          feature({ geometry: { type: "Point", coordinates: [-73.9963] } }),
          feature({ geometry: { type: "Point", coordinates: [Number.NaN, 40.7247] } }),
          feature({ geometry: { type: "Point", coordinates: [-730, 40.7247] } }),
          feature({ geometry: { type: "Point", coordinates: [-73.9963, 95] } }),
          feature({ place_name: "", text: "   " })
        ]
      })
    );

    const suggestions = await geocode("crosby street", { apiKey: API_KEY, fetchImpl });

    expect(suggestions).toEqual([
      { id: "abc-1", label: "Crosby Street, New York, United States", lat: 40.7247, lon: -73.9963 }
    ]);
  });

  it("synthesises a list key when the provider omits an id", async () => {
    const { fetchImpl } = fetchCapturing(jsonResponse({ features: [feature({ id: undefined })] }));

    const suggestions = await geocode("crosby street", { apiKey: API_KEY, fetchImpl });

    expect(suggestions[0]?.id).toBe("feature-0");
  });

  it("returns no suggestions when the feature list is empty", async () => {
    const { fetchImpl } = fetchCapturing(jsonResponse({ features: [] }));

    await expect(geocode("nowhere at all", { apiKey: API_KEY, fetchImpl })).resolves.toEqual([]);
  });
});

describe("geocode failures are typed, never silent", () => {
  it("reports a transport failure as NETWORK", async () => {
    const fetchImpl = (async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const error = await expectGeocodeError(geocode("crosby street", { apiKey: API_KEY, fetchImpl }));

    expect(error.code).toBe("NETWORK");
    expect(error.message).toContain("fetch failed");
  });

  it("reports a non-2xx response as HTTP with the status preserved", async () => {
    const { fetchImpl } = fetchCapturing(jsonResponse({ error: "invalid key" }, 403));

    const error = await expectGeocodeError(geocode("crosby street", { apiKey: API_KEY, fetchImpl }));

    expect(error.code).toBe("HTTP");
    expect(error.status).toBe(403);
  });

  it("reports a non-JSON body as BAD_RESPONSE", async () => {
    const { fetchImpl } = fetchCapturing(jsonResponse("<html>nope</html>"));

    const error = await expectGeocodeError(geocode("crosby street", { apiKey: API_KEY, fetchImpl }));

    expect(error.code).toBe("BAD_RESPONSE");
  });

  it("reports a JSON body without a feature list as BAD_RESPONSE", async () => {
    const { fetchImpl } = fetchCapturing(jsonResponse({ results: [] }));

    const error = await expectGeocodeError(geocode("crosby street", { apiKey: API_KEY, fetchImpl }));

    expect(error.code).toBe("BAD_RESPONSE");
    expect(error.message).toContain("did not match the expected contract");
  });
});
