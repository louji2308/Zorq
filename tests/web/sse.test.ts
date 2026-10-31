import { describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../../src/shared/errors.js";
import type { LedgerEvent } from "../../src/shared/events.js";
import type { RunState } from "../../src/shared/run.js";
import {
  createRunEventStream,
  isTerminalRunStatus,
  type ConnectionStatus,
  type EventSourceLike,
  type SseMessageEventLike
} from "../../src/web/lib/sse.js";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

const TEST_RUN_STATE: RunState = {
  id: "run-1",
  status: "investigating",
  phase: "investigation"
};

function terminalRun(status: string): RunState {
  return { ...TEST_RUN_STATE, status };
}

function ledgerEvent(label: string): LedgerEvent {
  return {
    kind: "Compute",
    label,
    summary: `summary for ${label}`,
    duration: 1,
    cacheState: "live",
    resultCount: 2
  };
}

class FakeEventSource implements EventSourceLike {
  readyState = CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, Array<(event: SseMessageEventLike) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: SseMessageEventLike) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
    this.readyState = CLOSED;
  }

  fireOpen(): void {
    this.readyState = OPEN;
    this.onopen?.(new Event("open"));
  }

  fireError(reconnecting = true): void {
    this.readyState = reconnecting ? CONNECTING : CLOSED;
    this.onerror?.(new Event("error"));
  }

  emit(event: { type: string; data: unknown; id: string }): void {
    this.dispatch({
      type: event.type,
      data: JSON.stringify(event.data),
      lastEventId: event.id
    });
  }

  emitRaw(type: string, rawData: string, id: string): void {
    this.dispatch({ type, data: rawData, lastEventId: id });
  }

  private dispatch(message: SseMessageEventLike): void {
    for (const listener of [...(this.listeners.get(message.type) ?? [])]) {
      listener(message);
    }
  }
}

interface Harness {
  stream: ReturnType<typeof createRunEventStream>;
  source: () => FakeEventSource;
  createdUrls: string[];
}

function createHarness(
  options: Partial<Omit<Parameters<typeof createRunEventStream>[0], "runId" | "createEventSource">> = {}
): Harness {
  const createdUrls: string[] = [];
  let instance: FakeEventSource | undefined;
  const stream = createRunEventStream({
    runId: "run-1",
    createEventSource: (url) => {
      createdUrls.push(url);
      instance = new FakeEventSource(url);
      return instance;
    },
    ...options
  });
  return {
    stream,
    source: () => {
      if (instance === undefined) {
        throw new Error("fake EventSource was never created");
      }
      return instance;
    },
    createdUrls
  };
}

function collect(harnessOptions: Parameters<typeof createHarness>[0] = {}) {
  const states: RunState[] = [];
  const ledgers: Array<{ event: LedgerEvent; sequence: number }> = [];
  const errors: ApiErrorBody[] = [];
  const terminals: RunState[] = [];
  const frames: Array<{ name: string; data: unknown; id: string }> = [];
  const invalid: Array<{ event: string; reason: string }> = [];
  const connections: ConnectionStatus[] = [];
  const harness = createHarness({
    ...harnessOptions,
    onState: (run) => states.push(run),
    onLedger: (event, sequence) => ledgers.push({ event, sequence }),
    onErrorFrame: (body) => errors.push(body),
    onTerminal: (run) => terminals.push(run),
    onFrame: (name, data, id) => frames.push({ name, data, id }),
    onInvalidFrame: (detail) => invalid.push(detail),
    onConnection: (status) => connections.push(status)
  });
  return { harness, states, ledgers, errors, terminals, frames, invalid, connections };
}

