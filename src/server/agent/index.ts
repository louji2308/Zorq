import type { Brief } from "../../shared/brief.js";
import { validationFailed, type ZodIssueLike } from "../../shared/errors.js";
import type { Prior, RunState } from "../../shared/run.js";
import type { QlooGateway } from "../qloo/index.js";
import type { EvidenceRecord } from "../evidence/index.js";
import { LOCK_LLM_BUDGET_USD } from "../config.js";
import { LlmBudget } from "./budget.js";
import { runController, type ControllerStopReason } from "./controller.js";
import { AgentToolError, toError } from "./errors.js";
import type { LlmClient } from "./llm.js";
import { createLedger, type LedgerEntry } from "./ledger.js";
import { generatePrior, persistPrior } from "./prior.js";
import { createInitialRun, transitionRun } from "./state.js";

export interface RunInvestigationOptions {
  brief: Brief;
  gateway: QlooGateway;
  llm: LlmClient;
  budget?: LlmBudget;
  now?: () => number;
  maxTurns?: number;
}

export interface InvestigationResult {
  run: RunState;
  prior: Prior | undefined;
  ledger: LedgerEntry[];
  evidence: EvidenceRecord[];
  observations: number;
  turns: number;
  stopReason: ControllerStopReason | "prior_failed";
  error?: Error;
  toolErrors: AgentToolError[];
}

export async function runInvestigation(options: RunInvestigationOptions): Promise<InvestigationResult> {
  const now = options.now ?? Date.now;
  const budget = options.budget ?? new LlmBudget({ ceilingUsd: LOCK_LLM_BUDGET_USD, now });
  const ledger = createLedger();

  let run: RunState;
  try {
    run = createInitialRun(options.brief);
  } catch (error) {
    const issues = (error as { issues?: unknown }).issues;
    throw validationFailed(
      Array.isArray(issues) ? (issues as readonly ZodIssueLike[]) : [],
      "Brief failed validation for a new run"
    );
  }

  let prior: Prior;
  try {
    prior = await generatePrior({ brief: options.brief, llm: options.llm, budget, ledger, now });
  } catch (error) {
    return {
      run: transitionRun(run, "failed", "prior"),
      prior: undefined,
      ledger: ledger.list(),
      evidence: [],
      observations: 0,
      turns: 0,
      stopReason: "prior_failed",
      error: toError(error),
      toolErrors: []
    };
  }

  run = persistPrior(run, prior);
  run = transitionRun(run, "investigating", "investigation");

  const controllerResult = await runController({
    state: run,
    brief: options.brief,
    prior,
    gateway: options.gateway,
    llm: options.llm,
    budget,
    ledger,
    now,
    ...(options.maxTurns !== undefined ? { maxTurns: options.maxTurns } : {})
  });

  return {
    run: controllerResult.run,
    prior: controllerResult.run.prior,
    ledger: ledger.list(),
    evidence: controllerResult.evidence,
    observations: controllerResult.observations,
    turns: controllerResult.turns,
    stopReason: controllerResult.stopReason,
    ...(controllerResult.error !== undefined ? { error: controllerResult.error } : {}),
    toolErrors: controllerResult.toolErrors
  };
}

export { createDeepSeekLlmClient, completeBounded, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "./llm.js";
export type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmToolCall,
  LlmToolDefinition,
  LlmUsage
} from "./llm.js";
export {
  DEEPSEEK_FLASH_PRICING,
  LLM_RESERVE_FRACTION,
  LLM_SPEND_LIMIT_FRACTION,
  LlmBudget,
  isDeepSeekPeakWindow,
  usageCostUsd
} from "./budget.js";
export type { LlmBudgetSnapshot, TokenUsage } from "./budget.js";
export { MAX_PRIOR_ATTEMPTS, PRIOR_SYSTEM_PROMPT, generatePrior, persistPrior } from "./prior.js";
export { createLedger } from "./ledger.js";
export type { Ledger, LedgerEntry } from "./ledger.js";
export { AGENT_TOOLS, executeToolCall, provenanceFromEnvelope } from "./tools.js";
export type { ToolObservation } from "./tools.js";
export { PLANNER_TURN_LIMIT, runController } from "./controller.js";
export type { ControllerOptions, ControllerResult, ControllerStopReason } from "./controller.js";
export { agentRunPhases, agentRunStatuses, createInitialRun, transitionRun } from "./state.js";
export type { AgentRunPhase, AgentRunStatus } from "./state.js";
export {
  AgentStateError,
  AgentToolError,
  LlmBudgetError,
  PriorConflictError,
  PriorGenerationError,
  missingDeepSeekConfiguration
} from "./errors.js";
