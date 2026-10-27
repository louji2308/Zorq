import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { LlmClient, LlmCompletionRequest, LlmCompletionResult } from "../../src/server/agent/llm.js";
import type { LedgerEntry } from "../../src/server/agent/ledger.js";
import { createApp } from "../../src/server/app.js";
import { loadConfig } from "../../src/server/config.js";
import { createLogger } from "../../src/server/logger.js";
import { createOrchestrator, rehydrateRun } from "../../src/server/orchestrator/index.js";
import { createMemoryStore, type StoredRun } from "../../src/server/persistence/index.js";
import { createEventHub } from "../../src/server/sse/index.js";
import type { RunState } from "../../src/shared/run.js";
import { TEST_BRIEF, TEST_NOW, fakeGateway, fakeLlm } from "../agent/support/fakes.js";
import {
  FINAL_TURN,
  PRIOR_RESPONSE,
  TURN_ONE,
  completion,
  deferred,
  retryWhenIdle,
  waitForTerminalRun
} from "../orchestrator/support.js";
import { startServer } from "../support/http.js";

const TEST_CONFIG = loadConfig({ NODE_ENV: "test", APP_BASE_URL: "http://localhost:3000" });
const SSE_HEARTBEAT_MS = 50;
const LAST_EVENT_ID_BEFORE_STOP = "3";

interface ParsedFrame {
  event?: string;
  id?: string;
  data?: string;
  comment?: string;
}

interface ExitGateScenario {
  runId: string;
  refreshFrames: ParsedFrame[];
  firstConnectionFrames: ParsedFrame[];
  subscriberCountAfterFirstDisconnect: number;
  reconnectFrames: ParsedFrame[];
  missedWindow: LedgerEntry[];
  stoppedState: RunState;
  afterGateState: RunState;
  ledgerAfterGate: LedgerEntry[];
  doubleStopState: RunState;
  retryState: RunState;
  resumeState: RunState;
  llmCallsAfterRetry: number;
  llmCallsAfterResume: number;
  gatewaySearchCalls: number;
  finalStored: StoredRun;
  finalLedger: LedgerEntry[];
  finalEvidenceCount: number;
}

type ScriptStep = (request: LlmCompletionRequest) => Promise<LlmCompletionResult> | LlmCompletionResult;

function scriptLlm(steps: readonly ScriptStep[]): { client: LlmClient; calls: LlmCompletionRequest[] } {
  const calls: LlmCompletionRequest[] = [];
  const client: LlmClient = {
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
      const index = calls.length;
      calls.push({ ...request, messages: [...request.messages] });
      const step = steps[index];
      if (step === undefined) {
        throw new Error(`script llm: unexpected call #${index + 1} ("${request.label}") with no scripted step`);
      }
      return await step(request);
    }
  };
  return { client, calls };
}

function parseBlock(block: string): ParsedFrame {
  const frame: ParsedFrame = {};
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      frame.comment = line.slice(1).trim();
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") {
      frame.event = value;
    } else if (field === "id") {
      frame.id = value;
    } else if (field === "data") {
      frame.data = value;
    }
  }
  return frame;
}

