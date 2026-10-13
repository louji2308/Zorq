import { validationFailed, type ZodIssueLike } from "../../shared/errors.js";
import type { LedgerEvent } from "../../shared/events.js";
import type { Brief } from "../../shared/brief.js";
import type { ReplaceRequest, ReplaceResponse } from "../../shared/routes.js";
import type { Prior, RunState } from "../../shared/run.js";
import { LOCK_LLM_BUDGET_USD } from "../config.js";
import { LlmBudget } from "../agent/budget.js";
import { runController, type ControllerResult, type InvestigationOutputs } from "../agent/controller.js";
import { toError } from "../agent/errors.js";
import type { LedgerEntry } from "../agent/ledger.js";
import { generatePrior, persistPrior } from "../agent/prior.js";
import { createInitialRun, transitionRun } from "../agent/state.js";
import type { EvidenceRecord } from "../evidence/index.js";
import { EvidenceConflict, RunNotFound, type StoredRun } from "../persistence/index.js";
import { OrchestratorStateError, RunBusyError } from "./errors.js";
import { runMeasurement } from "./measure.js";
import { rehydrateRun } from "./rehydrate.js";
import { applyReplacement, type ReplaceOutcome } from "./replace.js";
import {
  isResumableStatus,
  isRetryableStatus,
  transitionTo,
  type OrchestratorRunPhase,
  type OrchestratorRunStatus
} from "./status.js";
import type { Orchestrator, OrchestratorDeps, OrchestratorEvent } from "./types.js";
import { WriteThroughLedger } from "./writeThroughLedger.js";

const DEFAULT_WALL_CLOCK_CAP_MS = 120_000;
const ERROR_SUMMARY_LIMIT = 300;

function firstLine(error: Error): string {
  const line = error.message.split("\n")[0] ?? error.name;
  return line.length > ERROR_SUMMARY_LIMIT ? `${line.slice(0, ERROR_SUMMARY_LIMIT - 3)}...` : line;
}

function computeEvent(label: string, summary: string, duration = 0): LedgerEvent {
  return { kind: "Compute", label, summary, duration, cacheState: "n/a", resultCount: 0 };
}

function wallClockEvent(elapsedMs: number, capMs: number): LedgerEvent {
  return computeEvent(
    "run.wall_clock_cap",
    `wall clock cap of ${capMs}ms exceeded after ${Math.round(elapsedMs)}ms; run recorded as partial without a fabricated completion`,
    Math.round(elapsedMs)
  );
}

function measurementEvent(): LedgerEvent {
  return computeEvent(
    "measure.compose",
    "measurement phase boundary recorded; numeric measurement is owned by the deterministic engine and none is fabricated here"
  );
}

function captureEvent(outputs: InvestigationOutputs): LedgerEvent {
  const anchors = outputs.siteRead?.anchors?.length ?? 0;
  const heat = outputs.siteRead?.heat?.length ?? 0;
  const components = outputs.candidatePool?.length ?? 0;
  return computeEvent(
    "investigate:capture",
    `persisted investigation outputs: siteRead with ${anchors} anchor(s) and ${heat} heat cell(s); candidate pool with ${components} component(s)`
  );
}

function applyInvestigationOutputs(state: RunState, outputs: InvestigationOutputs): RunState {
  if (outputs.siteRead === undefined && outputs.candidatePool === undefined) {
    return state;
  }
  return {
    ...state,
    ...(outputs.siteRead !== undefined ? { siteRead: outputs.siteRead } : {}),
    ...(outputs.candidatePool !== undefined ? { candidatePool: outputs.candidatePool } : {})
  };
}

function stopEvent(reason: string): LedgerEvent {
  return computeEvent("run.stopped", `run stopped: ${reason}`);
}

function failureEvent(error: Error): LedgerEvent {
  return computeEvent("run.error", firstLine(error));
}

interface ActiveRecord {
  stopped: boolean;
}

interface ActivePass {
  record: ActiveRecord;
  ledger: WriteThroughLedger;
}

interface PassInput {
  state: RunState;
  ledger: WriteThroughLedger;
  budget: LlmBudget;
  startedAt: number;
  record: ActiveRecord;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const now = deps.now ?? Date.now;
  const wallClockCapMs = deps.wallClockCapMs ?? DEFAULT_WALL_CLOCK_CAP_MS;
  const activePasses = new Map<string, ActivePass>();
  const criticalTails = new Map<string, Promise<unknown>>();

