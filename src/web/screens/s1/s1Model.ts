/*
 * S1 Investigate — pure view-model layer (no DOM, no network, no React).
 *
 * Honesty rules encoded here (AGENTS §12/§13):
 *  - Every model is built from the server's own RunState / LedgerEvent fields.
 *    Nothing is invented: missing data becomes null/[] and the UI degrades.
 *  - `ledgerEventSchema` (src/shared/events.ts) carries exactly
 *    { kind, label, summary, duration, cacheState, resultCount }. Endpoint,
 *    parameters, decision cards and retry counters are NOT in the schema, so
 *    they are never fabricated; `parameters` support below is defence-in-depth
 *    that only renders if a future schema actually delivers it (redacted).
 *  - `prior.composition` is LLM-authored unknown — extracted defensively,
 *    never re-authored. Missing prior -> null model -> honest loading state.
 *  - `culturalDna` / `siteRead` / `compositions` are unknown placeholders
 *    (D-5.4); parsers accept a recognisable shape or return [].
 *  - Plain-language labels map from REAL technical labels (qloo_insights,
 *    prior:generate …). Unmapped labels render verbatim — interpretation of
 *    real events, not fabrication.
 */
import { isResumableRunStatus } from "../../lib/sse.js";
import type { LedgerEvent } from "../../../shared/events.js";
import type { RunState } from "../../../shared/run.js";

/* ------------------------------------------------------------------ *
 * Prior card
 * ------------------------------------------------------------------ */

export interface PriorComponent {
  readonly label: string;
  readonly detail: string | null;
}

export interface PriorCardModel {
  readonly heading: "Before looking";
  readonly lockedAtIso: string;
  readonly lockedAtLabel: string;
  readonly components: readonly PriorComponent[];
  readonly footer: "No cultural data used.";
  readonly model: string;
}

const PRIOR_COMPONENT_CAP = 12;
const PRIOR_DETAIL_CAP = 240;

function prettifyKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced === "" ? key : spaced;
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > PRIOR_DETAIL_CAP ? `${trimmed.slice(0, PRIOR_DETAIL_CAP - 3)}...` : trimmed;
}

function isNamedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nameOf(value: Record<string, unknown>): string | null {
  for (const key of ["name", "title", "label"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return clip(candidate);
    }
  }
  return null;
}

/**
 * Defensively extract displayable components from the LLM-authored Prior
 * composition. The Prior prompt (src/server/agent/prior.ts) asks for a thesis
 * plus members grouped by role keys, so extraction follows the composition's
 * own structure:
 *  - a string value ("thesis", "Experience") becomes label + detail;
 *  - every role key becomes a labelled entry whose detail is that role's
 *    rationale (for arrays: the first available member rationale);
 *  - each member keeps its own entry with its own rationale (or none);
 *  - dedup by lowercase label, capped at PRIOR_COMPONENT_CAP, object key
 *    order preserved. Junk input degrades to [] — never a friendlier fiction.
 */
export function extractPriorComponents(composition: unknown): PriorComponent[] {
  if (!isNamedRecord(composition)) {
    return [];
  }
  const out: PriorComponent[] = [];
  const seen = new Set<string>();

  const push = (label: string, detail: string | null): void => {
    const key = label.toLowerCase();
    if (label === "" || seen.has(key) || out.length >= PRIOR_COMPONENT_CAP) {
      return;
    }
    seen.add(key);
    out.push({ label, detail });
  };

  const rationaleOf = (value: Record<string, unknown>): string | null => {
    const raw = value.rationale;
    if (typeof raw !== "string") {
      return null;
    }
    const detail = clip(raw);
    return detail === "" ? null : detail;
  };

  for (const [rawKey, value] of Object.entries(composition)) {
    if (out.length >= PRIOR_COMPONENT_CAP) break;
    const key = prettifyKey(rawKey);
    if (typeof value === "string") {
      const detail = clip(value);
      if (detail !== "") push(key, detail);
      continue;
    }
    if (Array.isArray(value)) {
      let roleDetail: string | null = null;
      const members: PriorComponent[] = [];
      for (const item of value) {
        if (typeof item === "string") {
          const label = clip(item);
          if (label !== "") members.push({ label, detail: null });
          continue;
        }
        if (isNamedRecord(item)) {
          const rationale = rationaleOf(item);
          if (roleDetail === null && rationale !== null) {
            roleDetail = rationale;
          }
          const name = nameOf(item);
          if (name !== null) {
            members.push({ label: name, detail: rationale });
          }
        }
      }
      push(key, roleDetail);
      for (const member of members) {
        if (out.length >= PRIOR_COMPONENT_CAP) break;
        push(member.label, member.detail);
      }
      continue;
    }
    if (isNamedRecord(value)) {
      const detail = rationaleOf(value);
      push(key, detail);
      const name = nameOf(value);
      if (name !== null) {
        push(name, detail);
      }
    }
  }
  return out;
}

function formatLockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** null when the run has no persisted Prior — the UI must then show the
 *  honest loading/not-ready state, never a fabricated prior. */
export function buildPriorModel(run: RunState | null): PriorCardModel | null {
  if (run === null || run.prior === undefined) {
    return null;
  }
  return {
    heading: "Before looking",
    lockedAtIso: run.prior.generatedAt,
    lockedAtLabel: formatLockTime(run.prior.generatedAt),
    components: extractPriorComponents(run.prior.composition),
    footer: "No cultural data used.",
    model: run.prior.model
  };
}

/* ------------------------------------------------------------------ *
 * Ledger rows
 * ------------------------------------------------------------------ */

export interface LedgerRowParameters {
  readonly [key: string]: unknown;
}

export interface LedgerRowModel {
  readonly sequence: number;
  readonly kind: "Qloo" | "Compute" | "LLM";
  readonly label: string;
  readonly technicalLabel: string;
  readonly summary: string;
  readonly durationLabel: string;
  /** "Live" | "From cache" | null when the server sent cacheState "n/a". */
  readonly cacheLabel: string | null;
  readonly resultCount: number;
  /** Dashed state circle (never colour-only meaning). */
  readonly dashed: boolean;
  /** Extra honest wording shown with a dashed row. */
  readonly note: string | null;
  /** Defence-in-depth: only present if a future event schema carries it. */
  readonly parameters: LedgerRowParameters | null;
}

/** Ledger rows arrive as { sequence, event } from the store. */
export interface LedgerRowInput {
  readonly sequence: number;
  readonly event: LedgerEvent;
}

const SENSITIVE_KEY = /^(api[-_ ]?key|key|token|secret|authorization|password|credential|access[-_ ]?token)$/i;
export const REDACTED = "[redacted]";

/** Recursively replace values under key-like names. Applied to any
 *  parameters-shaped data before it can reach the DOM. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (isNamedRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, depth + 1);
    }
    return out;
  }
  return value;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function plainLabel(event: LedgerEvent): string {
  const known: Record<string, string> = {
    qloo_capabilities: "Checked that Qloo is reachable",
    qloo_search: "Searched Qloo for candidate entities",
    qloo_resolve_tags: "Resolved concepts to Qloo tags",
    qloo_insights: "Read local culture signals around the site",
    qloo_describe: "Inspected a single entity in detail",
    qloo_bridge: "Looked for an entity that bridges two signals",
    qloo_replace: "Searched a role-preserving replacement",
    qloo_triangulate: "Re-measured a relationship a second way",
    "measure.compose": "Closed the measurement phase",
    "run.wall_clock_cap": "Reached the wall-clock cap",
    "run.stopped": "Run stopped",
    "run.error": "A step failed"
  };
  const exact = known[event.label];
  if (exact !== undefined) {
    return exact;
  }
  if (event.label.startsWith("prior:")) {
    return "Wrote the first guess — before any cultural data";
  }
  if (event.label.startsWith("investigate:turn")) {
    return "Planned the next probe";
  }
  return event.label;
}

function cacheLabel(cacheState: string): string | null {
  if (cacheState === "live") return "Live";
  if (cacheState === "cached") return "From cache";
  return null;
}

/**
 * Rate-limit / degradation marker. The gateway retries 429s internally, so no
 * event ever carries an attempt counter — "retrying, 2 of 3" is NOT invented
 * here. A dashed circle plus the server's own summary text is the honest
 * maximum (Final Design §7.1 "States": dashed circle carries the meaning).
 */
