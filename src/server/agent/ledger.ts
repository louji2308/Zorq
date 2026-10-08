import { randomUUID } from "node:crypto";
import { ledgerEventSchema, type LedgerEvent } from "../../shared/events.js";

export interface LedgerEntry {
  id: string;
  sequence: number;
  event: LedgerEvent;
}

export interface Ledger {
  append(event: LedgerEvent): LedgerEntry;
  list(): LedgerEntry[];
  size(): number;
  get(id: string): LedgerEntry | undefined;
}

export function createLedger(): Ledger {
  const entries: LedgerEntry[] = [];
  return {
    append(event) {
      const parsed = ledgerEventSchema.parse(event);
      const entry: LedgerEntry = {
        id: randomUUID(),
        sequence: entries.length + 1,
        event: parsed
      };
      entries.push(entry);
      return entry;
    },
    list() {
      return [...entries];
    },
    size() {
      return entries.length;
    },
    get(id) {
      return entries.find((entry) => entry.id === id);
    }
  };
}
