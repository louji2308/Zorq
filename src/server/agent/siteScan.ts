import type { Brief } from "../../shared/brief.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { QlooGateway } from "../qloo/index.js";
import type { Ledger } from "./ledger.js";
import { executeToolCall } from "./tools.js";
import type { ObservationIndex } from "./pool.js";

const DEFAULT_START_RADIUS_M = 400;
const DEFAULT_MAX_RADIUS_M = 25_000;
const DEFAULT_TARGET_PLACES = 12;
const RADIUS_LADDER_M = [2_000, 10_000, 25_000] as const;
const SCAN_TAKE = 50;
const MESSAGE_PLACE_CAP = 30;

export interface SiteScanOptions {
  brief: Brief;
  gateway: QlooGateway;
  ledger: Ledger;
  index: ObservationIndex;
  now?: () => number;
  targetPlaces?: number;
  maxRadiusM?: number;
}

export interface SiteScanResult {
  observations: number;
  evidence: EvidenceRecord[];
  message: string;
  radii: number[];
  placeCount: number;
  scope: string;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function ladder(start: number, max: number): number[] {
  const radii = [start];
  for (const step of RADIUS_LADDER_M) {
    if (step > start && step <= max) {
      radii.push(step);
    }
  }
  return radii;
}

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scopeFor(radiusM: number): string {
  if (radiusM <= 500) {
    return "on-site (<=500 m)";
  }
  if (radiusM <= 2_000) {
    return "walking/neighborhood (<=2 km)";
  }
  if (radiusM <= 10_000) {
    return "district (<=10 km)";
  }
  return `regional (<=${Math.round(radiusM / 1_000)} km)`;
}

export async function runSiteScan(options: SiteScanOptions): Promise<SiteScanResult> {
  const { brief, gateway, ledger, index } = options;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const startRadius = positiveNumber(brief.radius, DEFAULT_START_RADIUS_M);
  const maxRadius = Math.max(startRadius, positiveNumber(options.maxRadiusM, DEFAULT_MAX_RADIUS_M));
  const targetPlaces = Math.max(1, options.targetPlaces ?? DEFAULT_TARGET_PLACES);
  const radii = brief.coordinates === undefined ? [startRadius] : ladder(startRadius, maxRadius);
  const evidence: EvidenceRecord[] = [];
  const observedRadii: number[] = [];
  let observations = 0;
  let failure: string | undefined;
  let finalRadius = startRadius;
  let queryScan = false;

  const places = () =>
    brief.coordinates !== undefined ? index.locatedEntities() : index.observedEntities();

  for (const radiusM of radii) {
    if (options.brief.coordinates !== undefined && index.locatedEntities().length >= targetPlaces) {
      break;
    }
    if (options.brief.coordinates === undefined && index.observedEntities().length >= targetPlaces) {
      break;
    }
    if (gateway.stats.budgetRemaining < 30) {
      failure = "Qloo budget reserve reached before the deterministic site scan";
      break;
    }

    const location =
      brief.coordinates !== undefined
        ? { point: brief.coordinates, radiusM }
        : { query: brief.location };
    queryScan = brief.coordinates === undefined;
    const call = {
      id: `site-scan-${observations + 1}`,
      name: "qloo_insights",
      arguments: JSON.stringify({
        filterType: "place",
        location,
        take: SCAN_TAKE
      })
    };

    try {
      const result = await executeToolCall({ gateway, call, ledger, now });
      observations += 1;
      observedRadii.push(radiusM);
      finalRadius = radiusM;
      index.record(result.envelope, result.evidence.id);
      evidence.push(result.evidence);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      break;
    }

    if (places().length >= targetPlaces) {
      break;
    }
  }

  const observed = [...places()];
  const placeCount = observed.length;
  const scope =
    observations === 0
      ? "unscanned"
      : queryScan
        ? "location-query (radius not verified)"
        : scopeFor(finalRadius);
  const header =
    observations > 0
      ? `Deterministic site scan (real Qloo place insights, not a model guess): ${observations} scan(s) at ${observedRadii.join(", ")} m returned ${placeCount} distinct place(s). Operational scope: ${scope}.`
      : `Deterministic site scan did not return usable places${failure !== undefined ? ` (${failure})` : ""}.`;
  const list = observed
    .slice(0, MESSAGE_PLACE_CAP)
    .map((place) => {
      const distance =
        brief.coordinates !== undefined && place.location !== null
          ? ` (~${haversineKm(brief.coordinates, place.location).toFixed(1)} km)`
          : "";
      return `- ${place.name ?? place.entityId} [${place.entityId}]${distance}`;
    })
    .join("\n");
  const guidance =
    observations === 0 || placeCount === 0
      ? "Do not invent local coverage. Widen deliberately with tools if useful, or stop with an explicit coverage gap."
      : `Treat these as observed evidence. Do not describe places beyond this ${scope} scope as on-site, and do not invent entities that are not listed.`;
  const message = [header, list.length > 0 ? list : undefined, guidance]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join("\n\n");

  ledger.append({
    kind: "Compute",
    label: "site.scan",
    summary:
      observations > 0
        ? `${placeCount} distinct place(s) from ${observations} scan(s); scope ${scope}`
        : `site scan produced no usable places${failure !== undefined ? `: ${failure}` : ""}`,
    duration: Math.max(0, now() - startedAt),
    cacheState: "n/a",
    resultCount: placeCount
  });

  return { observations, evidence, message, radii: observedRadii, placeCount, scope };
}
