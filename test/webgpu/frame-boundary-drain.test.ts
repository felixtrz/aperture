import { describe, expect, it } from "vitest";
import { frameBoundariesNeedGpuDrain } from "../../packages/webgpu/src/app/report.js";

const IDLE_FRAME = {
  readbackBoundary: null,
  gpuTimingReadbacks: [],
  occlusionQueryReadbacks: [],
  occlusionQueryCount: 0,
} as const;

describe("frameBoundariesNeedGpuDrain (AI-11)", () => {
  it("skips the GPU drain for frames without pending readbacks", () => {
    expect(frameBoundariesNeedGpuDrain(IDLE_FRAME)).toBe(false);
  });

  it("drains when a readback boundary was requested", () => {
    expect(
      frameBoundariesNeedGpuDrain({
        ...IDLE_FRAME,
        readbackBoundary: { boundary: "readback" },
      }),
    ).toBe(true);
  });

  it("drains when GPU timing readbacks are pending", () => {
    expect(
      frameBoundariesNeedGpuDrain({
        ...IDLE_FRAME,
        gpuTimingReadbacks: [{ pass: "opaque" }],
      }),
    ).toBe(true);
  });

  it("drains when occlusion query readbacks or queries are pending", () => {
    expect(
      frameBoundariesNeedGpuDrain({
        ...IDLE_FRAME,
        occlusionQueryReadbacks: [{ queries: 3 }],
      }),
    ).toBe(true);
    expect(
      frameBoundariesNeedGpuDrain({
        ...IDLE_FRAME,
        occlusionQueryCount: 2,
      }),
    ).toBe(true);
  });

  it("tolerates boundary shapes that omit optional readback families", () => {
    expect(frameBoundariesNeedGpuDrain({ readbackBoundary: null })).toBe(false);
    expect(
      frameBoundariesNeedGpuDrain({ readbackBoundary: { readback: {} } }),
    ).toBe(true);
  });
});
