import { describe, expect, it } from "vitest";

import { resolveNormalizedViewRectangle } from "@aperture-engine/webgpu";

describe("normalized view rectangle resolution", () => {
  it("resolves split-screen halves into target-space rectangles", () => {
    expect(
      resolveNormalizedViewRectangle({
        rect: [0, 0, 0.5, 1],
        target: { width: 960, height: 540 },
        label: "left-camera",
      }),
    ).toEqual({
      valid: true,
      rect: { x: 0, y: 0, width: 480, height: 540 },
      diagnostics: [],
    });

    expect(
      resolveNormalizedViewRectangle({
        rect: [0.5, 0, 0.5, 1],
        target: { width: 960, height: 540 },
        label: "right-camera",
      }),
    ).toEqual({
      valid: true,
      rect: { x: 480, y: 0, width: 480, height: 540 },
      diagnostics: [],
    });
  });

  it("clamps partially out-of-bounds rectangles to the target", () => {
    expect(
      resolveNormalizedViewRectangle({
        rect: [-0.25, 0.25, 0.5, 0.5],
        target: { width: 800, height: 600 },
      }),
    ).toEqual({
      valid: true,
      rect: { x: 0, y: 150, width: 200, height: 300 },
      diagnostics: [],
    });
  });

  it("diagnoses invalid target sizes and rectangles", () => {
    expect(
      resolveNormalizedViewRectangle({
        rect: [0, 0, 1, 1],
        target: { width: 0, height: 600 },
      }),
    ).toMatchObject({
      valid: false,
      rect: null,
      diagnostics: [{ code: "viewRectangle.invalidTargetSize" }],
    });

    expect(
      resolveNormalizedViewRectangle({
        rect: [0, 0, 0, 1],
        target: { width: 800, height: 600 },
      }),
    ).toMatchObject({
      valid: false,
      rect: null,
      diagnostics: [{ code: "viewRectangle.invalidRect" }],
    });
  });

  it("diagnoses rectangles that clamp to empty target space", () => {
    expect(
      resolveNormalizedViewRectangle({
        rect: [1.2, 0, 0.1, 1],
        target: { width: 800, height: 600 },
      }),
    ).toMatchObject({
      valid: false,
      rect: null,
      diagnostics: [{ code: "viewRectangle.emptyRect" }],
    });
  });
});
