# Map blank-render and fast-reuse plan

## Goal

Make the S0 brief map and S1 investigation map render at a non-zero viewport,
start promptly after the first page paint, and reuse the existing MapLibre map
and its browser/tile cache when a place changes.

## Diagnosis

The map container receives MapLibre's `maplibregl-map` class. MapLibre's CSS is
loaded after the screen CSS and its equal-specificity `position: relative` rule
wins over the screen's absolute-fill rule. The container therefore collapses to
`0px` height even when the style request succeeds. Offline style/tile failures
remain an honest provider limitation and must keep the existing fallback.

## Bounded changes

1. Add a more-specific direct-child layout rule for both map consumers so the
   MapLibre container fills its parent.
2. Resize after construction/load and before camera fitting, covering deferred
   creation and changing layout dimensions.
3. Give deferred map loading a short deadline. Keep the same map handle alive
   for active-place changes so MapLibre's in-memory/browser cache is reused.

## Verification

- Browser diagnostic: map container and canvas have positive dimensions.
- Focused Vitest tests for deferred scheduling.
- Typecheck, lint, production build, and full Vitest suite.
- Inspect the diff and record the exact evidence in `IMPLEMENTATION_STATE.md`.
