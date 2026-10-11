/*
 * S1 stream → store reconcile — the wiring RunRoute performs on mount:
 * createRunEventStream({ onState: applyState, onLedger: applyLedger,
 * onErrorFrame: setError, onConnection: setConnection }).
 *
 * Proves the S1 projection invariants end-to-end against the REAL stream
 * client and the REAL Zustand store (no store mocks):
 *  - every state frame REPLACES the run wholesale (D-5.3 / ARCH §17) — the
 *    client never merges or derives;
 *  - ledger rows survive a reconcile and are never double-rendered, even
 *    when a replayed sequence slips past the stream layer;
 *  - a reconnect that cannot prove contiguity suspends ledger delivery and
 *    waits for the next state frame — no client-side gap repair;
 *  - the reconnect banner only appears for a live run whose stream gave up.
 */
import { afterEach, describe, expect, it } from "vitest";
import { briefSchema } from "../../src/shared/brief.js";
import { ledgerEventSchema, type LedgerEvent } from "../../src/shared/events.js";
import { runStateSchema, type RunState } from "../../src/shared/run.js";
import {
  createRunEventStream,
  type ConnectionStatus,
  type EventSourceLike,
  type SseMessageEventLike
} from "../../src/web/lib/sse.js";
import { describeStreamNotice } from "../../src/web/screens/s1/s1Model.js";
import { useRunStore } from "../../src/web/store/runStore.js";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

const BRIEF = briefSchema.parse({
  location: "Crosby Street, Manhattan, New York 10012, United States",
  coordinates: { lat: 40.72466201611901, lon: -73.9963011816144 },
  radius: 400,
  objective: "A ground-floor place where downtown locals and visitors both feel they belong."
});

function runState(id: string, status: string): RunState {
  return runStateSchema.parse({ id, status, phase: "investigation", brief: BRIEF });
}

function ledgerEvent(label: string): LedgerEvent {
  return ledgerEventSchema.parse({
    kind: "Qloo",
    label,
    summary: `summary for ${label}`,
    duration: 4,
    cacheState: "live",
    resultCount: 3
  });
}

class FakeEventSource implements EventSourceLike {
  readyState = CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, Array<(event: SseMessageEventLike) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: SseMessageEventLike) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.readyState = CLOSED;
  }

  fireOpen(): void {
    this.readyState = OPEN;
    this.onopen?.(new Event("open"));
  }

  fireError(reconnecting: boolean): void {
    this.readyState = reconnecting ? CONNECTING : CLOSED;
    this.onerror?.(new Event("error"));
  }

  emit(event: { type: string; data: unknown; id: string }): void {
    const message: SseMessageEventLike = {
      type: event.type,
      data: JSON.stringify(event.data),
      lastEventId: event.id
    };
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) {
      listener(message);
    }
  }
}

/** Wires the REAL stream to the REAL store, exactly as RunRoute does. */
function openWiredStream(runId: string): { source: () => FakeEventSource; close: () => void } {
  let instance: FakeEventSource | undefined;
  const handle = createRunEventStream({
    runId,
    createEventSource: (url) => {
      instance = new FakeEventSource(url);
      return instance;
    },
    onState: (run) => useRunStore.getState().applyState(run),
    onLedger: (event, sequence) => useRunStore.getState().applyLedger(event, sequence),
    onErrorFrame: (error) => useRunStore.getState().setError(error),
    onConnection: (status: ConnectionStatus) => useRunStore.getState().setConnection(status)
  });
  return {
    source: () => {
      if (instance === undefined) {
        throw new Error("fake EventSource was never created");
      }
      return instance;
    },
    close: () => handle.close()
  };
}

function sequences(): number[] {
  return useRunStore.getState().ledgerRows.map((entry) => entry.sequence);
}

afterEach(() => {
  useRunStore.getState().reset();
});

describe("S1 stream → store reconcile", () => {
  it("replaces the projection wholesale on every state frame, ledger history intact", () => {
    const wired = openWiredStream("run-1");
    wired.source().fireOpen();
    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("qloo_search"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("qloo_insights"), id: "2" });

    expect(useRunStore.getState().run?.status).toBe("investigating");
    expect(sequences()).toEqual([1, 2]);

    wired.source().emit({ type: "state", data: runState("run-1", "stopped"), id: "9" });

    const state = useRunStore.getState();
    expect(state.run?.status).toBe("stopped");
    expect(state.run?.brief?.location).toBe("Crosby Street, Manhattan, New York 10012, United States");
    expect(sequences()).toEqual([1, 2]);
    wired.close();
  });

  it("never double-renders a replayed ledger sequence after a reconnect", () => {
    const wired = openWiredStream("run-1");
    wired.source().fireOpen();
    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("one"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("two"), id: "2" });

    wired.source().fireError(true);
    wired.source().fireOpen();
    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "9" });
    // The browser replays missed frames with the same ids after reconnect.
    wired.source().emit({ type: "ledger", data: ledgerEvent("one-again"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("two-again"), id: "2" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("three"), id: "3" });

    const state = useRunStore.getState();
    expect(sequences()).toEqual([1, 2, 3]);
    expect(state.ledgerRows[0]?.event.summary).toBe("summary for one");
    expect(state.ledgerRows[2]?.event.summary).toBe("summary for three");
    wired.close();
  });

  it("suspends on an unprovable gap and resumes only after a state reconcile", () => {
    const wired = openWiredStream("run-1");
    wired.source().fireOpen();
    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("one"), id: "1" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("three"), id: "3" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("four"), id: "4" });

    expect(sequences()).toEqual([1]);

    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "8" });
    wired.source().emit({ type: "ledger", data: ledgerEvent("five"), id: "5" });

    expect(sequences()).toEqual([1, 5]);
    wired.close();
  });

  it("tracks connection honestly and only banners a live run whose stream gave up", () => {
    const wired = openWiredStream("run-1");
    expect(useRunStore.getState().connection).toBe("connecting");

    wired.source().fireOpen();
    expect(useRunStore.getState().connection).toBe("open");

    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "1" });
    expect(describeStreamNotice(useRunStore.getState().connection, "investigating")).toBeNull();

    wired.source().fireError(false);
    expect(useRunStore.getState().connection).toBe("closed");
    const notice = describeStreamNotice("closed", "investigating");
    expect(notice).toContain("reload to catch up");

    // A terminal run closing its stream is normal — never a warning.
    expect(describeStreamNotice("closed", "complete")).toBeNull();
    expect(describeStreamNotice("closed", "stopped")).toBeNull();
    wired.close();
  });

  it("surfaces a typed error frame on the store without touching the projection", () => {
    const wired = openWiredStream("run-1");
    wired.source().fireOpen();
    wired.source().emit({ type: "state", data: runState("run-1", "investigating"), id: "1" });
    wired.source().emit({
      type: "error",
      data: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "cultural data service down", requestId: "req-9" } },
      id: "2"
    });

    const state = useRunStore.getState();
    expect(state.apiError?.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(state.run?.status).toBe("investigating");
    expect(sequences()).toEqual([]);
    wired.close();
  });
});
