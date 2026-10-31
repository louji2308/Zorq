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
  proposeCandidatePoolTool,
  type ObservationIndex
} from "./pool.js";
import { runSiteScan } from "./siteScan.js";
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
    "- Batch independent probes in one response. Spending a whole turn on one call wastes the turn budget.",
    "- Do not spend a turn on qloo_capabilities before your first cultural probe; call it only after a tool call fails with a transport error.",
    "",
    "Candidate pool (part of your job):",
    "- Before you stop, call propose_candidate_pool exactly once with the component structure the evidence supports.",
    "- Reserve your final turn for propose_candidate_pool. If you have not proposed it by then, propose it with the evidence you have instead of making another probe.",
    "- If the observations contain no entity that can ground a component, do not propose a placeholder or empty pool. Stop with a concise plain-text explanation of the coverage gap and what remains unmeasured.",
    "- Each component needs a role (Anchor, Social, Discovery, Experience, Night, Community), at most 10 tags you actually resolved or saw, 1-5 exemplars copied exactly (id and name) from entities you observed, a provenance path (anchorPlace, qlooSignal, resolvedCategory, exemplarSet, tasteNeighborhood) and an evidenceState (measured, not measured, incomplete, unavailable).",
    "- Every exemplar is an object {id, name}, never a string and never an empty array. Do not reuse an exemplar across components; each component must be grounded in distinct observed places.",
    "- The engine validates the draft; if it is rejected, read the error and correct the draft using the observed ids, names and tags — never invent substitutes.",
    "",
    "Hard rules:",
    "- Never invent entities, tags, numbers, percentages, or evidence. Numbers may only come from tool results.",
    "- Report exactly what the observations show, including empty or partial results; state uncertainty plainly.",
    "- If a tool call is rejected or fails, read the error and adapt; do not fabricate a substitute result.",
    "- When you have enough evidence (or the budget of turns is nearly spent), stop by replying with a concise plain-text summary of what the evidence shows and what remains unproven, with NO tool calls."
  ].join("\n");
}

function turnGuidance(
  turn: number,
  maxTurns: number,
  hasPool: boolean,
  mustProposePool: boolean,
  grounding?: string
): string {
  const remaining = maxTurns - turn + 1;
  const lines = [`Turn ${turn} of ${maxTurns}. ${remaining} turn(s) remain.`];
  if (hasPool) {
    lines.push(
      "A candidate pool is already accepted. Do not propose another; stop with a plain-text summary when no decision-critical probe remains."
    );
  } else if (remaining === 1) {
    if (mustProposePool) {
      lines.push(
        "This is the final turn. Call propose_candidate_pool now with the evidence you have; do not make another cultural probe.",
        "Every component must cite at least one exemplar object {id, name} copied exactly from an observed entity result. Omit a role you cannot ground; a smaller pool is correct. Never send an empty exemplars array."
      );
      if (grounding !== undefined && grounding !== "") {
        lines.push(`Observed grounding: ${grounding}`);
      }
    } else {
      lines.push(
        "This is the final turn, but no observed entity can ground a candidate component.",
        "Do not call propose_candidate_pool and do not invent or cite placeholder exemplars. Stop with a concise plain-text explanation of what Qloo returned, which probes were tried, and what remains unmeasured."
      );
    }
  } else {
    lines.push("Batch independent probes in one response. Reserve the final turn for propose_candidate_pool.");
  }
  return lines.join(" ");
}

