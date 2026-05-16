import { describe, expect, it } from "vitest";

import {
  createRenderPassAssemblySmokeReport,
  type RenderPassCommandExecutionReport,
  type RenderPassCommandPlan,
  type RenderPassDrawListPlan,
  type ResolveRenderPassResourcesResult,
} from "@aperture-engine/webgpu";

describe("render pass assembly smoke report", () => {
  it("reports ready when all render pass assembly sections are ready", () => {
    const report = createRenderPassAssemblySmokeReport({
      drawList: drawList(true),
      resources: resources(true),
      commands: commands(true),
      execution: execution(true),
    });

    expect(report.ready).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      Object.values(report.sections).every((section) => section.ready),
    ).toBe(true);
    expect(report.summary.commands?.commandCount).toBe(5);
    expect(report.summary.execution?.drawCalls).toBe(1);
  });

  it("reports missing resolved resources", () => {
    const report = createRenderPassAssemblySmokeReport({
      drawList: drawList(true),
      resources: null,
      commands: commands(true),
      execution: execution(true),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.resources).toMatchObject({
      present: false,
      ready: false,
      diagnosticCodes: ["renderPassAssembly.missingResolvedResources"],
    });
  });

  it("reports missing command plans", () => {
    const report = createRenderPassAssemblySmokeReport({
      drawList: drawList(true),
      resources: resources(true),
      commands: null,
      execution: execution(true),
    });

    expect(report.ready).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "renderPassAssembly.missingCommandPlan", section: "commands" },
    ]);
  });

  it("reports failed execution and preserves source diagnostics", () => {
    const report = createRenderPassAssemblySmokeReport({
      drawList: drawList(true),
      resources: resources(true),
      commands: commands(true),
      execution: execution(false),
    });

    expect(report.ready).toBe(false);
    expect(report.sections.execution).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["renderPassAssembly.executionFailed"],
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderPassAssembly.executionFailed",
      "renderPassCommandExecutor.missingMethod",
    ]);
  });
});

function drawList(valid: boolean): RenderPassDrawListPlan {
  return {
    valid,
    draws: [],
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassDrawList.missingPipelineResource",
            renderId: 1,
            pipelineKey: "pipeline",
            message: "missing",
          },
        ],
  };
}

function resources(valid: boolean): ResolveRenderPassResourcesResult {
  return {
    valid,
    draws: [],
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassResource.missingPipeline",
            renderId: 1,
            resourceKey: "pipeline",
            message: "missing",
          },
        ],
  };
}

function commands(valid: boolean): RenderPassCommandPlan {
  return {
    valid,
    commands: valid
      ? [
          {
            kind: "setPipeline",
            renderId: 1,
            pipelineKey: "pipeline",
            pipeline: {},
          },
          {
            kind: "setBindGroup",
            renderId: 1,
            index: 0,
            resourceKey: "bind",
            bindGroup: {},
          },
          {
            kind: "setVertexBuffer",
            renderId: 1,
            slot: 0,
            resourceKey: "vertex",
            buffer: {},
          },
          {
            kind: "setIndexBuffer",
            renderId: 1,
            resourceKey: "index",
            buffer: {},
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
        ]
      : [],
    drawCount: valid ? 1 : 0,
    indexedDrawCount: valid ? 1 : 0,
    nonIndexedDrawCount: 0,
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassCommand.invalidIndexCount",
            renderId: 1,
            message: "invalid",
          },
        ],
  };
}

function execution(valid: boolean): RenderPassCommandExecutionReport {
  return {
    valid,
    commandCount: 5,
    executedCommands: valid ? 5 : 4,
    skippedCommands: valid ? 0 : 1,
    drawCalls: valid ? 1 : 0,
    indexedDrawCalls: valid ? 1 : 0,
    nonIndexedDrawCalls: 0,
    diagnostics: valid
      ? []
      : [
          {
            code: "renderPassCommandExecutor.missingMethod",
            method: "drawIndexed",
            renderId: 1,
            message: "missing",
          },
        ],
  };
}
