import { runStateSchema, type RunState } from "../../shared/run.js";
import { OrchestratorStateError } from "./errors.js";

export const orchestratorRunStatuses = [
  "prior_pending",
  "investigating",
  "stopped",
  "complete",
  "partial",
  "failed"
] as const;
export type OrchestratorRunStatus = (typeof orchestratorRunStatuses)[number];

export const orchestratorRunPhases = ["prior", "investigation", "measurement"] as const;
export type OrchestratorRunPhase = (typeof orchestratorRunPhases)[number];

const ALLOWED_STATUS: Record<OrchestratorRunStatus, readonly OrchestratorRunStatus[]> = {
  prior_pending: ["investigating", "failed"],
  investigating: ["complete", "partial", "failed", "stopped"],
  stopped: ["investigating"],
  partial: ["investigating"],
  failed: ["investigating"],
  complete: []
};

const PHASE_ORDER: Record<OrchestratorRunPhase, number> = {
  prior: 0,
  investigation: 1,
  measurement: 2
};

function asStatus(value: string): OrchestratorRunStatus {
  if (!(orchestratorRunStatuses as readonly string[]).includes(value)) {
    throw new OrchestratorStateError(`run carries an unknown orchestrator status: ${value}`, [
      { path: "status", message: `expected one of ${orchestratorRunStatuses.join(", ")}` }
    ]);
  }
  return value as OrchestratorRunStatus;
}

function asPhase(value: string): OrchestratorRunPhase {
  if (!(orchestratorRunPhases as readonly string[]).includes(value)) {
    throw new OrchestratorStateError(`run carries an unknown orchestrator phase: ${value}`, [
      { path: "phase", message: `expected one of ${orchestratorRunPhases.join(", ")}` }
    ]);
  }
  return value as OrchestratorRunPhase;
}

export function isResumableStatus(status: string): boolean {
  return status === "prior_pending" || status === "investigating";
}

export function isRetryableStatus(status: string): boolean {
  return status === "failed" || status === "partial" || status === "stopped";
}

export function reenterInvestigationAfterRetry(state: RunState): RunState {
  const currentStatus = asStatus(state.status);
  asPhase(state.phase);
  if (!isRetryableStatus(currentStatus)) {
    throw new OrchestratorStateError(`cannot re-enter investigation after retry from status: ${state.status}`, [
      { path: "status", message: "allowed from failed, partial or stopped" }
    ]);
  }
  if (state.prior === undefined) {
    throw new OrchestratorStateError("cannot move a run to investigating before the Prior is persisted", [
      { path: "prior", message: "Prior Lock must be persisted first (Prior-before-Qloo)" }
    ]);
  }
  const next: RunState = { ...state, status: "investigating", phase: "investigation" };
  runStateSchema.parse(next);
  return Object.freeze(next);
}

export function transitionTo(
  state: RunState,
  status: OrchestratorRunStatus,
  phase?: OrchestratorRunPhase
): RunState {
  const currentStatus = asStatus(state.status);
  const currentPhase = asPhase(state.phase);
  if (status !== currentStatus && !ALLOWED_STATUS[currentStatus].includes(status)) {
    throw new OrchestratorStateError(`illegal orchestrator run transition: ${state.status} -> ${status}`, [
      {
        path: "status",
        message: `allowed from ${state.status}: ${ALLOWED_STATUS[currentStatus].join(", ") || "(none)"}`
      }
    ]);
  }
  const nextPhase = phase ?? currentPhase;
  if (PHASE_ORDER[nextPhase] < PHASE_ORDER[currentPhase]) {
    throw new OrchestratorStateError(`illegal phase regression: ${state.phase} -> ${nextPhase}`, [
      { path: "phase", message: "phases only move forward" }
    ]);
  }
  if (status === "investigating" && state.prior === undefined) {
    throw new OrchestratorStateError("cannot move a run to investigating before the Prior is persisted", [
      { path: "prior", message: "Prior Lock must be persisted first (Prior-before-Qloo)" }
    ]);
  }
  const next: RunState = { ...state, status, phase: nextPhase };
  runStateSchema.parse(next);
  return Object.freeze(next);
}
