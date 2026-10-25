# S0 Map First-Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defer the MapLibre renderer until after the S0 landing content can paint, while preserving the existing map behavior and failure-safe UX.

**Architecture:** Keep `MapPanel` and `InvestigateMap` as their lifecycle owners and keep `src/web/lib/map.ts` as the only MapLibre owner. Add a small browser scheduling helper, dynamically import the map module from both consumers, and cancel scheduled/late work on cleanup and retry. This lets Vite emit MapLibre in a separate chunk without changing the map provider or visual surface.

**Tech Stack:** React 19, TypeScript, Vite 8, MapLibre GL JS 6, Vitest 5, existing S0 MapPanel and browser smoke tests.

## Global Constraints

- Use MapLibre GL JS + MapTiler Free as the locked map stack.
- The browser may contain only public `VITE_MAPTILER_KEY`; no Qloo, Rapid Router, Turso, or MCP secrets.
- Map/key failures must remain honest and must not block the S0 right column or preset path.
- Existing marker, active-site, radius-ring, crosshair, anchors, heat, reduced-motion, and retry behavior must remain intact.
- Production code must not fabricate map data or hide provider failures.
- No unrelated server, Qloo, agent, persistence, or visual redesign work.

## Files and responsibilities

- Create: `src/web/lib/deferred.ts` — browser-safe idle/timeout scheduler with cancellation.
- Modify: `src/web/screens/s0/MapPanel.tsx` — dynamically import `map.ts` after scheduling and wire the existing lifecycle to the loaded module.
- Create: `tests/web/deferred.test.ts` — focused scheduler regression tests.
- Modify: `IMPLEMENTATION_STATE.md` — factual evidence, decision, risk, and next action entry.
- Create: `docs/superpowers/specs/2026-10-19-s0-map-first-load-design.md` — approved design, already committed before implementation.

### Task 1: Prove the scheduling contract with tests

**Files:**
- Create: `tests/web/deferred.test.ts`
- Modify: `src/web/screens/s1/InvestigateMap.tsx` — apply the same deferred import so the shared route graph cannot pull MapLibre into the initial entry chunk.
- Create: `src/web/lib/deferred.ts`

**Interfaces:**
- Produces `scheduleDeferred(callback: () => void, options?: { timeoutMs?: number }): () => void`.
- The returned cleanup function is idempotent and prevents a callback that has not yet run.
- Uses `requestIdleCallback` with a timeout when present; otherwise uses `setTimeout`.

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleDeferred } from "../../src/web/lib/deferred.js";

