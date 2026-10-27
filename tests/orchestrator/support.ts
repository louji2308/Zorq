import { RAPIDROUTER_MODEL } from "../../src/server/agent/llm.js";
import type { LlmCompletionResult, LlmToolCall } from "../../src/server/agent/llm.js";
import { RunBusyError, rehydrateRun } from "../../src/server/orchestrator/index.js";
import type { RunStore } from "../../src/server/persistence/index.js";
import type { RunState } from "../../src/shared/run.js";

export const PRIOR_RESPONSE = JSON.stringify({
  composition: { thesis: "A daytime cultural corner anchored by coffee and film", members: [{ role: "Anchor", name: "coffee roastery" }] },
  rationale: "from the brief only"
});

export const TURN_ONE = {
  content: "checking anchors",
  toolCalls: [{ id: "call_1", name: "qloo_search", arguments: '{"query": "jazz cafe", "take": 5}' }]
};

export const FINAL_TURN = { content: "Evidence: one real anchor measured; everything else remains unproven." };

export function completion(content: string, toolCalls: LlmToolCall[] = []): LlmCompletionResult {
  return {
    model: RAPIDROUTER_MODEL,
    content,
    toolCalls,
    usage: { promptTokens: 1200, completionTokens: 480, totalTokens: 1680 },
    durationMs: 12,
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop"
  };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const TERMINAL_RUN_STATUSES = new Set(["complete", "partial", "failed", "stopped"]);

export async function waitForTerminalRun(
  store: Pick<RunStore, "loadRun">,
  runId: string,
  timeoutMs = 2000
): Promise<RunState> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const stored = await store.loadRun(runId);
    if (stored !== null && TERMINAL_RUN_STATUSES.has(stored.state.status)) {
      return rehydrateRun(stored);
    }
    if (Date.now() >= deadline) {
      throw new Error(`run ${runId} did not reach a terminal state within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

export async function retryWhenIdle(
  orchestrator: { retryRun(runId: string): Promise<RunState> },
  runId: string,
  timeoutMs = 2000
): Promise<RunState> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await orchestrator.retryRun(runId);
    } catch (error) {
      if (!(error instanceof RunBusyError)) {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}
