import { randomUUID } from "node:crypto";
import { ledgerEventSchema, type LedgerEvent } from "../../shared/events.js";
import type { Ledger, LedgerEntry } from "../agent/ledger.js";
import type { RunStore } from "../persistence/index.js";

export interface WriteThroughLedgerOptions {
  store: RunStore;
  runId: string;
  seed?: readonly LedgerEntry[];
  armed?: boolean;
  onAppend?: (entry: LedgerEntry) => void;
}

export class WriteThroughLedger implements Ledger {
  readonly #store: RunStore;
  readonly #runId: string;
  readonly #onAppend: ((entry: LedgerEntry) => void) | undefined;
  readonly #entries: LedgerEntry[] = [];
  #nextSequence = 1;
  #buffered: LedgerEntry[] = [];
  #armed: boolean;
  #chain: Promise<void> = Promise.resolve();
  #failure: unknown;

  constructor(options: WriteThroughLedgerOptions) {
    this.#store = options.store;
    this.#runId = options.runId;
    this.#onAppend = options.onAppend;
    this.#armed = options.armed ?? false;
    const seed = [...(options.seed ?? [])].sort((a, b) => a.sequence - b.sequence);
    for (const entry of seed) {
      this.#entries.push(entry);
      if (entry.sequence >= this.#nextSequence) {
        this.#nextSequence = entry.sequence + 1;
      }
    }
  }

  append(event: LedgerEvent): LedgerEntry {
    const entry: LedgerEntry = {
      id: randomUUID(),
      sequence: this.#nextSequence,
      event: ledgerEventSchema.parse(event)
    };
    this.#nextSequence += 1;
    this.#entries.push(entry);
    if (this.#armed) {
      this.#schedule(entry);
    } else {
      this.#buffered.push(entry);
    }
    try {
      this.#onAppend?.(entry);
    } catch {
      // event sinks are advisory; a failing sink must not corrupt the ledger or the run
    }
    return entry;
  }

  list(): LedgerEntry[] {
    return [...this.#entries];
  }

  size(): number {
    return this.#entries.length;
  }

  get(id: string): LedgerEntry | undefined {
    return this.#entries.find((entry) => entry.id === id);
  }

  async arm(): Promise<void> {
    if (!this.#armed) {
      this.#armed = true;
      const buffered = this.#buffered;
      this.#buffered = [];
      for (const entry of buffered) {
        this.#schedule(entry);
      }
    }
    await this.flush();
  }

  async flush(): Promise<void> {
    await this.#chain;
    if (this.#failure !== undefined) {
      throw this.#failure;
    }
  }

  #schedule(entry: LedgerEntry): void {
    this.#chain = this.#chain
      .then(() => this.#store.appendLedgerEvent(this.#runId, entry))
      .catch((error: unknown) => {
        this.#failure ??= error;
      });
  }
}
