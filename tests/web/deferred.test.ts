import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleDeferred } from "../../src/web/lib/deferred.js";

describe("scheduleDeferred", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs through requestIdleCallback when the browser provides it", () => {
    vi.useFakeTimers();
    const idle = vi.fn((callback: () => void, options?: { timeout: number }) => {
      void options;
      return globalThis.setTimeout(callback, 25);
    });
    const cancelIdle = vi.fn((id: number) => globalThis.clearTimeout(id));
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
    const idle = vi.fn((callback: () => void) => globalThis.setTimeout(callback, 25));
    const cancelIdle = vi.fn((id: number) => globalThis.clearTimeout(id));
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