function degradationOf(event: LedgerEvent): { dashed: boolean; note: string | null } {
  if (event.kind === "Qloo" && event.summary.trim().toLowerCase().startsWith("degraded")) {
    return { dashed: true, note: "Qloo answered partially or late — the row shows exactly what came back." };
  }
  if (event.label === "run.error" && /\b(429|rate[- ]?limit)\b/i.test(event.summary)) {
    return { dashed: true, note: "Rate limited upstream — the agent could not complete this step." };
  }
  return { dashed: false, note: null };
}

export function describeLedgerRow(row: LedgerRowInput): LedgerRowModel {
  const { event } = row;
  const rawParams = (event as { parameters?: unknown }).parameters;
  const degradation = degradationOf(event);
  return {
    sequence: row.sequence,
    kind: event.kind,
    label: plainLabel(event),
    technicalLabel: event.label,
    summary: event.summary,
    durationLabel: formatDuration(event.duration),
    cacheLabel: cacheLabel(event.cacheState),
    resultCount: event.resultCount,
    dashed: degradation.dashed,
    note: degradation.note,
    parameters:
      rawParams !== undefined && rawParams !== null
        ? (redactSensitive(rawParams) as LedgerRowParameters)
        : null
  };
}

export function describeLedgerRows(rows: readonly LedgerRowInput[]): LedgerRowModel[] {
  return rows.map(describeLedgerRow);
}

/* ------------------------------------------------------------------ *
 * Cultural DNA
 * ------------------------------------------------------------------ */

export interface DnaEntity {
  readonly name: string;
  /** 0..1 positions on the shared dumbbell track (local = solid, city = hollow). */
  readonly local: number;
  readonly city: number;
}

export interface DnaGroup {
  readonly domain: "Artists" | "Films" | "Brands";
  readonly entities: readonly DnaEntity[];
}

const DNA_DOMAINS = [
  { key: "artists", domain: "Artists" },
  { key: "films", domain: "Films" },
  { key: "brands", domain: "Brands" }
] as const;

const DNA_ENTITY_CAP = 6;

function toUnit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value <= 1) {
    return value;
  }
  if (value <= 100) {
    return value / 100;
  }
  return null;
}

/**
 * Accept a recognisable culturalDna shape (per-domain arrays of
 * { name, local, city }) or return []. Values may arrive 0..1 or 0..100;
 * they are scaled to the 0..1 track for position only — no arithmetic on
 * the numbers themselves beyond that render scale.
 */
