import { describe, expect, it } from "vitest";

import {
  createFrameBoundarySmokeReport,
  type FrameBoundaryAssemblyReport,
} from "@aperture-engine/webgpu/test-support";
import { createFrameExecutionSmokeFixture } from "./fixtures/frame-execution.js";

describe("frame boundary smoke report", () => {
  it("reports ready when all frame boundary sections are ready", () => {
    const report = createFrameExecutionSmokeFixture().boundarySmoke;

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
  });

  it("reports missing texture view output", () => {
    const report = createFrameBoundarySmokeReport(
      boundary({
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
        attachments: null,
      }),
    );

    expect(report.ready).toBe(false);
    expect(report.sections.texture.diagnosticCodes).toEqual([
      "frameBoundary.textureFailed",
    ]);
    expect(report.sections.attachments.diagnosticCodes).toEqual([
      "frameBoundary.missingAttachments",
    ]);
  });

  it("reports missing command encoder output", () => {
    const report = createFrameBoundarySmokeReport(
      boundary({ encoder: null, begin: null }),
    );

    expect(report.ready).toBe(false);
    expect(report.sections.encoder).toMatchObject({
      present: false,
      diagnosticCodes: ["frameBoundary.missingEncoder"],
    });
  });

  it("reports failed execution and failed submit sections", () => {
    const report = createFrameBoundarySmokeReport(
      boundary({
        execution: {
          valid: false,
          commandCount: 1,
          executedCommands: 0,
          skippedCommands: 1,
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
          ],
        },
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
    );

    expect(report.ready).toBe(false);
    expect(report.sections.execution.diagnosticCodes).toEqual([
      "frameBoundary.executionFailed",
    ]);
    expect(report.sections.submit.diagnosticCodes).toEqual([
      "frameBoundary.submitFailed",
    ]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "queueSubmit.missingSubmit",
    );
  });
});

function boundary(
  overrides: Partial<FrameBoundaryAssemblyReport> = {},
): FrameBoundaryAssemblyReport {
  return {
    valid: true,
    texture: {
      valid: true,
      target: { view: {} },
      diagnostics: [],
    },
    attachments: {
      valid: true,
      plan: {
        colorAttachments: [{ view: {}, loadOp: "clear", storeOp: "store" }],
      },
      diagnostics: [],
    },
    encoder: {
      valid: true,
      resource: { resourceKey: "command-encoder:frame", encoder: {} },
      diagnostics: [],
    },
    begin: { valid: true, pass: {}, diagnostics: [] },
    execution: {
      valid: true,
      commandCount: 1,
      executedCommands: 1,
      skippedCommands: 0,
      drawCalls: 1,
      indexedDrawCalls: 0,
      nonIndexedDrawCalls: 1,
      diagnostics: [],
    },
    end: { valid: true, ended: true, diagnostics: [] },
    finish: {
      valid: true,
      resource: { resourceKey: "command-buffer:frame", commandBuffer: {} },
      diagnostics: [],
    },
    submit: {
      valid: true,
      submitted: 1,
      skipped: 0,
      commandBufferKeys: ["command-buffer:frame"],
      diagnostics: [],
    },
    ...overrides,
  };
}
