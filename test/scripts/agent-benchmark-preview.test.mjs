import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PREVIEW_LIMITS,
  PREVIEW_SCHEMA,
  withDeadline,
} from "../../tools/agent-benchmark/preview-client.mjs";
import { CONTRACT } from "../../tools/agent-benchmark/contract.mjs";

function timers() {
  let callback;
  const state = { cleared: [], deadlines: [] };
  return {
    state,
    setTimeout(fn, milliseconds) {
      callback = fn;
      state.deadlines.push(milliseconds);
      return 7;
    },
    clearTimeout(id) {
      state.cleared.push(id);
    },
    expire() {
      callback();
    },
  };
}

describe("diagnostic preview deadline isolation", () => {
  it("bounds hung readiness promises and keeps the failing operation visible", async () => {
    const clock = timers();
    const result = withDeadline(
      () => new Promise(() => {}),
      30000,
      "application-ready",
      clock,
    );
    clock.expire();
    await expect(result).rejects.toThrow("application-ready (30000ms)");
    expect(clock.state).toEqual({ cleared: [7], deadlines: [30000] });
  });

  it("forwards normal results and original failures while clearing its timer", async () => {
    const clock = timers();
    await expect(withDeadline(() => 42, 30000, "frame", clock)).resolves.toBe(
      42,
    );
    expect(clock.state.cleared).toEqual([7]);
    const second = timers(),
      error = new Error("Original renderer error");
    await expect(
      withDeadline(
        () => {
          throw error;
        },
        30000,
        "render",
        second,
      ),
    ).rejects.toBe(error);
    expect(second.state.cleared).toEqual([7]);
    await expect(
      withDeadline(() => 42, 0, "invalid", timers()),
    ).rejects.toThrow(/Positive/);
  });

  it("keeps short previews explicitly diagnostic and leaves the original scoring contract frozen", () => {
    expect(PREVIEW_SCHEMA).toBe("aperture.agent-house-diagnostic-preview.v2");
    expect(PREVIEW_LIMITS).toEqual({
      warmupFrames: 3,
      diagnosticFrames: 3,
      operationMs: 30000,
      totalMs: 240000,
    });
    expect(CONTRACT).toMatchObject({
      warmupFrames: 60,
      measuredFrames: 120,
      viewport: { width: 1024, height: 768 },
    });
    const runner = readFileSync(
      new URL("../../tools/agent-benchmark/preview-run.mjs", import.meta.url),
      "utf8",
    );
    expect(runner).toContain("runVerifiedScene({");
    expect(runner).toContain("timeout: 270000");
    expect(runner).toContain(
      "await new Promise((resolve) => server.close(resolve))",
    );
    expect(runner).not.toMatch(
      /chromium\.launch|browserType\.launch|--no-sandbox/,
    );
  });
});
