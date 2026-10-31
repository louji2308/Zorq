/*
 * Typed SSE client for GET /api/runs/:id/events (Phase 5 protocol, D-5.3).
 *
 * Protocol facts this client relies on (verified against src/server/sse/):
 *  - The first frame on every (re)connect is always `event: state` with the full
 *    RunState; ledger frames follow, their `id:` equal to the durable ledger
 *    sequence (a strictly increasing integer).
 *  - Last-Event-ID replay is handled natively: browsers resend the last received
 *    `id:` as the Last-Event-ID header on auto-reconnect, and the Phase 5 server
 *    reads exactly that header, replaying only a contiguous missed window.
 *  - Heartbeat comment frames are invisible to EventSource (spec behaviour).
 *  - A terminal state is followed by its replayed ledger history and then an
 *    `end` frame; the server closes the stream after the frame is written.
 *
 * Frame policy (dedupe / apply):
 *  - `state` frames REPLACE the run projection wholesale (the reconcile point).
 *    Ledger bookkeeping re-baselines on every state frame.
 *  - `ledger` frames apply only when their position is consistent: accepted at
 *    baseline (first after a state frame) or exactly `last + 1`; stale/duplicate
 *    ids are dropped; a non-contiguous id drops the frame and suspends ledger
 *    delivery until the next state frame reconciles. No client-side gap repair —
 *    the next state reconcile is the source of truth.
 *  - `error` frames surface the typed error body unchanged.
 *  - `end` marks a graceful terminal stream after history replay; `onTerminal`
 *    fires against the stored terminal state, then the stream closes.
 *  - Other named frames (phase/evidence/dna/compositions/stress/blueprint) are
 *    observable via `onFrame` for callers that want them; run-shaped data also
 *    arrives inside state frames, which remain authoritative.
 *
 * Connection status is observable (`connecting` / `open` / `closed`). A closed
 * status without a terminal state means the browser gave up on the stream (HTTP
 * 4xx/5xx, e.g. RUN_NOT_FOUND, or exhausted retries) — surface it honestly.
 *
 * React 19 StrictMode note: effects must return the stream's `close()` as
 * cleanup; `close()` is idempotent and closes the underlying EventSource, so a
 * double-invoked effect cannot leave two live connections.
 */
import type { ApiErrorBody } from "../../shared/errors.js";
import {
  sseEventNameSchema,
  sseEventNames,
  sseFrameSchema,
  type LedgerEvent,
  type SseEventName
} from "../../shared/events.js";
import type { RunState } from "../../shared/run.js";

export type ConnectionStatus = "connecting" | "open" | "closed";

/** Structural subset of the DOM MessageEvent fields this client reads. */
export interface SseMessageEventLike {
  readonly type: string;
  readonly data: string;
  readonly lastEventId: string;
}

/** Structural subset of the DOM EventSource this client uses.
 *  Tests inject a fake through `createEventSource`; no network needed. */
export interface EventSourceLike {
  readonly readyState: number;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: SseMessageEventLike) => void): void;
}

const EVENT_SOURCE_CLOSED = 2;

export interface RunStreamOptions {
  runId: string;
  /** Wholesale replace of the run projection (validated RunState). */
  onState?: (run: RunState) => void;
  /** Policy-accepted ledger row: the event plus its durable sequence id. */
  onLedger?: (event: LedgerEvent, sequence: number) => void;
  /** Typed `error` frame body ({ error: { code, message, requestId } }). */
  onErrorFrame?: (error: ApiErrorBody) => void;
  /** Fires once after a terminal state's replayed history ends, before close. */
  onTerminal?: (run: RunState) => void;
  /** Observability hook: every frame that validates, before policy filtering. */
  onFrame?: (name: SseEventName, data: unknown, id: string) => void;
  /** A frame that failed JSON parsing or schema validation. Never fabricates a body. */
  onInvalidFrame?: (detail: { event: string; reason: string }) => void;
  /** Observable connection status: connecting -> open -> (connecting)* -> closed. */
  onConnection?: (status: ConnectionStatus) => void;
  /** Injectable EventSource factory for tests; defaults to the browser global. */
  createEventSource?: (url: string) => EventSourceLike;
}

