import { describe, expect, it } from "vitest";

import { resolveGpuTimings } from "../../packages/app/src/browser/gpu-timings-route.js";

describe("resolveGpuTimings", () => {
  it("defaults to undefined with no URL override", () => {
    expect(resolveGpuTimings(null)).toBeUndefined();
    expect(resolveGpuTimings(new URLSearchParams(""))).toBeUndefined();
  });

  it("enables GPU timing readbacks for explicit profiling flags", () => {
    expect(resolveGpuTimings(new URLSearchParams("gpuTimings=1"))).toBe(true);
    expect(resolveGpuTimings(new URLSearchParams("gpuTimings=true"))).toBe(
      true,
    );
  });

  it("disables GPU timing readbacks for explicit false flags", () => {
    expect(resolveGpuTimings(new URLSearchParams("gpuTimings=0"))).toBe(false);
    expect(resolveGpuTimings(new URLSearchParams("gpuTimings=false"))).toBe(
      false,
    );
  });

  it("ignores unrecognized values", () => {
    expect(
      resolveGpuTimings(new URLSearchParams("gpuTimings=yes")),
    ).toBeUndefined();
  });
});
