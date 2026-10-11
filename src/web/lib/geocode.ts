/*
 * MapTiler forward geocoding for the S0 address search (no Qloo involved —
 * Product Spec §7 S0: "Agent/Qloo here: none until submit").
 *
 * Endpoint (verified against MapTiler docs 2026-10-10 and live traffic):
 *   GET https://api.maptiler.com/geocoding/{query}.json?key=KEY&limit=N&language=en
 * The query travels in the URL path; `q`/`text` query params are NOT the API.
 *
 * Contract:
 *  - The response is untrusted input (AGENTS §14): every feature is validated
 *    with Zod before it becomes a suggestion; malformed features are dropped,
 *    never coerced or guessed.
 *  - Failures are typed (GeocodeError), never silent and never fabricated.
 *  - The API key is public by design (VITE_ prefix, D-6.1) and is never logged.
 */
import { z } from "zod";

export interface GeocodeSuggestion {
  /** Provider feature id (stable enough for list keys, not persisted). */
  readonly id: string;
  /** Human label shown in the list; becomes Brief.location when selected. */
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
}

export type GeocodeErrorCode = "NETWORK" | "HTTP" | "BAD_RESPONSE";

export class GeocodeError extends Error {
  readonly code: GeocodeErrorCode;
  readonly status: number | undefined;

  constructor(code: GeocodeErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GeocodeError";
    this.code = code;
    this.status = status;
  }
}

export interface GeocodeOptions {
  apiKey: string;
  limit?: number;
  /** Injectable fetch for tests; defaults to same-origin global fetch. */
  fetchImpl?: typeof fetch;
}

export const GEOCODE_ENDPOINT = "https://api.maptiler.com/geocoding";

/** Build the forward-geocoding URL (query in the path, per the MapTiler API). */
export function geocodeUrl(query: string, options: GeocodeOptions): string {
  const limit = options.limit ?? 5;
  const params = new URLSearchParams({ key: options.apiKey, limit: String(limit), language: "en" });
  return `${GEOCODE_ENDPOINT}/${encodeURIComponent(query.trim())}.json?${params.toString()}`;
}

const featureSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  place_name: z.string().optional(),
  text: z.string().optional(),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).min(2)
  })
});

const collectionSchema = z.object({ features: z.array(z.unknown()) });

function toSuggestion(raw: unknown, index: number): GeocodeSuggestion | null {
  const parsed = featureSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { id, place_name: placeName, text, geometry } = parsed.data;
  const [lon, lat] = geometry.coordinates;
  if (lon === undefined || lat === undefined) return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  const label = (placeName ?? text ?? "").trim();
  if (label === "") return null;
  return {
    id: typeof id === "string" ? id : id === undefined ? `feature-${index}` : String(id),
    label,
    lat,
    lon
  };
}

/**
 * Forward-geocode an address. Resolves with validated suggestions (possibly
 * empty when nothing matched); rejects with GeocodeError on transport or
 * contract failure.
 */
export async function geocode(query: string, options: GeocodeOptions): Promise<GeocodeSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  const doFetch =
    options.fetchImpl ??
    ((input: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> =>
      globalThis.fetch(input, requestInit));

  let response: Response;
  try {
    response = await doFetch(geocodeUrl(trimmed, options), { method: "GET" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "geocode request failed";
    throw new GeocodeError("NETWORK", `geocode request failed: ${message}`);
  }

  if (!response.ok) {
    throw new GeocodeError("HTTP", `geocode responded with status ${response.status}`, response.status);
  }

  const raw = await response.text().catch(() => "");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new GeocodeError("BAD_RESPONSE", "geocode response was not valid JSON");
  }

  const parsed = collectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new GeocodeError("BAD_RESPONSE", "geocode response did not match the expected contract");
  }

  const suggestions: GeocodeSuggestion[] = [];
  parsed.data.features.forEach((feature, index) => {
    const suggestion = toSuggestion(feature, index);
    if (suggestion !== null) suggestions.push(suggestion);
  });
  return suggestions;
}
