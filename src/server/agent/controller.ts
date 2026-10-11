import type { Brief } from "../../shared/brief.js";
import { ApiError } from "../../shared/errors.js";
import type { LedgerEvent } from "../../shared/events.js";
import type { CandidatePool, Prior, RunState, SiteRead } from "../../shared/run.js";
import type { QlooGateway } from "../qloo/index.js";
import type { EvidenceRecord } from "../evidence/index.js";
import type { LlmBudget } from "./budget.js";
import { AgentStateError, AgentToolError, LlmBudgetError } from "./errors.js";
import { completeBounded, type LlmClient, type LlmCompletionResult, type LlmMessage } from "./llm.js";
import type { Ledger } from "./ledger.js";
import {
  PROPOSE_CANDIDATE_POOL_TOOL,
  POOL_EVENT_LABEL,
  createObservationIndex,
  deriveSiteRead,
  formCandidatePool,
  poolFormationSummary,
  poolRejectionSummary,
  proposeCandidatePoolTool
} from "./pool.js";
import { transitionRun, type AgentRunStatus } from "./state.js";
import { AGENT_TOOLS, executeToolCall, parseToolArguments } from "./tools.js";

export const PLANNER_TURN_LIMIT = 3;

export const PLANNER_TOOLS = [...AGENT_TOOLS, proposeCandidatePoolTool];

export type ControllerStopReason = "llm_final" | "turn_limit" | "budget" | "outage" | "llm_error";

function buildSystemPrompt(maxTurns: number): string {
  return [
    "You are the bounded investigation agent of Zorq, cultural composition intelligence for physical places.",
    "You receive a site brief and the run's frozen Prior (immutable, generated before any Qloo call).",
    "Your job is to investigate the site's cultural context using ONLY the tools provided to you, then stop.",
    "",
    "How to adapt (decide this yourself from the observations you actually receive):",
    "- Site-local data is thin or empty: widen the scale (larger take, broader or city-level location).",
    "- A relationship between components is weak or missing: use qloo_bridge.",
    "- Evidence is uncertain or contested: re-measure independently with qloo_triangulate.",
    "- A concept or tag is unresolved: resolve it first with qloo_resolve_tags.",
    "- A component must be replaced: search role-preserving candidates with qloo_replace or qloo_search.",
    "- Keep probes decision-critical; you have at most " + String(maxTurns) + " turns, so do not repeat a probe that already answered you.",
    "",
    "Candidate pool (part of your job):",
    "- Before you stop, call propose_candidate_pool exactly once with the component structure the evidence supports.",
    "- Each component needs a role (Anchor, Social, Discovery, Experience, Night, Community), tags you actually resolved or saw, 1-5 exemplars copied exactly (id and name) from entities you observed, a provenance path (anchorPlace, qlooSignal, resolvedCategory, exemplarSet, tasteNeighborhood) and an evidenceState (measured, not measured, incomplete, unavailable).",
    "- The engine validates the draft; if it is rejected, read the error and correct the draft using the observed ids, names and tags — never invent substitutes.",
    "",
    "Hard rules:",
    "- Never invent entities, tags, numbers, percentages, or evidence. Numbers may only come from tool results.",
    "- Report exactly what the observations show, including empty or partial results; state uncertainty plainly.",
    "- If a tool call is rejected or fails, read the error and adapt; do not fabricate a substitute result.",
    "- When you have enough evidence (or the budget of turns is nearly spent), stop by replying with a concise plain-text summary of what the evidence shows and what remains unproven, with NO tool calls."
  ].join("\n");
}

export interface ControllerOptions {
  state: RunState;
  brief: Brief;
  prior: Prior;
  gateway: QlooGateway;
  llm: LlmClient;
  budget: LlmBudget;
  ledger: Ledger;
  now?: () => number;
  maxTurns?: number;
}

export interface InvestigationOutputs {
  siteRead?: SiteRead;
  candidatePool?: CandidatePool;
}

export interface ControllerResult {
  run: RunState;
  evidence: EvidenceRecord[];
  observations: number;
  turns: number;
  stopReason: ControllerStopReason;
  error?: Error;
  toolErrors: AgentToolError[];
  finalText: string | null;
  outputs: InvestigationOutputs;
}

function stopStatus(reason: ControllerStopReason, observations: number): AgentRunStatus {
  if (reason === "llm_final" && observations > 0) {
    return "complete";
  }
  return "partial";
}

function poolLedgerEvent(summary: string, resultCount: number): LedgerEvent {
  return {
    kind: "Compute",
    label: POOL_EVENT_LABEL,
    summary,
    duration: 0,
    cacheState: "n/a",
    resultCount
  };
}