  const emit = (event: OrchestratorEvent): void => {
    if (deps.eventSink === undefined) {
      return;
    }
    try {
      deps.eventSink(event);
    } catch {
      // sinks are advisory; a failing sink must never corrupt persisted run state
    }
  };
  const emitState = (state: RunState): void => {
    emit({ type: "state", runId: state.id, payload: state });
  };
  const emitPhase = (state: RunState, phase: OrchestratorRunPhase): void => {
    emit({ type: "phase", runId: state.id, payload: { phase, status: state.status } });
  };
  const emitLedger = (runId: string, entry: LedgerEntry): void => {
    emit({ type: "ledger", runId, payload: entry });
  };
  const emitError = (runId: string, error: unknown): void => {
    const failure = toError(error);
    const code = (error as { code?: unknown } | null)?.code;
    emit({
      type: "error",
      runId,
      payload: {
        name: failure.name,
        message: failure.message,
        ...(typeof code === "string" ? { code } : {})
      }
    });
  };

  const loadStored = async (runId: string): Promise<StoredRun> => {
    const stored = await deps.store.loadRun(runId);
    if (stored === null) {
      throw new RunNotFound(runId);
    }
    return stored;
  };

  const runCritical = <T>(runId: string, task: () => Promise<T>): Promise<T> => {
    const previous = criticalTails.get(runId) ?? Promise.resolve();
    const next: Promise<T> = previous.then(task, task);
    const tail: Promise<void> = next.then(
      () => undefined,
      () => undefined
    );
    criticalTails.set(runId, tail);
    void tail.then(() => {
      if (criticalTails.get(runId) === tail) {
        criticalTails.delete(runId);
      }
    });
    return next;
  };

  const saveUnlessStopped = (runId: string, next: RunState): Promise<RunState> =>
    runCritical(runId, async () => {
      const fresh = rehydrateRun(await loadStored(runId));
      if (fresh.status === "stopped") {
        return fresh;
      }
      await deps.store.saveRunState(runId, next);
      emitState(next);
      return next;
    });

  const budgetForPass = (): LlmBudget => deps.budget ?? new LlmBudget({ ceilingUsd: LOCK_LLM_BUDGET_USD, now });

  const requireBrief = (state: RunState): Brief => {
    if (state.brief === undefined) {
      throw new OrchestratorStateError(`run ${state.id} carries no brief; investigation cannot run`, [
        { path: "brief", message: "a stored run must keep the brief it was created with" }
      ]);
    }
    return state.brief;
  };

  const requirePrior = (state: RunState): Prior => {
    if (state.prior === undefined) {
      throw new OrchestratorStateError(`run ${state.id} has no persisted Prior; refusing to investigate`, [
        { path: "prior", message: "Prior Lock must exist before any gateway call" }
      ]);
    }
    return state.prior;
  };

  const persistEvidence = async (runId: string, records: readonly EvidenceRecord[]): Promise<void> => {
    for (const record of records) {
      try {
        await deps.store.appendEvidence(runId, record);
      } catch (error) {
        if (error instanceof EvidenceConflict) {
          continue;
        }
        throw error;
      }
    }
  };

  const capExit = async (input: PassInput, phase: OrchestratorRunPhase): Promise<RunState> => {
    const elapsedMs = Math.max(0, now() - input.startedAt);
    input.ledger.append(wallClockEvent(elapsedMs, wallClockCapMs));
    await input.ledger.flush();
    const next = transitionTo(input.state, "partial", phase);
    return saveUnlessStopped(input.state.id, next);
  };

  const failPass = async (input: PassInput, error: unknown): Promise<RunState> => {
    const runId = input.state.id;
    const failure = toError(error);
    emitError(runId, failure);
    try {
      input.ledger.append(failureEvent(failure));
      await input.ledger.flush();
      const fresh = rehydrateRun(await loadStored(runId));
      if (!isResumableStatus(fresh.status)) {
        return fresh;
      }
      return await saveUnlessStopped(runId, transitionTo(fresh, "failed"));
    } catch (persistError) {
      emitError(runId, persistError);
      throw error;
    }
  };

