# S0 Map First-Load Performance Design

## Goal

Make the first page usable sooner while preserving the S0 map as the primary visual and preserving its existing MapTiler failure, retry, marker, camera, and point-pick behavior.

## Current finding

`HomeRoute` imports `MapPanel`, which imports `src/web/lib/map.ts` at module evaluation time. That pulls MapLibre GL, its CSS, and the worker URL into the initial browser entry path. The current production entry asset is approximately 1.5 MB before the map can be deferred. `MapPanel` also constructs the MapLibre instance immediately on mount, causing the style and tile request to compete with first-page rendering.

## Chosen approach

Keep `MapPanel` mounted immediately so the page retains its full-height map surface and honest loading state, but defer the MapLibre implementation behind a dynamic import scheduled after the browser has had an opportunity to paint the page. The dynamic import creates a separate map chunk. Once it resolves, `MapPanel` constructs the map using the existing `createS0Map` contract and applies the latest props.

The scheduling policy is:

1. Use `requestIdleCallback` when available, with a bounded timeout so the map is not starved.
2. Fall back to a short `setTimeout` for browsers without `requestIdleCallback`.
3. Cancel the scheduled work and ignore a late module resolution after unmount or retry cleanup.

This changes only when the renderer is loaded; it does not change the provider, map style, public key boundary, map layers, or user-visible failure semantics.

## Component/data flow

```text
HomeRoute
  -> MapPanel renders canvas + loading label immediately
  -> idle/timeout callback imports ../../lib/map.js
  -> createS0Map(canvas, options)
  -> existing onReady/onFailure and handle methods drive the map
```

`MapPanel` remains the owner of lifecycle and retry state. `map.ts` remains the canonical owner of MapLibre construction. No duplicate map implementation or provider path is introduced.

## Error handling and invariants

- A failed dynamic import is treated like a map failure and exposes the existing honest failure veil with retry.
- A late import or map-ready callback after unmount must not update React state or retain a map handle.
- Missing `VITE_MAPTILER_KEY` still avoids importing MapLibre and keeps the existing `no-key` copy.
- Existing preset markers, active-site focus, crosshair point-pick, S1 anchors/heat, reduced-motion behavior, and cleanup remain unchanged.
- No Qloo, server, secret, or product-flow behavior changes.

## Verification

- Add a focused test for the deferral scheduler/cancellation behavior without importing MapLibre in the test environment.
- Run the focused test and confirm it fails before the implementation, then passes after it.
- Run typecheck, lint, the full Vitest suite, and the production build.
- Inspect `dist/web/assets` to confirm the entry asset no longer contains the MapLibre code path and a separate map chunk is emitted.
- Run the existing S0 browser smoke test to confirm the landing content and map failure-safe page remain usable.

## Non-goals

- Replacing MapLibre or MapTiler.
- Removing the map from the first page.
- Changing the visual design or map styling.
- Adding a server-side map proxy or caching layer.
- Optimizing unrelated backend or run-start latency.
