import { describe, expect, it } from "vitest";

import {
  assembleFrameBoundary,
  type RenderPassCommand,
} from "../../src/index.js";

describe("frame boundary assembly helper", () => {
  it("assembles an all-ready injected frame boundary", () => {
    const events: string[] = [];
    const report = assembleFrameBoundary({
      context: contextWithView({ label: "view" }),
      device: device(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      commands: [drawCommand()],
      label: "frame",
      clearColor: [0, 0, 0, 1],
    });

    expect(report.valid).toBe(true);
    expect(report.submit?.submitted).toBe(1);
    expect(events).toEqual(["begin", "draw", "end", "finish", "submit:1"]);
  });

  it("stops at texture view acquisition failures", () => {
    const report = assembleFrameBoundary({
      context: { getCurrentTexture: () => ({}) },
      device: device([]),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.texture.diagnostics).toMatchObject([
      { code: "currentTextureView.missingTextureView" },
    ]);
    expect(report.attachments).toBeNull();
  });

  it("stops at begin render pass failures", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({}),
      device: { createCommandEncoder: () => ({ finish: () => ({}) }) },
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.begin?.diagnostics).toMatchObject([
      { code: "renderPassLifecycle.missingBeginRenderPass" },
    ]);
    expect(report.execution).toBeNull();
  });

  it("reports command execution failures", () => {
    const report = assembleFrameBoundary({
      context: contextWithView({}),
      device: device([], { omitDraw: true }),
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });

    expect(report.valid).toBe(false);
    expect(report.execution?.diagnostics).toMatchObject([
      { code: "renderPassCommandExecutor.missingMethod", method: "draw" },
    ]);
  });

  it("reports finish and submit failures", () => {
    const finishFailure = assembleFrameBoundary({
      context: contextWithView({}),
      device: {
        createCommandEncoder: () => ({
          beginRenderPass: () => ({ draw: () => {}, end: () => {} }),
        }),
      },
      queue: { submit: () => {} },
      commands: [drawCommand()],
      label: "frame",
    });
    const submitFailure = assembleFrameBoundary({
      context: contextWithView({}),
      device: device([]),
      queue: {},
      commands: [drawCommand()],
      label: "frame",
    });

    expect(finishFailure.finish?.diagnostics).toMatchObject([
      { code: "commandBuffer.missingFinish" },
    ]);
    expect(submitFailure.submit?.diagnostics).toMatchObject([
      { code: "queueSubmit.missingSubmit" },
    ]);
  });
});

function contextWithView(view: unknown) {
  return {
    getCurrentTexture: () => ({
      createView: () => view,
    }),
  };
}

function device(
  events: string[],
  options: { readonly omitDraw?: boolean } = {},
) {
  return {
    createCommandEncoder: () => ({
      beginRenderPass: () => {
        events.push("begin");
        return {
          ...(options.omitDraw ? {} : { draw: () => events.push("draw") }),
          end: () => events.push("end"),
        };
      },
      finish: () => {
        events.push("finish");
        return { label: "command-buffer" };
      },
    }),
  };
}

function drawCommand(): RenderPassCommand {
  return {
    kind: "draw",
    renderId: 1,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}
