import type { FrameBoundaryAssemblyReport } from "@aperture-engine/webgpu";

export function frameBoundaryFixture(
  overrides: Partial<FrameBoundaryAssemblyReport> = {},
): FrameBoundaryAssemblyReport {
  return {
    valid: true,
    texture: { valid: true, target: { view: {} }, diagnostics: [] },
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
    begin: { valid: true, pass: { end: () => {} }, diagnostics: [] },
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