  const drivePass = async (input: PassInput): Promise<RunState> => {
    const runId = input.state.id;
    if (input.record.stopped) {
      return rehydrateRun(await loadStored(runId));
    }
    if (now() - input.startedAt > wallClockCapMs) {
      return capExit(input, "investigation");
    }

    const result: ControllerResult = await runController({
      state: input.state,
      brief: requireBrief(input.state),
      prior: requirePrior(input.state),
      gateway: deps.gateway,
      llm: deps.llm,
      budget: input.budget,
      ledger: input.ledger,
      now
    });
    await persistEvidence(runId, result.evidence);

    if (input.record.stopped) {
      await input.ledger.flush();
      return rehydrateRun(await loadStored(runId));
    }

    const terminal: OrchestratorRunStatus =
      result.stopReason === "llm_final" && result.observations > 0 ? "complete" : "partial";

    if (now() - input.startedAt > wallClockCapMs) {
      return capExit(input, "investigation");
    }

    emit({ type: "phase", runId, payload: { phase: "measurement", status: input.state.status } });
    if (result.outputs.siteRead !== undefined || result.outputs.candidatePool !== undefined) {
      input.ledger.append(captureEvent(result.outputs));
    }
    const measurement = await runMeasurement({
      state: applyInvestigationOutputs(input.state, result.outputs),
      gateway: deps.gateway,
      ledger: input.ledger,
      now,
      shouldStop: () => input.record.stopped
    });
    await persistEvidence(runId, measurement.evidence);
    input.ledger.append(measurementEvent());

    let finalStatus: OrchestratorRunStatus = terminal;
    if (measurement.degraded && finalStatus === "complete") {
      finalStatus = "partial";
    }
    const afterMeasurement = Math.max(0, now() - input.startedAt);
    if (afterMeasurement > wallClockCapMs) {
      input.ledger.append(wallClockEvent(afterMeasurement, wallClockCapMs));
      finalStatus = "partial";
    }
    const next = transitionTo(measurement.state, finalStatus, "measurement");
    await input.ledger.flush();
    return saveUnlessStopped(runId, next);
  };

  const runPass = async (input: PassInput): Promise<RunState> => {
    try {
      return await drivePass(input);
    } catch (error) {
      return failPass(input, error);
    }
  };

  async function startRun(input: { brief: Brief }): Promise<RunState> {
    const startedAt = now();
    let state: RunState;
    try {
      state = createInitialRun(input.brief);
    } catch (error) {
      const issues = (error as { issues?: unknown }).issues;
      throw validationFailed(
        Array.isArray(issues) ? (issues as readonly ZodIssueLike[]) : [],
        "Brief failed validation for a new run"
      );
    }

    const runId = state.id;
    const ledger = new WriteThroughLedger({
      store: deps.store,
      runId,
      armed: false,
      onAppend: (entry) => emitLedger(runId, entry)
    });
    const budget = budgetForPass();

    let prior: Prior;
    try {
      prior = await generatePrior({
        brief: requireBrief(state),
        llm: deps.llm,
        budget,
        ledger,
        now
      });
    } catch (error) {
      emitError(runId, error);
      throw error;
    }

    state = persistPrior(state, prior);
    state = transitionRun(state, "investigating", "investigation");
    try {
      await deps.store.createRun({ id: runId, state });
    } catch (error) {
      emitError(runId, error);
      throw error;
    }

    const record: ActiveRecord = { stopped: false };
    activePasses.set(runId, { record, ledger });
    try {
      try {
        await ledger.arm();
      } catch (error) {
        emitError(runId, error);
        throw error;
      }
      emitState(state);
      emitPhase(state, "investigation");
      return await runPass({ state, ledger, budget, startedAt, record });
    } finally {
      activePasses.delete(runId);
    }
  }

  async function resumeRun(runId: string): Promise<RunState> {
    const startedAt = now();
    const stored = await loadStored(runId);
    let state = rehydrateRun(stored);
    if (!isResumableStatus(state.status)) {
      return state;
    }
    if (state.prior === undefined) {
      throw new OrchestratorStateError(`run ${runId} reached the store without a Prior; refusing to resume`, [
        { path: "prior", message: "Prior Lock must be persisted before investigation" }
      ]);
    }
    if (state.phase === "prior") {
      state = transitionTo(state, "investigating", "investigation");
    }
    if (activePasses.has(runId)) {
      throw new RunBusyError(runId);
    }
    const ledger = new WriteThroughLedger({
      store: deps.store,
      runId,
      seed: stored.ledger,
      armed: true,
      onAppend: (entry) => emitLedger(runId, entry)
    });
    const record: ActiveRecord = { stopped: false };
    activePasses.set(runId, { record, ledger });
    try {
      emitState(state);
      emitPhase(state, "investigation");
      return await runPass({ state, ledger, budget: budgetForPass(), startedAt, record });
    } finally {
      activePasses.delete(runId);
    }
  }

