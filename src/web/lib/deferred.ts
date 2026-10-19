export interface DeferredOptions {
  timeoutMs?: number;
}

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/** Schedule non-critical browser work after the first synchronous render path. */
export function scheduleDeferred(callback: () => void, options: DeferredOptions = {}): () => void {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const idleWindow = globalThis as typeof globalThis & IdleWindow;
  let cancelled = false;
  let handle: number | ReturnType<typeof globalThis.setTimeout>;
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
    if (idle) idleWindow.cancelIdleCallback?.(handle as number);
    else globalThis.clearTimeout(handle);
  };
}