export async function runController(options: ControllerOptions): Promise<ControllerResult> {
  if (options.state.prior === undefined) {
    throw new AgentStateError("controller requires a persisted Prior before any gateway call", [
      { path: "prior", message: "Prior Lock must be persisted before the investigation starts" }
    ]);
  }
  const now = options.now ?? Date.now;
  const maxTurns = Math.min(Math.max(1, options.maxTurns ?? PLANNER_TURN_LIMIT), PLANNER_TURN_LIMIT);
  const toolErrors: AgentToolError[] = [];
  const evidence: EvidenceRecord[] = [];
  const observationIndex = createObservationIndex();
  let candidatePool: CandidatePool | undefined;
  let observations = 0;
  let turns = 0;

  const messages: LlmMessage[] = [
    { role: "system", content: buildSystemPrompt(maxTurns) },
    {
      role: "user",
      content:
        `Brief:\n${JSON.stringify(options.brief)}\n\n` +
        `Locked Prior (immutable, qlooUsed=false, generated before any Qloo call):\n${JSON.stringify(options.prior)}\n\n` +
        "Begin the investigation using the available tools."
    }
  ];

  const outputs = (): InvestigationOutputs => {
    const siteRead = deriveSiteRead(observationIndex);
    return {
      ...(siteRead !== undefined ? { siteRead } : {}),
      ...(candidatePool !== undefined ? { candidatePool } : {})
    };
  };

  const finish = (
    stopReason: ControllerStopReason,
    error?: Error,
    finalText: string | null = null
  ): ControllerResult => ({
    run: transitionRun(options.state, stopStatus(stopReason, observations), "investigation"),
    evidence,
    observations,
    turns,
    stopReason,
    ...(error !== undefined ? { error } : {}),
    toolErrors,
    finalText,
    outputs: outputs()
  });

  const rejectPoolProposal = (call: { id: string; name: string }, error: AgentToolError): void => {
    toolErrors.push(error);
    options.ledger.append(poolLedgerEvent(poolRejectionSummary(error.message), 0));
    messages.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify({
        error: {
          code: "TOOL_REJECTED",
          reason: error.reason,
          message: error.message,
          hint: "This proposal never became the run's candidate pool. Correct the draft with observed ids, names and tags, or leave the pool unformed."
        }
      })
    });
  };

  const handlePoolProposal = (call: { id: string; name: string; arguments: string }): void => {
    if (candidatePool !== undefined) {
      rejectPoolProposal(
        call,
        new AgentToolError(
          "invalid_arguments",
          PROPOSE_CANDIDATE_POOL_TOOL,
          "a candidate pool was already accepted for this run; a second proposal is refused"
        )
      );
      return;
    }
    let pool: CandidatePool;
    try {
      pool = formCandidatePool({ draft: parseToolArguments(call), index: observationIndex });
    } catch (error) {
      if (error instanceof AgentToolError) {
        rejectPoolProposal(call, error);
        return;
      }
      throw error;
    }
    candidatePool = pool;
    options.ledger.append(poolLedgerEvent(poolFormationSummary(pool), pool.length));
    messages.push({
      role: "tool",
      toolCallId: call.id,
      name: call.name,
      content: JSON.stringify({
        tool: call.name,
        status: "ok",
        accepted: true,
        componentCount: pool.length,
        note: "The engine validated the pool. Finish with a short plain-text summary and no tool calls."
      })
    });
  };

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    let result: LlmCompletionResult;
    try {
      result = await completeBounded({
        llm: options.llm,
        budget: options.budget,
        ledger: options.ledger,
        request: {
          label: `investigate:turn ${turn}/${maxTurns}`,
          messages,
          tools: PLANNER_TOOLS
        }
      });
    } catch (error) {
      if (error instanceof LlmBudgetError) {
        turns = turn - 1;
        return finish("budget", error);
      }
      if (error instanceof ApiError) {
        turns = turn - 1;
        return finish("llm_error", error);
      }
      throw error;
    }
    turns = turn;

    if (result.toolCalls.length === 0) {
      return finish("llm_final", undefined, result.content);
    }

    const malformed = result.toolCalls.find((call) => typeof call.id !== "string" || call.id === "");
    if (malformed !== undefined) {
      return finish(
        "llm_error",
        new AgentToolError("malformed_call", malformed.name, `tool call "${malformed.name}" arrived without an id`)
      );
    }

    messages.push({
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls
    });

    for (const call of result.toolCalls) {
      if (call.name === PROPOSE_CANDIDATE_POOL_TOOL) {
        handlePoolProposal(call);
        continue;
      }
      try {
        const outcome = await executeToolCall({
          gateway: options.gateway,
          call,
          ledger: options.ledger,
          now
        });
        evidence.push(outcome.evidence);
        observationIndex.record(outcome.envelope, outcome.evidence.id);
        observations += 1;
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: outcome.observation });
      } catch (error) {
        if (error instanceof AgentToolError) {
          toolErrors.push(error);
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({
              error: {
                code: "TOOL_REJECTED",
                reason: error.reason,
                message: error.message,
                hint: "This call never reached Qloo. Correct the arguments or choose another tool."
              }
            })
          });
          continue;
        }
        if (error instanceof ApiError) {
          return finish("outage", error);
        }
        throw error;
      }
    }
  }

  return finish("turn_limit");
}
