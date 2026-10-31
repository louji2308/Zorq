import { redactSensitive } from "../../shared/redaction.js";

const MAX_DETAIL_CHARS = 800;
const MAX_VALUE_STRING_CHARS = 400;
const MAX_VALUE_ARRAY_ITEMS = 20;
const MAX_VALUE_OBJECT_KEYS = 24;
const MAX_VALUE_DEPTH = 4;
const MAX_NAME_COUNT = 5;
const MAX_NAME_CHARS = 160;
const MAX_NAME_DEPTH = 4;
const MAX_NAME_ITEMS = 50;

export function clipActivityText(value: string, limit = MAX_DETAIL_CHARS): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, limit - 3))}...`;
}

export function boundedActivityValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return clipActivityText(value, MAX_VALUE_STRING_CHARS);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "object") {
    return clipActivityText(String(value), MAX_VALUE_STRING_CHARS);
  }
  if (depth >= MAX_VALUE_DEPTH) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_VALUE_ARRAY_ITEMS)
      .map((item) => boundedActivityValue(item, depth + 1));
    if (value.length > MAX_VALUE_ARRAY_ITEMS) {
      items.push("[truncated]");
    }
    return items;
  }
  const entries = Object.entries(value);
  const bounded: Record<string, unknown> = {};
  for (const [key, entry] of entries.slice(0, MAX_VALUE_OBJECT_KEYS)) {
    bounded[key] = boundedActivityValue(entry, depth + 1);
  }
  if (entries.length > MAX_VALUE_OBJECT_KEYS) {
    bounded.truncated = true;
  }
  return bounded;
}

export function collectActivityNames(value: unknown, limit = MAX_NAME_COUNT): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown, depth: number): void => {
    if (names.length >= limit || depth > MAX_NAME_DEPTH || typeof node !== "object" || node === null) {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node.slice(0, MAX_NAME_ITEMS)) {
        visit(item, depth + 1);
        if (names.length >= limit) {
          return;
        }
      }
      return;
    }
    const record = node as Record<string, unknown>;
    for (const key of ["name", "title", "label"]) {
      const candidate = record[key];
      if (typeof candidate !== "string") {
        continue;
      }
      const name = clipActivityText(candidate, MAX_NAME_CHARS);
      if (name === "" || seen.has(name)) {
        continue;
      }
      seen.add(name);
      names.push(name);
      if (names.length >= limit) {
        return;
      }
    }
    for (const entry of Object.values(record)) {
      visit(entry, depth + 1);
      if (names.length >= limit) {
        return;
      }
    }
  };
  visit(value, 0);
  return names;
}

export function boundedActivityRequest(value: unknown): unknown {
  return boundedActivityValue(redactSensitive(value));
}

export function formatActivityRequest(value: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(boundedActivityRequest(value));
  } catch {
    serialized = String(value);
  }
  if (serialized === undefined || serialized === "" || serialized === "{}") {
    return "{}";
  }
  return clipActivityText(serialized, 360);
}
