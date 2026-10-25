# Qloo driven S0 tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local S0 adaptive tag graph with a server-side Qloo tag preview and a compact muted tag rail beside the Goal field.

**Architecture:** Add a typed `POST /api/qloo/tags` route backed by the existing Qloo gateway. Extend the Qloo REST insight boundary to support `urn:tag`, resolve the Goal into Qloo signals, return bounded suggestions, and wire the browser to a debounced same-origin client request. Keep the actual run's Rapid Router Prior and Prior-before-Qloo investigation sequence unchanged.

**Tech Stack:** TypeScript, Zod, Express, existing Qloo REST/MCP gateway, React/Vite, Vitest, Playwright.

## Global Constraints

- `QLOO_API_KEY` stays server-only; no credential is placed in source, browser state sent to the bundle, logs, screenshots, or committed artifacts.
- `RAPIDROUTER_API_KEY` is used for every LLM call; the Qloo preview does not call an LLM.
- Qloo supplies cultural inference; Zorq code owns validation, deduplication, counts, and deterministic constraint fit.
- The actual run still locks the Prior before investigation Qloo evidence.
- No fabricated tag fallback is allowed; empty and unavailable Qloo states remain visible and usable.
- Existing Qloo budgets, cache, retry, timeout, and route validation remain in force.
- Use TDD: each production behavior starts with a failing test and is implemented minimally.

---

### Task 1: Shared Qloo tag preview contract

**Files:** Modify `src/shared/routes.ts` and `tests/routes.test.ts`.

**Produces:** `qlooTagSuggestionsRequestSchema`, `qlooTagSuggestionSchema`, and `qlooTagSuggestionsResponseSchema` plus inferred types.

- [ ] Add valid and invalid schema cases for `POST /api/qloo/tags`.
- [ ] Run `npm test -- --run tests/routes.test.ts` and verify the new cases fail because the schemas do not exist.
- [ ] Add bounded schemas: location, optional coordinates, objective, selected Qloo ids, at most eight results, `status` in `ok|empty|degraded`, and `source: "qloo"`.
- [ ] Re-run the focused test and verify it passes.
- [ ] Commit with `feat: add qloo tag preview contract` after `git diff --check`.

### Task 2: Qloo direct tag insights

**Files:** Modify `src/server/qloo/types.ts`, `restTransport.ts`, `gateway.ts`, and `guards.ts`; test `tests/qloo/restTransport.test.ts` and `tests/qloo/gateway.test.ts`.

**Produces:** `InsightsFilterType` accepts `tag`, maps to `urn:tag`, and projects tag results in `QlooInsightsResults.tags`.

- [ ] Add a failing REST/gateway test for `filterType: "tag"`, `signalTags`, `signalLocation`, `take`, and projected tag scores.
- [ ] Run `npm test -- --run tests/qloo/restTransport.test.ts tests/qloo/gateway.test.ts` and verify the new test fails.
- [ ] Add the tag filter type, special URN mapping, `tags` result field, `tags` result key, and gateway projection. Keep the preview REST-only; MCP remains entity-oriented.
- [ ] Re-run the focused Qloo tests and verify they pass.
- [ ] Commit with `feat: support qloo tag insights` after `git diff --check`.

### Task 3: Server preview service and route

**Files:** Create `src/server/qloo/tagSuggestions.ts`; modify `src/server/routes.ts`, `src/server/app.ts`, and `src/server/main.ts`; test `tests/qloo/tagSuggestions.test.ts` and `tests/serverHttp.test.ts`.

**Produces:** `buildQlooTagSuggestions(gateway, request)` and `POST /api/qloo/tags`.

- [ ] Add failing service tests for objective resolution, selected-id exclusion, case-insensitive dedupe, empty results, and degraded envelopes.
- [ ] Run `npm test -- --run tests/qloo/tagSuggestions.test.ts` and verify failure because the service is absent.
- [ ] Resolve the objective through Qloo, combine objective-derived ids with selected ids, call tag insights with site context and `take: 8`, then deterministically filter and cap results.
- [ ] Run the service tests and verify they pass.
- [ ] Add failing route tests for success, missing gateway, and typed upstream failure without key leakage.
- [ ] Run `npm test -- --run tests/serverHttp.test.ts` and verify route tests fail before wiring.
- [ ] Add the optional gateway dependency, body validation, error mapping, and real gateway wiring. The route remains behind existing rate limits and never exposes Qloo credentials.
- [ ] Re-run route tests and commit with `feat: add qloo tag preview route` after `git diff --check`.

### Task 4: Typed browser client and form state

**Files:** Modify `src/web/lib/api.ts`, `src/web/screens/s0/briefFormState.ts`; test `tests/web/api.test.ts` and `tests/web/s0Brief.test.ts`.

**Produces:** `getQlooTagSuggestions(request, options?)`, draft-only `{ id, label }` selection state, and `toggleQlooTag`.

- [ ] Add failing client tests for a typed POST and malformed response, plus state tests for select/remove and Brief label submission.
- [ ] Run `npm test -- --run tests/web/api.test.ts tests/web/s0Brief.test.ts` and verify failure.
- [ ] Add the client call, `selectedQlooTags` to `BriefFormState`, initialization, `toggleQlooTag`, and label-only submission through the existing `constraints` field.
- [ ] Re-run focused web tests and commit with `feat: expose qloo tag suggestions to the brief`.

### Task 5: Compact muted S0 Qloo tag rail

**Files:** Modify `src/web/routes/HomeRoute.tsx`, `src/web/screens/s0/BriefForm.tsx`, and `src/web/screens/s0/s0.css`; test `tests/web/s0Brief.test.ts` plus browser S0 coverage.

- [ ] Add a failing state expectation that the local base-four graph is gone and selected Qloo state survives refresh.
- [ ] Run the focused S0 test and verify failure.
- [ ] In `HomeRoute`, debounce 650 ms after a placed site and non-empty Goal, ignore stale responses with a request sequence, and show honest unavailable text.
- [ ] In `BriefForm`, replace the local preference fieldset with `Qloo-driven tags` immediately below the Goal textarea. Render small grey outlined buttons with focus, pressed state, and selected removal semantics.
- [ ] Add muted token-based CSS with no gradients, blur, shadow, or saturated treatment; preserve reduced-motion behavior.
- [ ] Run `npm test -- --run tests/web/s0Brief.test.ts` and `npm run typecheck`, then commit with `feat: render compact qloo driven tags`.

### Task 6: Traceability and integrated verification

**Files:** Modify `IMPLEMENTATION_STATE.md` and `ARCHITECTURE.md`.

- [ ] Record the user-requested bounded S0 preview deviation and the unchanged Prior-before-Qloo run sequence.
- [ ] Run `npm test`; expect zero failures and only the repository's explicit live skips.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`; expect exit 0 for each.
- [ ] Run the existing S0 browser smoke spec and verify the muted label, selected tag behavior, honest unavailable state, and zero Qloo key exposure in the bundle.
- [ ] Run `git diff --check`, inspect scope, commit traceability with `docs: record qloo driven tag preview`, and re-run the critical focused tests.