  async function stopRun(runId: string, reason?: string): Promise<RunState> {
    const initial = rehydrateRun(await loadStored(runId));
    if (!isResumableStatus(initial.status)) {
      return initial;
    }
    const pass = activePasses.get(runId);
    if (pass !== undefined) {
      pass.record.stopped = true;
    }
    const why = reason !== undefined && reason.trim() !== "" ? reason.trim() : "operator request";

    return runCritical(runId, async () => {
      const fresh = rehydrateRun(await loadStored(runId));
      if (!isResumableStatus(fresh.status)) {
        return fresh;
      }
      const ledger =
        pass?.ledger ??
        new WriteThroughLedger({
          store: deps.store,
          runId,
          seed: await deps.store.listLedgerEvents(runId),
          armed: true,
          onAppend: (entry) => emitLedger(runId, entry)
        });
      ledger.append(stopEvent(why));
      await ledger.flush();
      const next = transitionTo(fresh, "stopped");
      await deps.store.saveRunState(runId, next);
      emitState(next);
      return next;
    });
  }

  async function retryRun(runId: string): Promise<RunState> {
    const startedAt = now();
    const stored = await loadStored(runId);
    const state = rehydrateRun(stored);
    if (isResumableStatus(state.status)) {
      return resumeRun(runId);
    }
    if (state.status === "complete") {
      return state;
    }
    if (!isRetryableStatus(state.status)) {
      return state;
    }
    if (state.prior === undefined) {
      throw new OrchestratorStateError(`run ${runId} has no persisted Prior; refusing to retry`, [
        { path: "prior", message: "Prior Lock must be persisted before investigation" }
      ]);
    }
    if (activePasses.has(runId)) {
      throw new RunBusyError(runId);
    }
    const ledger = new WriteThroughLedger({
      store: deps.store,
      runId,
      seed: stored.ledger,
      armed: true,
      onAppend: (entry) => emitLedger(runId, entry)
    });
    const record: ActiveRecord = { stopped: false };
    activePasses.set(runId, { record, ledger });
    try {
      let reentered: RunState;
      try {
        reentered = transitionTo(state, "investigating", "investigation");
        await deps.store.saveRunState(runId, reentered);
      } catch (error) {
        emitError(runId, error);
        throw error;
      }
      emitState(reentered);
      emitPhase(reentered, "investigation");
      return await runPass({ state: reentered, ledger, budget: budgetForPass(), startedAt, record });
    } finally {
      activePasses.delete(runId);
    }
  }

  async function replaceComponent(runId: string, request: ReplaceRequest): Promise<ReplaceResponse> {
    await loadStored(runId);
    if (activePasses.has(runId)) {
      throw new RunBusyError(runId);
    }
    return runCritical(runId, async () => {
      const stored = await loadStored(runId);
      if (activePasses.has(runId)) {
        throw new RunBusyError(runId);
      }
      const state = rehydrateRun(stored);
      const ledger = new WriteThroughLedger({
        store: deps.store,
        runId,
        seed: stored.ledger,
        armed: true,
        onAppend: (entry) => emitLedger(runId, entry)
      });
      const record: ActiveRecord = { stopped: false };
      activePasses.set(runId, { record, ledger });
      try {
        let outcome: ReplaceOutcome;
        try {
          outcome = await applyReplacement({ state, request, gateway: deps.gateway, ledger, now });
        } catch (error) {
          await ledger.flush().catch(() => undefined);
          throw error;
        }
        await persistEvidence(runId, outcome.evidence);
        await ledger.flush();
        await deps.store.saveRunState(runId, outcome.state);
        emitState(outcome.state);
        return {
          run: outcome.state,
          delta: outcome.delta,
          weakestLink: outcome.weakestLink
        };
      } finally {
        activePasses.delete(runId);
      }
    });
  }

  return { startRun, resumeRun, stopRun, retryRun, replaceComponent };
}