describe("scheduleDeferred", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs through requestIdleCallback when the browser provides it", () => {
    vi.useFakeTimers();
    const idle = vi.fn((callback: () => void) => {
      return window.setTimeout(callback, 25);
    });
    const cancelIdle = vi.fn((id: number) => window.clearTimeout(id));
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("cancelIdleCallback", cancelIdle);
    const callback = vi.fn();

    scheduleDeferred(callback, { timeoutMs: 400 });
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);
    expect(callback).toHaveBeenCalledOnce();
    expect(idle).toHaveBeenCalledOnce();
    expect(idle.mock.calls[0]?.[1]).toEqual({ timeout: 400 });
  });

  it("cancels the pending idle callback and does not run it", () => {
    vi.useFakeTimers();
    const idle = vi.fn((callback: () => void) => window.setTimeout(callback, 25));
    const cancelIdle = vi.fn((id: number) => window.clearTimeout(id));
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("cancelIdleCallback", cancelIdle);
    const callback = vi.fn();

    const cancel = scheduleDeferred(callback);
    cancel();
    cancel();
    vi.runAllTimers();

    expect(cancelIdle).toHaveBeenCalledOnce();
    expect(callback).not.toHaveBeenCalled();
  });

  it("falls back to setTimeout when idle callbacks are unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    const callback = vi.fn();

    scheduleDeferred(callback, { timeoutMs: 10 });
    vi.advanceTimersByTime(9);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the expected red failure**

Run: `npx vitest run tests/web/deferred.test.ts`

Expected: FAIL because `src/web/lib/deferred.ts` does not exist yet.

- [ ] **Step 3: Implement the smallest scheduler**

```ts
export interface DeferredOptions {
  timeoutMs?: number;
}

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export function scheduleDeferred(callback: () => void, options: DeferredOptions = {}): () => void {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const idleWindow = globalThis as typeof globalThis & IdleWindow;
  let cancelled = false;
  let handle: number;
  let idle = false;

  const run = (): void => {
    if (cancelled) return;
    cancelled = true;
    callback();
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    idle = true;
    handle = idleWindow.requestIdleCallback(run, { timeout: timeoutMs });
  } else {
    handle = globalThis.setTimeout(run, timeoutMs);
  }

  return (): void => {
    if (cancelled) return;
    cancelled = true;
    if (idle) idleWindow.cancelIdleCallback?.(handle);
    else globalThis.clearTimeout(handle);
  };
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npx vitest run tests/web/deferred.test.ts`

Expected: 3 tests pass with 0 failures.

- [ ] **Step 5: Commit the tested helper**

```bash
git add src/web/lib/deferred.ts tests/web/deferred.test.ts
git commit -m "test: cover deferred browser work scheduling"
```

### Task 2: Defer MapLibre construction in both map consumers

**Files:**
- Modify: `src/web/screens/s0/MapPanel.tsx`
- Modify: `src/web/screens/s1/InvestigateMap.tsx`

**Interfaces:**
- Both consumers use `scheduleDeferred` from `../../lib/deferred.js`.
- Both dynamically import `../../lib/map.js` and call its existing `createS0Map(container, options)`.
- Each applies the latest props after the async import resolves, so updates during the deferral window are not lost.

- [ ] **Step 1: Replace the static MapLibre import with a deferred dynamic import**

Change the top-level import to:

```ts
import { scheduleDeferred } from "../../lib/deferred.js";
import type { MapSite, S0MapHandle } from "../../lib/map.js";
```

Then use this lifecycle effect:

```ts
  useEffect(() => {
    if (apiKey === null) {
      setStatus("no-key");
      return;
    }
    const container = containerRef.current;
    if (container === null) return;

    let cancelled = false;
    let handle: S0MapHandle | null = null;
    setStatus("loading");
    const cancelDeferred = scheduleDeferred(() => {
      void import("../../lib/map.js")
        .then(({ createS0Map }) => {
          if (cancelled) return;
          handle = createS0Map(container, {
            apiKey,
            onSitePick: (point) => onSitePickRef.current(point),
            onReady: () => setStatus("ready"),
            onFailure: () => setStatus("failed")
          });
          handleRef.current = handle;
        })
        .catch(() => {
          if (!cancelled) setStatus("failed");
        });
    });

    return () => {
      cancelled = true;
      cancelDeferred();
      handle?.destroy();
      handleRef.current = null;
    };
  }, [apiKey, attempt]);
```

Keep the existing `setPresets`, `focusSite`, `setCrosshair`, and rendering effects unchanged; they continue to target `handleRef.current` and therefore apply to the loaded map on the next prop update. Add analogous refs and post-import application for `InvestigateMap`'s `site`, `anchors`, and `heat`. All map imports must remain type-only at module scope so they cannot pull MapLibre into the entry chunk.

- [ ] **Step 2: Run typecheck and focused existing S0 logic tests**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npx vitest run tests/web/s0Brief.test.ts tests/web/s0Geocode.test.ts tests/web/s0Presets.test.ts`

Expected: all selected tests pass.

- [ ] **Step 3: Build and inspect code splitting**

Run: `npm run build`

Expected: exit code 0 and `dist/web/assets` contains a separate map-related chunk in addition to the entry asset and worker.

Inspect: `Get-ChildItem dist/web/assets | Sort-Object Length -Descending | Select-Object Name,Length`

Expected: the entry asset is smaller than the previous approximately 1.5 MB entry and the map module is emitted separately.

- [ ] **Step 4: Run the browser smoke test**

Run: `npm run test:e2e -- e2e/smoke.spec.ts`

Expected: the S0 landing page test passes with no page errors or unexpected console errors.

- [ ] **Step 5: Commit the deferred map integration**

```bash
git add src/web/screens/s0/MapPanel.tsx
git commit -m "perf: defer S0 MapLibre loading until idle"
```

### Task 3: Record evidence and run the full verification ladder

**Files:**
- Modify: `IMPLEMENTATION_STATE.md`

- [ ] **Step 1: Record the factual change**

Add a dated entry under the current phase stating that S0 MapLibre is now loaded through a deferred dynamic import, the initial entry/map chunk sizes observed before and after, and the exact tests/build commands run. Record any browser/network limitation as a known risk rather than claiming a measured field improvement without evidence.

- [ ] **Step 2: Run full verification**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0 with no errors.

Run: `npm test`

Expected: the full Vitest suite passes with no failures.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Inspect the final diff and commit the evidence**

```bash
git diff --check
git status --short
git diff --stat HEAD~2
git add IMPLEMENTATION_STATE.md
git commit -m "docs: record deferred S0 map verification"
```

Expected: only the design, plan, deferred helper/test, MapPanel integration, and state record are changed; no secrets, debug artifacts, or unrelated files are staged.

## Self-review

- Spec coverage: preserves the locked MapLibre/MapTiler stack, S0 map presence, failure behavior, and browser-visible public-key boundary; adds only a load-timing optimization.
- Placeholder scan: no TBD/TODO/“implement later” steps.
- Type consistency: `MapSite` and `S0MapHandle` are type-only imports; the runtime module is loaded only through `import("../../lib/map.js")`; the helper returns a cleanup function used by `MapPanel`.
- Verification gap: exact field-level first contentful paint improvement requires a browser performance trace and is not claimed unless measured; the build split is the deterministic regression guard.
