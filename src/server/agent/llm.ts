import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam
} from "openai/resources/chat/completions/completions.js";
import {
  ApiError,
  zodIssuesToDetails,
  type ApiErrorCode,
  type ApiErrorDetail,
  type ZodIssueLike
} from "../../shared/errors.js";
import type { LlmBudget } from "./budget.js";
import { missingDeepSeekConfiguration } from "./errors.js";
import type { Ledger } from "./ledger.js";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-flash";

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens?: number | undefined;
}

export interface LlmCompletionRequest {
  label: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  essential?: boolean;
  maxOutputTokens?: number;
}

export interface LlmCompletionResult {
  model: string;
  content: string | null;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  durationMs: number;
  finishReason: string | null;
}

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

function redact(value: string, secrets: ReadonlyArray<string | undefined>): string {
  let out = value;
  for (const secret of secrets) {
    if (secret !== undefined && secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function toLlmApiError(error: unknown, secrets: ReadonlyArray<string | undefined>): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const status = extractStatus(error);
  const raw = error instanceof Error ? error.message : String(error);
  const message = redact(raw, secrets);
  const details: ApiErrorDetail[] = [{ path: "deepseek", message }];
  let code: ApiErrorCode = "DEPENDENCY_UNAVAILABLE";
  if (status === 429) {
    code = "RATE_LIMITED";
  } else if (status === 401 || status === 403) {
    code = "SERVICE_UNAVAILABLE";
  }
  const balanceHint = status === 402 ? " (HTTP 402: DeepSeek balance is insufficient)" : "";
  return new ApiError(code, `DeepSeek request failed${balanceHint}: ${message}`, details);
}

function toWireMessages(messages: readonly LlmMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return { role: "tool" as const, tool_call_id: message.toolCallId, content: message.content };
    }
    if (message.role === "assistant") {
      const toolCalls = message.toolCalls;
      if (toolCalls !== undefined && toolCalls.length > 0) {
        return {
          role: "assistant" as const,
          content: message.content,
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments }
          }))
        };
      }
      return { role: "assistant" as const, content: message.content ?? "" };
    }
    return { role: message.role, content: message.content };
  });
}

function normalizeContent(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter((part) => part !== "");
    return parts.length > 0 ? parts.join("") : null;
  }
  return null;
}

function normalizeToolCalls(value: unknown): LlmToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const calls: LlmToolCall[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const fn = (entry as { function?: unknown }).function;
    const id = (entry as { id?: unknown }).id;
    if (typeof fn !== "object" || fn === null) {
      continue;
    }
    const name = (fn as { name?: unknown }).name;
    const args = (fn as { arguments?: unknown }).arguments;
    if (typeof name !== "string") {
      continue;
    }
    calls.push({
      id: typeof id === "string" ? id : "",
      name,
      arguments: typeof args === "string" ? args : args === undefined || args === null ? "" : JSON.stringify(args)
    });
  }
  return calls;
}

function readCachedTokens(usage: unknown): number | undefined {
  if (typeof usage !== "object" || usage === null) {
    return undefined;
  }
  const record = usage as Record<string, unknown>;
  const details = record.prompt_tokens_details;
  if (typeof details === "object" && details !== null) {
    const cached = (details as { cached_tokens?: unknown }).cached_tokens;
    if (typeof cached === "number") {
      return cached;
    }
  }
  const hit = record.prompt_cache_hit_tokens;
  if (typeof hit === "number") {
    return hit;
  }
  return undefined;
}

function normalizeUsage(usage: unknown): LlmUsage {
  if (typeof usage !== "object" || usage === null) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  const prompt = typeof record.prompt_tokens === "number" ? record.prompt_tokens : 0;
  const completion = typeof record.completion_tokens === "number" ? record.completion_tokens : 0;
  const total = typeof record.total_tokens === "number" ? record.total_tokens : prompt + completion;
  const cached = readCachedTokens(usage);
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    cachedPromptTokens: cached
  };
}

export interface DeepSeekLlmOptions {
  apiKey: string | undefined;
  now?: () => number;
}

export function createDeepSeekLlmClient(options: DeepSeekLlmOptions): LlmClient {
  const now = options.now ?? Date.now;
  let client: OpenAI | undefined;

  return {
    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
      const apiKey = options.apiKey?.trim();
      if (apiKey === undefined || apiKey === "") {
        throw missingDeepSeekConfiguration();
      }
      client ??= new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL, maxRetries: 0 });
      const payload: ChatCompletionCreateParamsNonStreaming = {
        model: DEEPSEEK_MODEL,
        messages: toWireMessages(request.messages),
        ...(request.tools !== undefined && request.tools.length > 0
          ? {
              tools: request.tools.map((tool) => ({
                type: "function" as const,
                function: { name: tool.name, description: tool.description, parameters: tool.parameters }
              })),
              tool_choice: "auto" as const
            }
          : {}),
        ...(request.maxOutputTokens !== undefined ? { max_tokens: request.maxOutputTokens } : {})
      };
      const startedAt = now();
      let response: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
      try {
        response = await client.chat.completions.create(payload);
      } catch (error) {
        throw toLlmApiError(error, [apiKey]);
      }
      const durationMs = Math.max(0, now() - startedAt);
      const choice = Array.isArray(response.choices) ? response.choices[0] : undefined;
      const message = choice?.message;
      return {
        model: typeof response.model === "string" && response.model !== "" ? response.model : DEEPSEEK_MODEL,
        content: normalizeContent(message?.content),
        toolCalls: normalizeToolCalls(message?.tool_calls),
        usage: normalizeUsage(response.usage),
        durationMs,
        finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null
      };
    }
  };
}

export interface BoundedCompletionOptions {
  llm: LlmClient;
  budget: LlmBudget;
  ledger: Ledger;
  request: LlmCompletionRequest;
}

function summarizeResult(result: LlmCompletionResult): string {
  const parts = [`model ${result.model}`, `${result.usage.promptTokens} in / ${result.usage.completionTokens} out`];
  if (result.toolCalls.length > 0) {
    parts.push(`${result.toolCalls.length} tool call(s): ${result.toolCalls.map((call) => call.name).join(", ")}`);
  } else if (result.content !== null && result.content.trim() !== "") {
    const firstLine = result.content.trim().split("\n")[0] ?? "";
    parts.push(firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine);
  } else {
    parts.push("empty completion");
  }
  return parts.join(" | ");
}

export async function completeBounded(options: BoundedCompletionOptions): Promise<LlmCompletionResult> {
  const essential = options.request.essential ?? false;
  options.budget.assertCanSpend({ essential });
  const result = await options.llm.complete(options.request);
  options.budget.charge(result.usage);
  options.ledger.append({
    kind: "LLM",
    label: options.request.label,
    summary: summarizeResult(result),
    duration: result.durationMs,
    cacheState: "n/a",
    resultCount: result.toolCalls.length > 0 ? result.toolCalls.length : 1
  });
  return result;
}

export function formatZodIssues(error: unknown): string {
  const issues = (error as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    const details = zodIssuesToDetails(issues as readonly ZodIssueLike[]);
    return details.map((detail) => `${detail.path === "" ? "(root)" : detail.path}: ${detail.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}
