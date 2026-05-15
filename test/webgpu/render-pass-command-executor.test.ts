import { describe, expect, it } from "vitest";

import {
  executeRenderPassCommands,
  type RenderPassCommand,
  type RenderPassEncoderLike,
} from "../../src/index.js";

describe("render pass command executor", () => {
  it("executes indexed command records through an injected pass encoder", () => {
    const calls: unknown[] = [];
    const report = executeRenderPassCommands({
      pass: recordingPass(calls),
      commands: indexedCommands(),
    });

    expect(report).toMatchObject({
      valid: true,
      commandCount: 5,
      executedCommands: 5,
      skippedCommands: 0,
      drawCalls: 1,
      indexedDrawCalls: 1,
      nonIndexedDrawCalls: 0,
      diagnostics: [],
    });
    expect(calls).toEqual([
      ["setPipeline", "pipeline"],
      ["setBindGroup", 0, "bind-group"],
      ["setVertexBuffer", 0, "vertex-buffer"],
      ["setIndexBuffer", "index-buffer", "uint16"],
      ["drawIndexed", 6, 1, 0, 0, 0],
    ]);
  });

  it("executes non-indexed draw command records", () => {
    const calls: unknown[] = [];
    const report = executeRenderPassCommands({
      pass: recordingPass(calls),
      commands: [
        {
          kind: "draw",
          renderId: 1,
          vertexCount: 24,
          instanceCount: 1,
          firstVertex: 0,
          firstInstance: 0,
        },
      ],
    });

    expect(report).toMatchObject({
      valid: true,
      drawCalls: 1,
      indexedDrawCalls: 0,
      nonIndexedDrawCalls: 1,
    });
    expect(calls).toEqual([["draw", 24, 1, 0, 0]]);
  });

  it("diagnoses missing pass encoder methods and skips those commands", () => {
    const report = executeRenderPassCommands({
      pass: {},
      commands: indexedCommands(),
    });

    expect(report.valid).toBe(false);
    expect(report.executedCommands).toBe(0);
    expect(report.skippedCommands).toBe(5);
    expect(report.diagnostics.map((diagnostic) => diagnostic.method)).toEqual([
      "setPipeline",
      "setBindGroup",
      "setVertexBuffer",
      "setIndexBuffer",
      "drawIndexed",
    ]);
  });
});

function indexedCommands(): RenderPassCommand[] {
  return [
    {
      kind: "setPipeline",
      renderId: 1,
      pipelineKey: "pipeline:key",
      pipeline: "pipeline",
    },
    {
      kind: "setBindGroup",
      renderId: 1,
      index: 0,
      resourceKey: "bind:key",
      bindGroup: "bind-group",
    },
    {
      kind: "setVertexBuffer",
      renderId: 1,
      slot: 0,
      resourceKey: "vertex:key",
      buffer: "vertex-buffer",
    },
    {
      kind: "setIndexBuffer",
      renderId: 1,
      resourceKey: "index:key",
      buffer: "index-buffer",
      format: "uint16",
    },
    {
      kind: "drawIndexed",
      renderId: 1,
      indexCount: 6,
      instanceCount: 1,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
    },
  ];
}

function recordingPass(calls: unknown[]): RenderPassEncoderLike {
  return {
    setPipeline: (pipeline) => calls.push(["setPipeline", pipeline]),
    setBindGroup: (index, bindGroup) =>
      calls.push(["setBindGroup", index, bindGroup]),
    setVertexBuffer: (slot, buffer) =>
      calls.push(["setVertexBuffer", slot, buffer]),
    setIndexBuffer: (buffer, format) =>
      calls.push(["setIndexBuffer", buffer, format]),
    draw: (vertexCount, instanceCount, firstVertex, firstInstance) =>
      calls.push([
        "draw",
        vertexCount,
        instanceCount,
        firstVertex,
        firstInstance,
      ]),
    drawIndexed: (
      indexCount,
      instanceCount,
      firstIndex,
      baseVertex,
      firstInstance,
    ) =>
      calls.push([
        "drawIndexed",
        indexCount,
        instanceCount,
        firstIndex,
        baseVertex,
        firstInstance,
      ]),
  };
}
