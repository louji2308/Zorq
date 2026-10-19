import { createMemoryStore } from "./memoryStore.js";
import { createTursoStore, type TursoStoreOptions } from "./tursoStore.js";
import type { RunStore } from "./store.js";

export type { BlueprintSnapshot, CreateRunInput, RunStore, RunStoreKind, StoredRun } from "./store.js";
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
  /** Development-only escape hatch for an unreachable optional remote store. */
  allowMemoryFallback?: boolean | undefined;
}

export interface RunStoreDependencies {
  tursoFactory?: (options: TursoStoreOptions) => Promise<RunStore>;
}

export async function createRunStore(
  config: RunStoreConfig,
  dependencies: RunStoreDependencies = {}
): Promise<RunStore> {
  if (config.tursoDatabaseUrl !== undefined && config.tursoDatabaseUrl !== "") {
    const tursoFactory = dependencies.tursoFactory ?? createTursoStore;
    try {
      return await tursoFactory({ url: config.tursoDatabaseUrl, authToken: config.tursoAuthToken });
    } catch (error) {
      if (!config.allowMemoryFallback) {
        throw error;
      }
      return createMemoryStore();
    }
  }
  return createMemoryStore();
}