export interface RunStreamHandle {
  readonly url: string;
  close(): void;
  status(): ConnectionStatus;
}

export function runEventsUrl(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/events`;
}

/** Mirrors the server's isResumableStatus (src/server/orchestrator/status.ts):
 *  only these statuses keep the SSE stream open. */
export function isResumableRunStatus(status: string): boolean {
  return status === "prior_pending" || status === "investigating";
}

/** Terminal = no further state changes; history replay ends with an `end` frame. */
export function isTerminalRunStatus(status: string): boolean {
  return !isResumableRunStatus(status);
}

export function createRunEventStream(options: RunStreamOptions): RunStreamHandle {
  const url = runEventsUrl(options.runId);
  const factory =
    options.createEventSource ??
    ((target: string): EventSourceLike =>
      new EventSource(target) as unknown as EventSourceLike);

  const source = factory(url);

  let closed = false;
  let status: ConnectionStatus = "closed";
  let lastLedgerSequence: number | null = null;
  let ledgerSuspended = false;
  let terminalState: RunState | null = null;
  let terminalDelivered = false;

  const notifyTerminal = (run: RunState): void => {
    if (terminalDelivered) {
      return;
    }
    terminalDelivered = true;
    options.onTerminal?.(run);
  };

  const emitConnection = (next: ConnectionStatus): void => {
    if (status === next) {
      return;
    }
    status = next;
    options.onConnection?.(next);
  };

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    source.close();
    emitConnection("closed");
  };

  const handleFrame = (raw: SseMessageEventLike): void => {
    if (closed) {
      return;
    }
    const name = sseEventNameSchema.safeParse(raw.type);
    if (!name.success) {
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw.data);
    } catch {
      options.onInvalidFrame?.({ event: raw.type, reason: "data is not valid JSON" });
      return;
    }
    const parsed = sseFrameSchema.safeParse({ event: name.data, id: raw.lastEventId, data });
    if (!parsed.success) {
      options.onInvalidFrame?.({ event: raw.type, reason: "frame failed schema validation" });
      return;
    }
    const frame = parsed.data;
    options.onFrame?.(frame.event, frame.data, frame.id);

    switch (frame.event) {
      case "state": {
        // The state frame is the reconcile point: ledger delivery re-baselines.
        lastLedgerSequence = null;
        ledgerSuspended = false;
        terminalState = isTerminalRunStatus(frame.data.status) ? frame.data : null;
        options.onState?.(frame.data);
        break;
      }
      case "ledger": {
        if (ledgerSuspended) {
          return;
        }
        const sequence = Number(frame.id);
        if (!Number.isSafeInteger(sequence) || sequence < 1) {
          options.onInvalidFrame?.({ event: frame.event, reason: "ledger id is not a sequence number" });
          return;
        }
        if (lastLedgerSequence !== null) {
          if (sequence <= lastLedgerSequence) {
            return;
          }
          if (sequence > lastLedgerSequence + 1) {
            // Cannot prove contiguity: drop and suspend until the next state frame.
            ledgerSuspended = true;
            return;
          }
        }
        lastLedgerSequence = sequence;
        options.onLedger?.(frame.data, sequence);
        break;
      }
      case "end": {
        if (terminalState === null) {
          options.onInvalidFrame?.({ event: frame.event, reason: "end frame without a terminal state" });
        } else {
          notifyTerminal(terminalState);
        }
        close();
        break;
      }
      case "error": {
        options.onErrorFrame?.(frame.data);
        break;
      }
      default:
        break;
    }
  };

  for (const eventName of sseEventNames) {
    source.addEventListener(eventName, handleFrame);
  }
  source.onopen = (): void => {
    if (!closed) {
      emitConnection("open");
    }
  };
  source.onerror = (): void => {
    if (closed) {
      return;
    }
    if (source.readyState === EVENT_SOURCE_CLOSED) {
      if (terminalState !== null) {
        notifyTerminal(terminalState);
      }
      close();
      return;
    }
    emitConnection("connecting");
  };

  emitConnection("connecting");

  return { url, close, status: () => status };
}
