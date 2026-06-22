import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGeneratedWorkerTickScheduler,
  DEFAULT_GENERATED_WORKER_TICK_RATE_HZ,
} from "../../packages/app/src/worker/loop.js";

describe("generated worker loop scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("paces worker ticks instead of immediately reposting through MessageChannel", () => {
    vi.useFakeTimers();
    vi.stubGlobal("MessageChannel", undefined);
    const scheduler = createGeneratedWorkerTickScheduler({ tickRateHz: 20 });
    let calls = 0;

    scheduler.schedule(() => {
      calls += 1;
    });

    vi.advanceTimersByTime(49);
    expect(calls).toBe(0);

    vi.advanceTimersByTime(1);
    expect(calls).toBe(1);

    scheduler.schedule(() => {
      calls += 1;
    });
    vi.advanceTimersByTime(49);
    expect(calls).toBe(1);

    vi.advanceTimersByTime(1);
    expect(calls).toBe(2);

    scheduler.dispose();
  });

  it("defaults to a high-refresh-rate cap", () => {
    expect(DEFAULT_GENERATED_WORKER_TICK_RATE_HZ).toBe(240);
  });
});