export function parseCulturalDna(value: unknown): DnaGroup[] {
  if (!isNamedRecord(value)) {
    return [];
  }
  const groups: DnaGroup[] = [];
  for (const { key, domain } of DNA_DOMAINS) {
    const raw = value[key];
    if (!Array.isArray(raw)) {
      continue;
    }
    const entities: DnaEntity[] = [];
    for (const item of raw) {
      if (entities.length >= DNA_ENTITY_CAP) {
        break;
      }
      if (!isNamedRecord(item)) {
        continue;
      }
      const name = nameOf(item);
      const local = toUnit(item.local);
      const city = toUnit(item.city);
      if (name === null || local === null || city === null) {
        continue;
      }
      entities.push({ name, local, city });
    }
    if (entities.length > 0) {
      groups.push({ domain, entities });
    }
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * Run status / stream / actions
 * ------------------------------------------------------------------ */

const STATUS_COPY: Record<string, string> = {
  prior_pending: "Prior locked — starting the investigation",
  investigating: "Investigating the site",
  stopped: "Stopped — showing the best so far",
  complete: "Investigation complete",
  partial: "Stopped early — partial results",
  failed: "The investigation failed"
};

export function describeRunStatus(status: string): string {
  return STATUS_COPY[status] ?? status;
}

export function isRunActive(status: string): boolean {
  return isResumableRunStatus(status);
}

/** "See compositions" may only exist when the server actually delivered
 *  compositions. Today's orchestrator never sets the field, so the button
 *  stays absent honestly rather than linking to a screen that does not exist. */
export function hasCompositions(run: RunState | null): boolean {
  return run !== null && run.compositions !== undefined && run.compositions !== null;
}

export function describeStreamNotice(connection: string, status: string | null): string | null {
  if (status === null || !isRunActive(status)) {
    return null;
  }
  if (connection === "closed") {
    return "Live updates stopped reconnecting. The rows on screen may be behind — reload to catch up.";
  }
  return null;
}

export function describeLoadFailure(code: string): string {
  if (code === "RUN_NOT_FOUND") {
    return "This investigation no longer exists on the server. Start again from the home page.";
  }
  if (code === "NETWORK_ERROR") {
    return "We couldn't reach the server to open this investigation. Check your connection and reload.";
  }
  return `We couldn't open this investigation (the server reported ${code}). Reload to try again.`;
}

/* ------------------------------------------------------------------ *
 * Map inputs (site / anchors / heat) — defensive reads of unknown fields
 * ------------------------------------------------------------------ */

export interface S1Site {
  readonly lat: number;
  readonly lon: number;
  readonly radiusM: number;
}

/** Final Design §7.1 scale bar example uses 400 m; briefs carry their own radius. */
export const S1_DEFAULT_RADIUS_M = 400;

export function siteFromRun(run: RunState | null): S1Site | null {
  const coordinates = run?.brief?.coordinates;
  if (coordinates === undefined) {
    return null;
  }
  const radius = run?.brief?.radius;
  return {
    lat: coordinates.lat,
    lon: coordinates.lon,
    radiusM: typeof radius === "number" && Number.isFinite(radius) && radius > 0 ? radius : S1_DEFAULT_RADIUS_M
  };
}

export interface S1Anchor {
  readonly lat: number;
  readonly lon: number;
  readonly letter: string;
}

const ANCHOR_LETTERS = ["A", "B", "C", "D", "E"];

/**
 * Anchors would live in siteRead once the agent starts persisting them
 * (D-5.4 placeholder). Today the orchestrator never writes the field, so this
 * returns [] and the map draws no pins — never synthetic ones.
 */
export function anchorsFromRun(run: RunState | null): S1Anchor[] {
  const siteRead = run?.siteRead;
  if (!isNamedRecord(siteRead) || !Array.isArray(siteRead.anchors)) {
    return [];
  }
  const out: S1Anchor[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < siteRead.anchors.length && out.length < ANCHOR_LETTERS.length; i += 1) {
    const item = siteRead.anchors[i];
    if (!isNamedRecord(item)) {
      continue;
    }
    const lat = item.lat;
    const lon = item.lon;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const letter =
      typeof item.letter === "string" && /^[A-Za-z]$/.test(item.letter)
        ? item.letter.toUpperCase()
        : (ANCHOR_LETTERS[out.length] ?? "A");
    if (seen.has(letter)) {
      continue;
    }
    seen.add(letter);
    out.push({ lat, lon, letter });
  }
  return out;
}

export interface S1HeatPoint {
  readonly lat: number;
  readonly lon: number;
  /** 0..1 affinity; rendered as one of four halftone dot sizes. */
  readonly weight: number;
}

/** Heat points would live in siteRead once the gateway heatmaps persist
 *  (D-5.4). Absent field -> [] -> no dots. Never synthetic heat. */
export function heatFromRun(run: RunState | null): S1HeatPoint[] {
  const siteRead = run?.siteRead;
  if (!isNamedRecord(siteRead) || !Array.isArray(siteRead.heat)) {
    return [];
  }
  const out: S1HeatPoint[] = [];
  for (const item of siteRead.heat) {
    if (!isNamedRecord(item)) {
      continue;
    }
    const { lat, lon, weight } = item;
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const unit = toUnit(weight);
    if (unit === null) {
      continue;
    }
    out.push({ lat, lon, weight: unit });
  }
  return out;
}
