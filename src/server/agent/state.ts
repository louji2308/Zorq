import { randomUUID } from "node:crypto";
import { z } from "zod";
import { briefSchema, type Brief } from "../../shared/brief.js";
import { runStateSchema, type RunState } from "../../shared/run.js";
import { AgentStateError } from "./errors.js";

export const agentRunStatuses = ["prior_pending", "investigating", "complete", "partial", "failed"] as const;
export type AgentRunStatus = (typeof agentRunStatuses)[number];

export const agentRunPhases = ["prior", "investigation"] as const;
export type AgentRunPhase = (typeof agentRunPhases)[number];

const ALLOWED_TRANSITIONS: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  prior_pending: ["investigating", "failed"],
  investigating: ["complete", "partial", "failed"],
  complete: [],
  partial: [],
  failed: []
};

const PHASE_ORDER: Record<AgentRunPhase, number> = {
  prior: 0,
  investigation: 1
};

const statusSchema = z.enum(agentRunStatuses);
const phaseSchema = z.enum(agentRunPhases);

export function createInitialRun(brief: Brief): RunState {
  const parsedBrief = briefSchema.parse(brief);
  const state: RunState = {
    id: randomUUID(),
    status: "prior_pending",
    phase: "prior",
    brief: parsedBrief
  };
  runStateSchema.parse(state);
  return Object.freeze(state);
}

export function transitionRun(state: RunState, status: AgentRunStatus, phase: AgentRunPhase): RunState {
  const currentStatus = statusSchema.safeParse(state.status);
  const currentPhase = phaseSchema.safeParse(state.phase);
  if (!currentStatus.success || !currentPhase.success) {
    throw new AgentStateError(`run carries an unknown status or phase: status=${state.status} phase=${state.phase}`);
  }
  const allowed = ALLOWED_TRANSITIONS[currentStatus.data];
  if (!allowed.includes(status)) {
    throw new AgentStateError(`illegal run transition: ${state.status} -> ${status}`, [
      { path: "status", message: `allowed from ${state.status}: ${allowed.join(", ") || "(none)"}` }
    ]);
  }
  if (PHASE_ORDER[phase] < PHASE_ORDER[currentPhase.data]) {
    throw new AgentStateError(`illegal phase regression: ${state.phase} -> ${phase}`, [
      { path: "phase", message: "phases only move forward" }
    ]);
  }
  if (status === "investigating" && state.prior === undefined) {
    throw new AgentStateError("cannot move a run to investigating before the Prior is persisted", [
      { path: "prior", message: "Prior Lock must be persisted first (Prior-before-Qloo)" }
    ]);
  }
  const next: RunState = { ...state, status, phase };
  runStateSchema.parse(next);
  return Object.freeze(next);
}
