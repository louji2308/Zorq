const SENSITIVE_KEY =
  /^(api[-_ ]?key|key|token|secret|authorization|password|credential|access[-_ ]?token)$/i;

export const REDACTED = "[redacted]";

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, depth + 1);
    }
    return out;
  }
  return value;
}
