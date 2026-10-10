import type { RunState } from "../../shared/run.js";
import type { StoredRun } from "../persistence/index.js";

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

export function rehydrateRun(stored: StoredRun): RunState {
  const state = stored.state;
  if (state.prior !== undefined) {
    deepFreeze(state.prior);
  }
  return Object.freeze(state);
}