describe("sse client", () => {
  it("opens the events URL for the run and reports connecting then open", () => {
    const { harness, connections } = collect();

    expect(harness.createdUrls).toEqual(["/api/runs/run-1/events"]);
    expect(harness.stream.url).toBe("/api/runs/run-1/events");
    expect(harness.stream.status()).toBe("connecting");
    expect(connections).toEqual(["connecting"]);

    harness.source().fireOpen();

    expect(harness.stream.status()).toBe("open");
    expect(connections).toEqual(["connecting", "open"]);
  });

  it("replaces the projection wholesale on every state frame", () => {
    const { harness, states } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "1" });
    harness.source().emit({
      type: "state",
      data: { ...TEST_RUN_STATE, phase: "measurement" },
      id: "5"
    });

    expect(states).toHaveLength(2);
    expect(states[1]).toEqual({ ...TEST_RUN_STATE, phase: "measurement" });
  });

  it("accepts a ledger baseline after a state frame, then only contiguous sequences", () => {
    const { harness, ledgers } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "1" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("seven"), id: "7" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("eight"), id: "8" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("eight-again"), id: "8" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("six"), id: "6" });

    expect(ledgers.map((row) => row.sequence)).toEqual([7, 8]);
    expect(ledgers[0]?.event.label).toBe("seven");
  });

  it("suspends ledger delivery on a gap until the next state frame reconciles", () => {
    const { harness, ledgers } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "1" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("one"), id: "1" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("three"), id: "3" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("four"), id: "4" });
    expect(ledgers.map((row) => row.sequence)).toEqual([1]);

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "9" });
    harness.source().emit({ type: "ledger", data: ledgerEvent("ten"), id: "10" });

    expect(ledgers.map((row) => row.sequence)).toEqual([1, 10]);
  });

  it("holds a terminal state until end, then delivers it once, closes and ignores later frames", () => {
    const { harness, states, terminals, ledgers } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "state", data: terminalRun("complete"), id: "4" });

    expect(states).toHaveLength(1);
    expect(terminals).toHaveLength(0);
    expect(harness.source().closed).toBe(false);

    harness.source().emit({ type: "end", data: {}, id: "5" });

    expect(terminals).toEqual([terminalRun("complete")]);
    expect(harness.source().closed).toBe(true);
    expect(harness.stream.status()).toBe("closed");

    harness.source().emit({ type: "ledger", data: ledgerEvent("late"), id: "99" });
    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "5" });

    expect(ledgers).toHaveLength(0);
    expect(states).toHaveLength(1);
  });

  it("reports an end frame without a terminal state and closes", () => {
    const { harness, terminals, invalid } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "end", data: {}, id: "2" });

    expect(terminals).toHaveLength(0);
    expect(invalid).toEqual([{ event: "end", reason: "end frame without a terminal state" }]);
    expect(harness.source().closed).toBe(true);
  });

  it("classifies statuses the same way the server stream does", () => {
    expect(isTerminalRunStatus("investigating")).toBe(false);
    expect(isTerminalRunStatus("prior_pending")).toBe(false);
    expect(isTerminalRunStatus("stopped")).toBe(true);
    expect(isTerminalRunStatus("complete")).toBe(true);
    expect(isTerminalRunStatus("partial")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
  });

  it("surfaces typed error frames and observes every validated frame", () => {
    const { harness, errors, frames } = collect();
    harness.source().fireOpen();

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "1" });
    const errorBody: ApiErrorBody = {
      error: { code: "DEPENDENCY_UNAVAILABLE", message: "cultural data service down", requestId: "req-2" }
    };
    harness.source().emit({ type: "error", data: errorBody, id: "2" });

    expect(errors).toEqual([errorBody]);
    expect(frames.map((frame) => frame.name)).toEqual(["state", "error"]);
  });

  it("reports reconnects as connecting then open again", () => {
    const { harness, connections } = collect();
    harness.source().fireOpen();
    harness.source().fireError(true);

    expect(harness.stream.status()).toBe("connecting");
    expect(connections).toEqual(["connecting", "open", "connecting"]);

    harness.source().fireOpen();

    expect(harness.stream.status()).toBe("open");
    expect(connections).toEqual(["connecting", "open", "connecting", "open"]);
  });

  it("reports closed when the browser gives up on the stream", () => {
    const { harness, connections } = collect();
    harness.source().fireOpen();
    harness.source().fireError(false);

    expect(harness.stream.status()).toBe("closed");
    expect(connections).toEqual(["connecting", "open", "closed"]);
  });

  it("reports malformed frames via onInvalidFrame without delivering them", () => {
    const { harness, invalid, states, ledgers } = collect();
    harness.source().fireOpen();

    harness.source().emitRaw("state", "{not json", "1");
    harness.source().emitRaw("ledger", JSON.stringify({ kind: "Compute" }), "2");
    harness.source().emitRaw("ledger", JSON.stringify(ledgerEvent("x")), "not-a-sequence");
    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "3" });

    expect(states).toHaveLength(1);
    expect(ledgers).toHaveLength(0);
    expect(invalid).toEqual([
      { event: "state", reason: "data is not valid JSON" },
      { event: "ledger", reason: "frame failed schema validation" },
      { event: "ledger", reason: "ledger id is not a sequence number" }
    ]);
  });

  it("close() closes the EventSource, is idempotent and stops handling frames", () => {
    const { harness, states } = collect();
    harness.source().fireOpen();

    harness.stream.close();
    harness.stream.close();

    expect(harness.source().closed).toBe(true);
    expect(harness.stream.status()).toBe("closed");

    harness.source().emit({ type: "state", data: TEST_RUN_STATE, id: "1" });
    expect(states).toHaveLength(0);
  });
});
