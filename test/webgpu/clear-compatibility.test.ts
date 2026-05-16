import { describe, expect, it } from "vitest";

import { createClearCompatibilityReport } from "@aperture-engine/webgpu";
import { frameBoundaryFixture } from "./fixtures/frame-boundary.js";

describe("clear helper compatibility report", () => {
  it("reports ready when frame-boundary helpers cover clear requirements", () => {
    expect(createClearCompatibilityReport(frameBoundaryFixture())).toEqual({
      ready: true,
      diagnostics: [],
    });
  });

  it("reports missing texture view support", () => {
    expect(
      createClearCompatibilityReport(
        frameBoundaryFixture({
          texture: {
            valid: false,
            target: null,
            diagnostics: [
              {
                code: "currentTextureView.missingTextureView",
                message: "missing",
              },
            ],
          },
        }),
      ).diagnostics,
    ).toMatchObject([{ code: "clearCompatibility.missingTextureView" }]);
  });

  it("reports missing command encoder support", () => {
    expect(
      createClearCompatibilityReport(frameBoundaryFixture({ encoder: null }))
        .diagnostics,
    ).toMatchObject([{ code: "clearCompatibility.missingCommandEncoder" }]);
  });

  it("reports missing queue submit support", () => {
    expect(
      createClearCompatibilityReport(
        frameBoundaryFixture({
          submit: {
            valid: false,
            submitted: 0,
            skipped: 1,
            commandBufferKeys: ["command-buffer:frame"],
            diagnostics: [
              { code: "queueSubmit.missingSubmit", message: "missing" },
            ],
          },
        }),
      ).diagnostics,
    ).toMatchObject([{ code: "clearCompatibility.missingQueueSubmit" }]);
  });

  it("reports missing pass end support", () => {
    expect(
      createClearCompatibilityReport(
        frameBoundaryFixture({
          end: {
            valid: false,
            ended: false,
            diagnostics: [
              { code: "renderPassLifecycle.missingEnd", message: "missing" },
            ],
          },
        }),
      ).diagnostics,
    ).toMatchObject([{ code: "clearCompatibility.missingPassEnd" }]);
  });
});
