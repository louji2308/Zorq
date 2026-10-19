# S0 Static Layout and Adaptive Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a non-scrolling map-first S0 page with a right-only scrolling brief panel and fast, honest adaptive preference tags.

**Architecture:** Keep MapLibre ownership in `MapPanel`; remove preset-card rendering from `HomeRoute`; keep brief construction pure in `briefFormState`; derive adaptive preference options synchronously from a bounded local relationship graph. Submit selected phrases through the existing `Brief.constraints` boundary, where Qloo/server measurement and deterministic fit remain authoritative.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Vitest, Playwright.

## Global Constraints

- Preserve the Qloo/Zorq/LLM boundary: Qloo measures/resolves, Zorq validates/computes, LLM interprets/probes.
- Do not fabricate Qloo entities, evidence, scores, or measurements.
- Keep MapLibre and the map visible; only the right brief panel may scroll.
- Preserve 44px interaction targets and the existing monochrome selected/unselected language.
- Use TDD for behavior changes and verify before claiming completion.

---

### Task 1: Replace fixed constraint rectangles with adaptive preference state

**Files:**
- Modify: `src/web/screens/s0/briefFormState.ts`
- Modify: `src/web/screens/s0/BriefForm.tsx`
- Modify: `src/web/routes/HomeRoute.tsx`
- Test: `tests/web/s0Brief.test.ts`

**Interfaces:**
- Produce `COMMON_PREFERENCES`, `adaptivePreferenceTags(selected)`, and a string-based `toggleConstraint` state transition.
- Preserve `submitBriefForm(...).brief.constraints` as the server boundary; omit it when nothing is selected.

- [x] Write failing pure tests for common seed tags, adaptive suggestions after selection, nested suggestions, clear selected/unselected toggling, and submission of selected phrases.
- [x] Run `npx.cmd vitest run tests/web/s0Brief.test.ts` and confirm the new expectations fail because the old fixed chips/custom field remain.
- [x] Implement the local graph and remove `Custom` state/validation/input. Keep all selected tags in the available list even when they are no longer suggested.
- [x] Render each tag with `aria-pressed`, a visible “Selected” or “Available” state, and a “Suggested” marker for adaptive tags; include a short Qloo boundary note.
- [x] Rerun the focused test and inspect the brief payload.

### Task 2: Remove presets and lock the S0 viewport layout

**Files:**
- Modify: `src/web/routes/HomeRoute.tsx`
- Modify: `src/web/screens/s0/s0.css`
- Test: `tests/web/s0Brief.test.ts` and browser diagnostic script/e2e flow.

- [x] Remove the “Try a site” section and its `PresetCard`/hover activation wiring; keep the map and custom site flow.
- [x] Reduce `.s0-landing` desktop size to 70px with a responsive clamp.
- [x] Set the S0 shell, map, and side column to viewport height with hidden outer overflow; make `.s0-main` the right-side scroll owner.
- [x] Add narrow-layout rows so the map remains fixed and only the right brief region scrolls.
- [x] Run a browser check at a desktop viewport and assert `document.scrollHeight === document.clientHeight`, map overflow is hidden, right main overflow is auto, preset heading is absent, and heading size is reduced.

### Task 3: Align `/method` and verify the integrated page

**Files:**
- Modify: `src/server/method.ts`
- Modify: `IMPLEMENTATION_STATE.md`

- [x] Add the adaptive-preference boundary to the method's deterministic/Zorq section and preserve the existing known-limit list without overstating adaptive tags as Qloo evidence.
- [x] Run focused S0 tests, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`.
- [x] Run the browser flow with a valid style stub if MapTiler is unavailable; verify layout and selected/unselected states.
- [x] Inspect `git diff --check`, record evidence, and commit the coherent increment.
