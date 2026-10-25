# Qloo Preview Degraded Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the S0 Qloo preview fail honestly without browser-visible 5xx errors when the configured Qloo dependency is unreachable, while documenting the required network-capable local server startup.

**Architecture:** Keep Qloo server-only and preserve the existing gateway retry/error classification. Change only the best-effort S0 preview route to translate dependency/configuration failures into the existing typed `degraded` preview response; real run/investigation routes retain their operational error statuses. The local development contract will explicitly require outbound HTTPS access so a restricted terminal cannot be mistaken for a healthy Qloo integration.

**Tech Stack:** TypeScript, Express, Zod, Vitest, Vite.

## Global Constraints

- Qloo remains the cultural measurement provider; no hardcoded or fabricated tags.
- `QLOO_API_KEY` remains server-only and is never returned, logged, or placed in browser code.
- Rapid Router remains the only LLM route; this preview does not call an LLM.
- The actual run continues to lock the Prior before investigation Qloo calls.
- Existing tags remain visible during a preview failure; the form remains usable.
- The S0 preview may return `status: degraded` with zero tags; `/healthz` remains the operational configuration signal.
- Tests must be written first and must observe the expected failure before implementation.

---

### Task 1: Define the degraded preview route contract

**Files:**
- Modify: `tests/serverHttp.test.ts`
- Modify: `src/server/routes.ts`
- Modify: `docs/superpowers/specs/2026-10-25-qloo-driven-s0-tags-design.md`
- Modify: `IMPLEMENTATION_STATE.md`

**Interfaces:**
- Consumes: `QlooGateway`, `ApiError`, `qlooTagSuggestionsResponseSchema`.
- Produces: `POST /api/qloo/tags` returns HTTP 200 with `{ status: "degraded", tags: [], message }` for missing Qloo configuration or Qloo dependency failures; successful and empty responses remain unchanged.

- [ ] **Step 1: Change the route regression expectation first.** Update the existing upstream-failure test to require HTTP 200, `status: "degraded"`, an empty `tags` array, and a user-safe message without provider credentials. Add the same assertion for a missing gateway if the current route contract is changed for that path.
- [ ] **Step 2: Run the focused route test and verify it fails** because the current route returns 502/503.
- [ ] **Step 3: Add a small route-local mapper** that converts only `DEPENDENCY_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, and `RATE_LIMITED` errors from the best-effort preview into the typed degraded response. Leave validation, internal, and unrelated run-route errors on the existing error path.
- [ ] **Step 4: Run the focused route test and verify it passes**, including the no-secret assertion.
- [ ] **Step 5: Record the bounded deviation** from the earlier design wording: the preview keeps its honest degraded state in-band to avoid treating an optional cultural hint as a failed page request; the full investigation still stops/recovers through its existing operational error path.
- [ ] **Step 6: Commit** after `git diff --check` with `fix: make qloo preview degradation in-band`.

### Task 2: Make the local startup contract explicit

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `IMPLEMENTATION_STATE.md`

**Interfaces:**
- Consumes: existing `dev:server` and `dev:web` scripts.
- Produces: a documented local verification command and an explicit warning that the API process needs outbound HTTPS access to Qloo; no provider key is moved to the browser.

- [ ] **Step 1: Add a focused package-script/config test only if an existing script-test owner exists; otherwise keep this configuration-only change covered by the documented smoke command.** Do not add a new dependency or process manager.
- [ ] **Step 2: Add local instructions** beside the development commands: start the API in a network-capable terminal, start Vite separately, verify `GET /healthz`, then exercise `POST /api/qloo/tags`; explain that a restricted terminal produces `fetch failed`/502 from the old behavior and now produces an in-band degraded preview.
- [ ] **Step 3: Run the documented health and preview smoke commands** with the configured server and verify `200` with real tags when Qloo is reachable.
- [ ] **Step 4: Commit** after `git diff --check` with `docs: document qloo preview network requirement`.

### Task 3: Integrated verification

**Files:**
- No new production files.

- [ ] Run focused route/Qloo/web tests.
- [ ] Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --reporter=dot`, and `npm.cmd run build`.
- [ ] Run a fresh browser flow with a real site and concept: assert Qloo preview responses are 200, tags render, selecting a tag preserves it and appends only new labels, and console/page/request error collections are empty.
- [ ] Inspect the diff for secrets, fake tags, widened route behavior, or changed run/investigation error semantics.
- [ ] Update `IMPLEMENTATION_STATE.md` with the root cause, fix, verification evidence, and remaining operational requirement.
- [ ] Commit the verified integration/docs increment and confirm a clean worktree.
