import { describe, expect, it } from "vitest";

import { summarizeFrameBoundaryDiagnostics } from "../../src/index.js";
import { frameBoundaryFixture } from "./fixtures/frame-boundary.js";

describe("frame boundary diagnostic summary", () => {
  it("reports ready for boundaries without diagnostics", () => {
    expect(summarizeFrameBoundaryDiagnostics(frameBoundaryFixture())).toEqual({
      ready: true,
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("summarizes mixed failure diagnostics as warnings by default", () => {
    const report = summarizeFrameBoundaryDiagnostics(
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
        submit: {
          valid: false,
          submitted: 0,
          skipped: 1,
          commandBufferKeys: [],
          diagnostics: [
            { code: "queueSubmit.missingSubmit", message: "missing" },
          ],
        },
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.diagnostics).toMatchObject({
      total: 2,
      bySeverity: { info: 0, warning: 2, error: 0 },
      byCode: {
        "currentTextureView.missingTextureView": 1,
        "queueSubmit.missingSubmit": 1,
      },
    });
  });

  it("counts repeated diagnostic codes", () => {
    const report = summarizeFrameBoundaryDiagnostics(
      frameBoundaryFixture({
        execution: {
          valid: false,
          commandCount: 2,
          executedCommands: 0,
          skippedCommands: 2,
          drawCalls: 0,
          indexedDrawCalls: 0,
          nonIndexedDrawCalls: 0,
          diagnostics: [
            {
              code: "renderPassCommandExecutor.missingMethod",
              method: "draw",
              renderId: 1,
              message: "missing",
            },
            {
              code: "renderPassCommandExecutor.missingMethod",
              method: "draw",
              renderId: 2,
              message: "missing",
            },
          ],
        },
      }),
    );

    expect(report.diagnostics.byCode).toMatchObject({
      "renderPassCommandExecutor.missingMethod": 2,
    });
  });
});
