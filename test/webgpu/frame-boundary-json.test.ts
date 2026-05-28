import { describe, expect, it } from "vitest";

import {
  frameBoundaryReportToJson,
  frameBoundaryReportToJsonValue,
  type FrameBoundaryAssemblyReport,
} from "@aperture-engine/webgpu/test-support";

describe("frame boundary JSON helpers", () => {
  it("creates JSON-safe values for ready frame boundary reports", () => {
    expect(frameBoundaryReportToJsonValue(boundary())).toEqual({
      valid: true,
      sections: {
        texture: true,
        attachments: true,
        encoder: true,
        begin: true,
        execution: true,
        renderBundle: null,
        end: true,
        finish: true,
        submit: true,
      },
      counts: {
        colorTargets: 1,
        commands: 2,
        executedCommands: 2,
        skippedCommands: 0,
        drawCalls: 1,
        renderBundleEncodedCommands: 0,
        executedRenderBundles: 0,
        submittedCommandBuffers: 1,
      },
      renderBundle: null,
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("creates JSON-safe values for failed reports without handles", () => {
    const value = frameBoundaryReportToJsonValue(
      boundary({
        valid: false,
        execution: {
          valid: false,
          commandCount: 2,
          executedCommands: 1,
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
      }),
    );

    expect(value.valid).toBe(false);
    expect(value.sections.execution).toBe(false);
    expect(value.counts).toMatchObject({
      commands: 2,
      executedCommands: 1,
      skippedCommands: 1,
      drawCalls: 0,
    });
    expect(value.diagnostics.byCode).toMatchObject({
      "renderPassCommandExecutor.missingMethod": 1,
    });
    expect(JSON.stringify(value)).not.toContain("command-buffer-handle");
  });

  it("serializes stable repeated JSON output", () => {
    const report = boundary();

    expect(frameBoundaryReportToJson(report)).toBe(
      frameBoundaryReportToJson(report),
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
      target: { view: "texture-view-handle" },
      diagnostics: [],
    },
    attachments: {
      valid: true,
      plan: {
        colorAttachments: [
          { view: "texture-view-handle", loadOp: "clear", storeOp: "store" },
        ],
      },
      diagnostics: [],
    },
    encoder: {
      valid: true,
      resource: {
        resourceKey: "command-encoder:frame",
        encoder: "command-encoder-handle",
      },
      diagnostics: [],
    },
    begin: { valid: true, pass: { end: () => {} }, diagnostics: [] },
    execution: {
      valid: true,
      commandCount: 2,
      executedCommands: 2,
      skippedCommands: 0,
      drawCalls: 1,
      indexedDrawCalls: 1,
      nonIndexedDrawCalls: 0,
      diagnostics: [],
    },
    end: { valid: true, ended: true, diagnostics: [] },
    finish: {
      valid: true,
      resource: {
        resourceKey: "command-buffer:frame",
        commandBuffer: "command-buffer-handle",
      },
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