function poolGrounding(index: ObservationIndex): string {
  const entities = index
    .observedEntities()
    .slice(0, 24)
    .map((entity) => `${entity.name ?? "(unnamed)"} [${entity.entityId}]`)
    .join("; ");
  const tags = index.observedTags().slice(0, 40).join("; ");
  return `entities: ${entities === "" ? "none" : entities}. tags: ${tags === "" ? "none" : tags}.`;
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
  siteScan?: boolean;
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

function stopStatus(
  reason: ControllerStopReason,
  observations: number,
  hasPool: boolean
): AgentRunStatus {
  if (observations === 0) {
    return "partial";
  }
  if (hasPool || reason === "llm_final") {
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
  let lastPoolRejection: string | undefined;
  const systemPrompt = buildSystemPrompt(maxTurns);

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        `Brief:\n${JSON.stringify(options.brief)}\n\n` +
        `Locked Prior (immutable, qlooUsed=false, generated before any Qloo call):\n${JSON.stringify(options.prior)}\n\n` +
        "Begin the investigation using the available tools."
    }
  ];

  if (options.siteScan === true) {
    try {
      const scan = await runSiteScan({
        brief: options.brief,
        gateway: options.gateway,
        ledger: options.ledger,
        index: observationIndex,
        now
      });
      observations += scan.observations;
      evidence.push(...scan.evidence);
      messages.push({ role: "user", content: scan.message });
    } catch (error) {
      options.ledger.append({
        kind: "Compute",
        label: "site.scan",
        summary: `site scan failed without inventing coverage: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: 0,
        cacheState: "n/a",
        resultCount: 0
      });
    }
  }

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
    run: transitionRun(
      options.state,
      stopStatus(stopReason, observations, candidatePool !== undefined),
      "investigation"
    ),
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
    lastPoolRejection = error.message;
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

  type ForcedPoolOutcome =
    | { kind: "completion"; completion: LlmCompletionResult }
    | { kind: "finished"; result: ControllerResult };

  const forcePool = async (label: string, prompt: string): Promise<ForcedPoolOutcome> => {
    messages.push({ role: "user", content: prompt });
    let result: LlmCompletionResult;
    try {
      result = await completeBounded({
        llm: options.llm,
        budget: options.budget,
        ledger: options.ledger,
        request: {
          label,
          messages,
          tools: PLANNER_TOOLS,
          toolChoice: { type: "function", name: PROPOSE_CANDIDATE_POOL_TOOL }
        }
      });
    } catch (error) {
      if (error instanceof LlmBudgetError) {
        return { kind: "finished", result: finish("budget", error) };
      }
      if (error instanceof ApiError) {
        return { kind: "finished", result: finish("llm_error", error) };
      }
      throw error;
    }

    const malformed = result.toolCalls.find(
      (call) => typeof call.id !== "string" || call.id === ""
    );
    if (malformed !== undefined) {
      return {
        kind: "finished",
        result: finish(
          "llm_error",
          new AgentToolError(
            "malformed_call",
            malformed.name,
            `tool call "${malformed.name}" arrived without an id`
          )
        )
      };
    }

    messages.push({
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls
    });
    for (const call of result.toolCalls) {
      if (call.name === PROPOSE_CANDIDATE_POOL_TOOL) {
        handlePoolProposal(call);
      } else {
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({
            error: {
              code: "TOOL_REJECTED",
              reason: "invalid_arguments",
              message: `Only propose_candidate_pool is allowed on ${label}.`,
              hint: "The planner turn budget is exhausted; stop after the pool proposal."
            }
          })
        });
      }
    }
    return { kind: "completion", completion: result };
  };

  const repairPrompt = (): string =>
    `Your candidate pool proposal was rejected: ${lastPoolRejection ?? "no valid pool was produced"}. ` +
    "Re-call propose_candidate_pool exactly once now. Fix every issue listed in the rejection, not just the first. " +
    "Copy every exemplar id and name exactly from the observed grounding, and omit any component you cannot ground. " +
    "Every exemplar must be an object {id, name}, never a string. Give every component 1-5 exemplars and at most 10 tags. " +
    "Do not reuse an exemplar across components. " +
    "Every tag must appear verbatim in the observed tags list below; remove any tag that does not, and do not paraphrase tags. " +
    "Never send an empty exemplars array. " +
    `Observed grounding: ${poolGrounding(observationIndex)}`;

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const canGroundPool = observationIndex.observedEntities().length > 0;
    const mustProposePool =
      turn === maxTurns && candidatePool === undefined && observations > 0 && canGroundPool;
    lastPoolRejection = undefined;
    messages[0] = {
      role: "system",
      content: `${systemPrompt}\n\n${turnGuidance(
        turn,
        maxTurns,
        candidatePool !== undefined,
        mustProposePool,
        mustProposePool ? poolGrounding(observationIndex) : undefined
      )}`
    };
    let result: LlmCompletionResult;
    try {
      result = await completeBounded({
        llm: options.llm,
        budget: options.budget,
        ledger: options.ledger,
        request: {
          label: `investigate:turn ${turn}/${maxTurns}`,
          messages,
          tools: PLANNER_TOOLS,
          ...(mustProposePool
            ? { toolChoice: { type: "function" as const, name: PROPOSE_CANDIDATE_POOL_TOOL } }
            : {})
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

    const malformed = result.toolCalls.find(
      (call) => typeof call.id !== "string" || call.id === ""
    );
    if (malformed !== undefined) {
      return finish(
        "llm_error",
        new AgentToolError(
          "malformed_call",
          malformed.name,
          `tool call "${malformed.name}" arrived without an id`
        )
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

    if (mustProposePool && candidatePool === undefined && lastPoolRejection !== undefined) {
      const repair = await forcePool("investigate:pool-repair", repairPrompt());
      if (repair.kind === "finished") {
        return repair.result;
      }
      if (candidatePool === undefined && lastPoolRejection !== undefined) {
        const second = await forcePool("investigate:pool-repair-2", repairPrompt());
        return second.kind === "finished"
          ? second.result
          : finish("turn_limit", undefined, second.completion.content);
      }
      return finish("turn_limit", undefined, repair.completion.content);
    }
  }

  if (
    candidatePool === undefined &&
    lastPoolRejection === undefined &&
    observations > 0 &&
    observationIndex.observedEntities().length > 0
  ) {
    const finalize = await forcePool(
      "investigate:pool-finalize",
      "The planner turn budget is exhausted, and the final probes observed at least one entity. " +
        "Call propose_candidate_pool exactly once now with the evidence you have; do not make another cultural probe. " +
        "Every component must cite 1-5 exemplar objects {id, name} copied exactly from an observed entity result. " +
        "Every tag must appear verbatim in the observed tags list below; give each component at most 10 tags. " +
        "Do not reuse an exemplar across components. Omit a role you cannot ground; a smaller pool is correct. " +
        "Never send an empty exemplars array, a string exemplar, or a placeholder. " +
        `Observed grounding: ${poolGrounding(observationIndex)}`
    );
    if (finalize.kind === "finished") {
      return finalize.result;
    }
    if (candidatePool === undefined && lastPoolRejection !== undefined) {
      const repair = await forcePool("investigate:pool-repair", repairPrompt());
      if (repair.kind === "finished") {
        return repair.result;
      }
      if (candidatePool === undefined && lastPoolRejection !== undefined) {
        const second = await forcePool("investigate:pool-repair-2", repairPrompt());
        return second.kind === "finished"
          ? second.result
          : finish("turn_limit", undefined, second.completion.content);
      }
      return finish("turn_limit", undefined, repair.completion.content);
    }
    return finish("turn_limit", undefined, finalize.completion.content);
  }

  return finish("turn_limit");
}
