import { DEEPSEEK_MODEL } from "../../src/server/agent/llm.js";
import type { LlmCompletionResult, LlmToolCall } from "../../src/server/agent/llm.js";

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
    model: DEEPSEEK_MODEL,
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
