import { ledgerEventSchema, type SseEventName } from "../../shared/events.js";
import { runStateSchema } from "../../shared/run.js";
import type { OrchestratorEvent } from "../orchestrator/index.js";

export interface StreamFrame {
  event: SseEventName;
  id: string;
  data: unknown;
}

export type FrameWriter = (frame: StreamFrame) => void;

export interface EventHub {
  publish(event: OrchestratorEvent): void;
  subscribe(runId: string, writer: FrameWriter): () => void;
  seed(runId: string, maxSequence: number): void;
  nextId(runId: string): string;
  subscriberCount(runId?: string): number;
}

interface LedgerFrameData {
  sequence: number;
  data: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function toLedgerFrameData(payload: unknown): LedgerFrameData | undefined {
  const record = asRecord(payload);
  if (record === undefined) {
    return undefined;
  }
  const sequence = record.sequence;
  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 1) {
    return undefined;
  }
  const parsed = ledgerEventSchema.safeParse(record.event);
  if (!parsed.success) {
    return undefined;
  }
  return { sequence, data: parsed.data };
}

export function createEventHub(): EventHub {
  const subscribers = new Map<string, Set<FrameWriter>>();
  const counters = new Map<string, number>();

  const noteSequence = (runId: string, sequence: number): void => {
    counters.set(runId, Math.max(counters.get(runId) ?? 0, sequence));
  };

  const nextId = (runId: string): string => {
    const next = (counters.get(runId) ?? 0) + 1;
    counters.set(runId, next);
    return String(next);
  };

  const toFrame = (event: OrchestratorEvent): StreamFrame | undefined => {
    switch (event.type) {
      case "state": {
        const parsed = runStateSchema.safeParse(event.payload);
        if (!parsed.success) {
          return undefined;
        }
        return { event: "state", id: nextId(event.runId), data: parsed.data };
      }
      case "phase": {
        const record = asRecord(event.payload);
        if (record === undefined) {
          return undefined;
        }
        return { event: "phase", id: nextId(event.runId), data: record };
      }
      case "ledger": {
        const entry = toLedgerFrameData(event.payload);
        if (entry === undefined) {
          return undefined;
        }
        noteSequence(event.runId, entry.sequence);
        return { event: "ledger", id: String(entry.sequence), data: entry.data };
      }
      case "error": {
        const record = asRecord(event.payload);
        if (record === undefined || typeof record.message !== "string" || record.message === "") {
          return undefined;
        }
        return { event: "error", id: nextId(event.runId), data: record };
      }
      default:
        return undefined;
    }
  };

  return {
    publish(event) {
      const writers = subscribers.get(event.runId);
      if (writers === undefined || writers.size === 0) {
        return;
      }
      const frame = toFrame(event);
      if (frame === undefined) {
        return;
      }
      for (const writer of [...writers]) {
        writer(frame);
      }
    },
    subscribe(runId, writer) {
      let writers = subscribers.get(runId);
      if (writers === undefined) {
        writers = new Set();
        subscribers.set(runId, writers);
      }
      writers.add(writer);
      return () => {
        const current = subscribers.get(runId);
        if (current === undefined) {
          return;
        }
        current.delete(writer);
        if (current.size === 0) {
          subscribers.delete(runId);
        }
      };
    },
    seed(runId, maxSequence) {
      noteSequence(runId, maxSequence);
    },
    nextId(runId) {
      return nextId(runId);
    },
    subscriberCount(runId) {
      if (runId !== undefined) {
        return subscribers.get(runId)?.size ?? 0;
      }
      let total = 0;
      for (const writers of subscribers.values()) {
        total += writers.size;
      }
      return total;
    }
  };
}
