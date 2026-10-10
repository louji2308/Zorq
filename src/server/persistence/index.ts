import { createMemoryStore } from "./memoryStore.js";
import { createTursoStore } from "./tursoStore.js";
import type { RunStore } from "./store.js";

export type { CreateRunInput, RunStore, RunStoreKind, StoredRun } from "./store.js";
export {
  EvidenceConflict,
  LedgerEventConflict,
  RunConflict,
  RunNotFound,
  RunStoreError,
  type RunStoreErrorCode
} from "./errors.js";
export { createMemoryStore, type MemoryStoreOptions } from "./memoryStore.js";
export { createTursoStore, type TursoStoreOptions } from "./tursoStore.js";

export interface RunStoreConfig {
  tursoDatabaseUrl?: string | undefined;
  tursoAuthToken?: string | undefined;
}

export async function createRunStore(config: RunStoreConfig): Promise<RunStore> {
  if (config.tursoDatabaseUrl !== undefined && config.tursoDatabaseUrl !== "") {
    return createTursoStore({ url: config.tursoDatabaseUrl, authToken: config.tursoAuthToken });
  }
  return createMemoryStore();
}
