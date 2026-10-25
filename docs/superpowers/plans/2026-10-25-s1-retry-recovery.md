# S1 Partial-Run Recovery Implementation Plan

> **For agentic workers:** Execute this plan inline with TDD. Each task must be red, green, reviewed, and verified before the next task.

**Goal:** Give stopped, partial, and failed investigations an honest, visible Retry action that calls the existing server retry capability and returns the user to the live investigation.

**Architecture:** Reuse the existing orchestrator `retryRun()` as the canonical state transition. Add a typed same-origin POST route and browser client method, then render a recovery message/action in the S1 Agent Ledger when the persisted status is retryable. The Prior remains immutable; retry resumes investigation with the same Prior and no fabricated evidence.

**Tech Stack:** TypeScript, Express, Zod, React, Vitest, Playwright, existing SSE/run store/orchestrator.

## Global Constraints

- Qloo supplies cultural measurements; Zorq owns validation and state transitions; no fake rows or evidence.
- Prior Lock remains write-once and must survive retry unchanged.
- Retry is available only for `stopped`, `partial`, and `failed` statuses; completed runs remain unchanged.
- Use the existing `orchestrator.retryRun()` implementation; do not create a second retry engine.
- Server secrets remain server-only and no provider call is added by this UI fix.

---

### Task 1: Expose the existing retry capability through the typed API

**Files:**
- Modify: `src/server/routes.ts`
- Modify: `src/web/lib/api.ts`
- Test: `tests/serverHttp.test.ts`
- Test: `tests/web/api.test.ts`

**Interfaces:**
- Add `POST /api/runs/:id/retry` with the same `{ run }` response shape as stop.
- Add `retryRun(id, options?) => Promise<RunState>` in the browser API client.

- [x] **Step 1: Write failing HTTP and client tests**

Assert the route delegates to `orchestrator.retryRun(id)`, returns 200 with `{ run }`, and the client sends a POST with no body and validates the run response.

- [x] **Step 2: Run focused tests and observe the missing-route/client failure**

Run: `npm.cmd test -- --run tests/serverHttp.test.ts tests/web/api.test.ts`

Expected: FAIL because the route and client method do not exist.

- [x] **Step 3: Implement the minimal route and client method**

Reuse `runIdParamsSchema`, `runResponseSchema`, `mapRouteError`, and the existing stop response pattern. Do not modify orchestrator behavior.

- [x] **Step 4: Rerun focused tests**

Expected: PASS.

- [x] **Step 5: Commit**

`git commit -m "feat: expose run retry recovery route"`

### Task 2: Add S1 recovery presentation and action

**Files:**
- Modify: `src/web/screens/s1/LedgerPanel.tsx`
- Modify: `src/web/screens/s1/s1.css`
- Modify: `src/web/routes/RunRoute.tsx`
- Test: `tests/web/s1Model.test.ts` or the existing S1 view-model test location
- Test: `e2e/judge-flow.spec.ts`

**Interfaces:**
- Extend `LedgerPanel` with `recovery` data containing the retryable status, pending state, error, and `onRetry` callback.
- Keep normal active-run Stop controls and normal completed-run composition controls unchanged.

- [x] **Step 1: Write a failing UI/view-model or browser test**

For a stopped partial run, assert the ledger shows an honest recovery message and a `Retry investigation` button; while retrying, the button is disabled and says `Retrying investigation…`.

- [x] **Step 2: Run the focused/browser test and observe the missing recovery affordance**

Expected: FAIL because the current stopped ledger only renders the generic empty state.

- [x] **Step 3: Implement the minimal recovery UI**

Add a deterministic status-to-copy helper, render the recovery block only for retryable statuses, call `retryRun`, apply the returned server state, and let the existing SSE connection refresh the ledger. Preserve the Prior and do not fabricate rows.

- [x] **Step 4: Rerun focused tests and the S1 browser flow**

Expected: PASS with no console errors, page errors, or failed requests.

- [x] **Step 5: Commit**

`git commit -m "feat: add visible S1 retry recovery"`

### Task 3: Regression and phase evidence

**Files:**
- Modify: `IMPLEMENTATION_STATE.md`
- Test: full unit/typecheck/lint/build and relevant Playwright flows

- [x] **Step 1: Run the focused tests, then full unit suite**

Run: `npm.cmd test -- --run tests/serverHttp.test.ts tests/web/api.test.ts tests/web/s1Model.test.ts`; then `npm.cmd test`.

- [x] **Step 2: Run static and production verification**

Run: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and the relevant Playwright tests with a clean production server.

- [x] **Step 3: Inspect diff and record evidence**

Run `git diff --check`, inspect changed files, record any unrelated environment failures honestly, and update `IMPLEMENTATION_STATE.md` with the root cause and observed pass/fail evidence.

- [x] **Step 4: Commit the verification record**

`git commit -m "docs: record S1 retry recovery verification"`
