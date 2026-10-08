export interface QlooCacheOptions {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
}

interface CacheEntry {
  envelope: unknown;
  expiresAt: number;
}

export class QlooEnvelopeCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #maxEntries: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  #hits = 0;

  constructor(options: QlooCacheOptions) {
    this.#maxEntries = Math.max(0, options.maxEntries);
    this.#ttlMs = Math.max(0, options.ttlMs);
    this.#now = options.now ?? Date.now;
  }

  get size(): number {
    return this.#entries.size;
  }

  get hits(): number {
    return this.#hits;
  }

  get(key: string): unknown {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    this.#hits += 1;
    return structuredClone(entry.envelope);
  }

  set(key: string, envelope: unknown): void {
    if (this.#ttlMs === 0 || this.#maxEntries === 0) {
      return;
    }
    this.#entries.delete(key);
    this.#entries.set(key, { envelope: structuredClone(envelope), expiresAt: this.#now() + this.#ttlMs });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) {
        break;
      }
      this.#entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}