async function readFrames(
  response: Response,
  options: { until?: (frames: ParsedFrame[]) => boolean; timeoutMs?: number } = {}
): Promise<ParsedFrame[]> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error("sse response has no readable body");
  }
  const decoder = new TextDecoder();
  const frames: ParsedFrame[] = [];
  let buffer = "";
  const timer = setTimeout(() => {
    reader.cancel().catch(() => undefined);
  }, options.timeoutMs ?? 3000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (block.trim() !== "") {
          frames.push(parseBlock(block));
          if (options.until?.(frames) === true) {
            return frames;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return frames;
}

function dataOf(frame: ParsedFrame | undefined): Record<string, unknown> | undefined {
  if (frame?.data === undefined) {
    return undefined;
  }
  return JSON.parse(frame.data) as Record<string, unknown>;
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("condition was not met within the timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function ledgerFrames(frames: readonly ParsedFrame[]): ParsedFrame[] {
  return frames.filter((frame) => frame.event === "ledger");
}

function expectStrictlyIncreasingUnique(ledger: readonly LedgerEntry[]): void {
  for (let i = 1; i < ledger.length; i += 1) {
    expect(ledger[i]!.sequence).toBeGreaterThan(ledger[i - 1]!.sequence);
  }
  expect(new Set(ledger.map((entry) => entry.id)).size).toBe(ledger.length);
  expect(new Set(ledger.map((entry) => entry.sequence)).size).toBe(ledger.length);
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

let scenario: ExitGateScenario | undefined;
let scenarioFailure: unknown;

async function runExitGateScenario(): Promise<ExitGateScenario> {
  const store = createMemoryStore();
  const hub = createEventHub();
  const gateway = fakeGateway();
  const gateOne = deferred();
  const gateTwo = deferred();
  const gateThree = deferred();
  const investigating = deferred();
  const firstState = deferred<RunState>();
  const llm = scriptLlm([
    () => completion(PRIOR_RESPONSE),
    async () => {
      investigating.resolve();
      await gateOne.promise;
      return completion(TURN_ONE.content ?? "", TURN_ONE.toolCalls ?? []);
    },
    async () => {
      await gateTwo.promise;
      return completion(TURN_ONE.content ?? "", TURN_ONE.toolCalls ?? []);
    },
    async () => {
      await gateThree.promise;
      return completion(FINAL_TURN.content);
    },
    () => completion(TURN_ONE.content ?? "", TURN_ONE.toolCalls ?? []),
    () => completion(FINAL_TURN.content)
  ]);
  const orchestrator = createOrchestrator({
    store,
    gateway: gateway.gateway,
    llm: llm.client,
    now: () => TEST_NOW,
    eventSink: (event) => {
      if (event.type === "state") {
        firstState.resolve(event.payload as RunState);
      }
      hub.publish(event);
    }
  });
  const app = createApp(createLogger("test"), {
    config: TEST_CONFIG,
    orchestrator,
    store,
    eventHub: hub,
    sseHeartbeatMs: SSE_HEARTBEAT_MS
  });
  const server = await startServer(app);
  cleanups.push(server.close);
  const eventsUrl = (runId: string): string => `${server.baseUrl}/api/runs/${runId}/events`;

  void orchestrator.startRun({ brief: TEST_BRIEF });
  const started = await firstState.promise;
  await investigating.promise;
  const runId = started.id;

  // refresh: a fresh client mid-investigation gets the authoritative state frame and no ledger replay
  const refreshAbort = new AbortController();
  const refreshResponse = await fetch(eventsUrl(runId), {
    headers: { accept: "text/event-stream" },
    signal: refreshAbort.signal
  });
  expect(refreshResponse.status).toBe(200);
  const refreshFrames = await readFrames(refreshResponse, {
    until: (frames) => frames.some((frame) => frame.event === "state"),
    timeoutMs: 2000
  });
  refreshAbort.abort();

  // first live connection: state frame, then live ledger as the first investigation turn lands
  const firstAbort = new AbortController();
  const firstResponse = await fetch(eventsUrl(runId), {
    headers: { accept: "text/event-stream" },
    signal: firstAbort.signal
  });
  expect(firstResponse.status).toBe(200);
  const firstRead = readFrames(firstResponse, {
    until: (frames) => frames.some((frame) => frame.event === "ledger" && dataOf(frame)?.label === "qloo_search"),
    timeoutMs: 5000
  });
  gateOne.resolve();
  const firstConnectionFrames = await firstRead;

  // disconnect: abort and prove the hub drops the subscriber
  firstAbort.abort();
  await waitFor(() => hub.subscriberCount(runId) === 0);
  const subscriberCountAfterFirstDisconnect = hub.subscriberCount(runId);

  // while disconnected, the in-flight turn two lands: sequences 4 and 5 become the missed window
  gateTwo.resolve();
  await waitFor(async () => (await store.listLedgerEvents(runId)).length >= 5);
  const missedWindow = (await store.listLedgerEvents(runId)).filter(
    (entry) => entry.sequence > Number(LAST_EVENT_ID_BEFORE_STOP)
  );

  // reconnect with Last-Event-ID: only the missed contiguous ledger window is replayed
  const reconnectAbort = new AbortController();
  const reconnectResponse = await fetch(eventsUrl(runId), {
    headers: { accept: "text/event-stream", "last-event-id": LAST_EVENT_ID_BEFORE_STOP },
    signal: reconnectAbort.signal
  });
  expect(reconnectResponse.status).toBe(200);
  const lastMissedSequence = missedWindow[missedWindow.length - 1]?.sequence ?? 0;
  const reconnectFrames = await readFrames(reconnectResponse, {
    until: (frames) => frames.some((frame) => frame.event === "ledger" && frame.id === String(lastMissedSequence)),
    timeoutMs: 5000
  });
  reconnectAbort.abort();
  await waitFor(() => hub.subscriberCount(runId) === 0);

  // stop lands while the third investigation turn is still gated; the gated pass never fabricates completion
  const stoppedState = await orchestrator.stopRun(runId, "exit gate stop");
  gateThree.resolve();
  const afterGateState = await waitForTerminalRun(store, runId);
  const ledgerAfterGate = await store.listLedgerEvents(runId);

  const doubleStopState = await orchestrator.stopRun(runId, "exit gate second stop");

  const retryState = await retryWhenIdle(orchestrator, runId);
  const llmCallsAfterRetry = llm.calls.length;

  const resumeState = await orchestrator.resumeRun(runId);
  const llmCallsAfterResume = llm.calls.length;

  const finalStored = await store.loadRun(runId);
  if (finalStored === null) {
    throw new Error("exit gate scenario: final store load returned null");
  }
  const finalLedger = await store.listLedgerEvents(runId);
  const finalEvidence = await store.listEvidence(runId);

  return {
    runId,
    refreshFrames,
    firstConnectionFrames,
    subscriberCountAfterFirstDisconnect,
    reconnectFrames,
    missedWindow,
    stoppedState,
    afterGateState,
    ledgerAfterGate,
    doubleStopState,
    retryState,
    resumeState,
    llmCallsAfterRetry,
    llmCallsAfterResume,
    gatewaySearchCalls: gateway.calls.filter((call) => call.operation === "search").length,
    finalStored,
    finalLedger,
    finalEvidenceCount: finalEvidence.length
  };
}

beforeAll(async () => {
  try {
    scenario = await runExitGateScenario();
  } catch (error) {
    scenarioFailure = error;
  }
});

function scene(): ExitGateScenario {
  if (scenarioFailure !== undefined) {
    throw scenarioFailure;
  }
  if (scenario === undefined) {
    throw new Error("exit gate scenario did not run");
  }
  return scenario;
}

describe("Phase 5 exit gate (end-to-end recovery scenario)", () => {
  it("gate clause: stop — a cooperative stop lands exactly one run.stopped marker and the gated pass settles as stopped", () => {
    const s = scene();
    expect(s.stoppedState.status).toBe("stopped");
    expect(s.stoppedState.id).toBe(s.runId);
    expect(Object.isFrozen(s.stoppedState.prior)).toBe(true);
    expect(s.afterGateState.status).toBe("stopped");
    expect(s.doubleStopState.status).toBe("stopped");
    expect(s.finalLedger.filter((entry) => entry.event.label === "run.stopped")).toHaveLength(1);
    expect(s.finalLedger.find((entry) => entry.event.label === "run.stopped")?.event.summary).toContain("exit gate stop");
  });

  it("gate clause: refresh — a refreshed client always receives the authoritative state frame first with no ledger replay", () => {
    const s = scene();
    expect(s.refreshFrames[0]?.event).toBe("state");
    const state = dataOf(s.refreshFrames[0]);
    expect(state?.id).toBe(s.runId);
    expect(state?.status).toBe("investigating");
    expect(ledgerFrames(s.refreshFrames)).toHaveLength(0);
    expect(s.firstConnectionFrames[0]?.event).toBe("state");
    expect(dataOf(s.firstConnectionFrames[0])?.status).toBe("investigating");
  });

  it("gate clause: disconnect — aborting the SSE client removes the subscriber and leaves run state intact", () => {
    const s = scene();
    expect(s.subscriberCountAfterFirstDisconnect).toBe(0);
    expect(s.stoppedState.phase).toBe("investigation");
    expect(Object.isFrozen(s.stoppedState.prior?.composition)).toBe(true);
  });

  it("gate clause: reconnect — Last-Event-ID replays only the missed contiguous ledger window, never the already-seen prefix", () => {
    const s = scene();
    expect(s.reconnectFrames[0]?.event).toBe("state");
    expect(dataOf(s.reconnectFrames[0])?.id).toBe(s.runId);
    const replayed = ledgerFrames(s.reconnectFrames);
    expect(replayed.map((frame) => frame.id)).toEqual(s.missedWindow.map((entry) => String(entry.sequence)));
    expect(s.missedWindow.length).toBeGreaterThan(0);
    expect(s.missedWindow[0]?.sequence).toBe(Number(LAST_EVENT_ID_BEFORE_STOP) + 1);
    for (let i = 1; i < s.missedWindow.length; i += 1) {
      expect(s.missedWindow[i]!.sequence).toBe(s.missedWindow[i - 1]!.sequence + 1);
    }
    for (const frame of replayed) {
      expect(Number(frame.id)).toBeGreaterThan(Number(LAST_EVENT_ID_BEFORE_STOP));
    }
    expect(replayed.some((frame) => frame.id === "1")).toBe(false);
  });

  it("gate clause: retry — retry after stop re-enters investigation and reaches a terminal complete run", () => {
    const s = scene();
    expect(s.retryState.status).toBe("complete");
    expect(s.retryState.phase).toBe("measurement");
    expect(s.retryState.id).toBe(s.runId);
    const stoppedIndex = s.finalLedger.findIndex((entry) => entry.event.label === "run.stopped");
    const measureIndex = s.finalLedger.findIndex((entry) => entry.event.label === "measure.compose");
    expect(stoppedIndex).toBeGreaterThanOrEqual(0);
    expect(measureIndex).toBeGreaterThan(stoppedIndex);
  });

  it("gate clause: resume — resuming the terminal run is a no-op with zero new LLM spend", () => {
    const s = scene();
    expect(s.resumeState.status).toBe("complete");
    expect(s.llmCallsAfterResume).toBe(s.llmCallsAfterRetry);
    expect(s.finalStored.state.status).toBe("complete");
  });

  it("gate clause: no corruption — the durable store matches the final orchestrator state with a frozen Prior and an append-only ledger", () => {
    const s = scene();
    expect(s.finalStored.state.id).toBe(s.retryState.id);
    expect(s.finalStored.state.status).toBe(s.retryState.status);
    expect(s.finalStored.state.phase).toBe(s.retryState.phase);
    expect(s.finalStored.state.prior).toEqual(s.retryState.prior);
    const rehydrated = rehydrateRun(s.finalStored);
    expect(Object.isFrozen(rehydrated.prior)).toBe(true);
    expect(Object.isFrozen(rehydrated.prior?.composition)).toBe(true);
    expectStrictlyIncreasingUnique(s.finalLedger);
    const gateIds = s.ledgerAfterGate.map((entry) => entry.id);
    const finalIds = s.finalLedger.slice(0, gateIds.length).map((entry) => entry.id);
    expect(finalIds).toEqual(gateIds);
  });

  it("gate clause: no duplicate effects — stop markers, Qloo probes and evidence are each counted once per real attempt", () => {
    const s = scene();
    expect(s.finalLedger.filter((entry) => entry.event.label === "run.stopped")).toHaveLength(1);
    expect(s.finalLedger.filter((entry) => entry.event.label === "measure.compose")).toHaveLength(1);
    const searchProbes = s.finalLedger.filter((entry) => entry.event.label === "qloo_search");
    expect(searchProbes).toHaveLength(s.gatewaySearchCalls);
    expect(s.finalEvidenceCount).toBe(s.gatewaySearchCalls);
    expect(s.finalEvidenceCount).toBeGreaterThan(0);
  });

  it("gate clause: no fabricated completion — the stopped pass that finished its turns was not upgraded, and completion required real observations", () => {
    const s = scene();
    expect(s.afterGateState.status).not.toBe("complete");
    expect(s.ledgerAfterGate.some((entry) => entry.event.label === "measure.compose")).toBe(false);
    expect(s.finalStored.state.status).toBe("complete");
    expect(s.finalEvidenceCount).toBeGreaterThan(0);
    const retrySearches = s.finalLedger.filter(
      (entry) => entry.event.label === "qloo_search" && entry.sequence > (s.ledgerAfterGate.at(-1)?.sequence ?? 0)
    );
    expect(retrySearches.length).toBeGreaterThan(0);
  });

  it("gate clause: reconnect gap — a non-contiguous ledger gap falls back to state-only replay instead of a silent partial replay", async () => {
    const store = createMemoryStore();
    const hub = createEventHub();
    const gateway = fakeGateway();
    const llm = fakeLlm([]);
    const orchestrator = createOrchestrator({
      store,
      gateway: gateway.gateway,
      llm: llm.client,
      now: () => TEST_NOW,
      eventSink: (event) => hub.publish(event)
    });
    const app = createApp(createLogger("test"), {
      config: TEST_CONFIG,
      orchestrator,
      store,
      eventHub: hub,
      sseHeartbeatMs: SSE_HEARTBEAT_MS
    });
    const server = await startServer(app);
    cleanups.push(server.close);

    const runId = "99999999-9999-4999-8999-999999999999";
    await store.createRun({
      id: runId,
      state: { id: runId, status: "complete", phase: "measurement", brief: TEST_BRIEF }
    });
    for (const entry of [
      { id: "gap-1", sequence: 1, event: { kind: "Compute" as const, label: "one", summary: "one", duration: 0, cacheState: "n/a", resultCount: 0 } },
      { id: "gap-3", sequence: 3, event: { kind: "Compute" as const, label: "three", summary: "three", duration: 0, cacheState: "n/a", resultCount: 0 } }
    ]) {
      await store.appendLedgerEvent(runId, entry);
    }

    const response = await fetch(`${server.baseUrl}/api/runs/${runId}/events`, {
      headers: { accept: "text/event-stream", "last-event-id": "1" }
    });
    expect(response.status).toBe(200);
    const frames = await readFrames(response, { timeoutMs: 2000 });
    expect(frames[0]?.event).toBe("state");
    expect(dataOf(frames[0])?.id).toBe(runId);
    expect(ledgerFrames(frames)).toHaveLength(0);
  });
});
