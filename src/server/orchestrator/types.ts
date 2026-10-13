import type { Brief } from "../../shared/brief.js";
import type { RunState } from "../../shared/run.js";
import type { ReplaceRequest, ReplaceResponse } from "../../shared/routes.js";
import type { LlmBudget } from "../agent/budget.js";
import type { LlmClient } from "../agent/llm.js";
import type { QlooGateway } from "../qloo/index.js";
import type { RunStore } from "../persistence/index.js";

export type OrchestratorEventType = "state" | "phase" | "ledger" | "error";

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  runId: string;
  payload: unknown;
}

export interface OrchestratorDeps {
  store: RunStore;
  gateway: QlooGateway;
  llm: LlmClient;
  budget?: LlmBudget;
  now?: () => number;
  wallClockCapMs?: number;
  eventSink?: (event: OrchestratorEvent) => void;
}

export interface Orchestrator {
  startRun(input: { brief: Brief }): Promise<RunState>;
  resumeRun(runId: string): Promise<RunState>;
  stopRun(runId: string, reason?: string): Promise<RunState>;
  retryRun(runId: string): Promise<RunState>;
  replaceComponent(runId: string, request: ReplaceRequest): Promise<ReplaceResponse>;
}
