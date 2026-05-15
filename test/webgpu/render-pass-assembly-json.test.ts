import { describe, expect, it } from "vitest";

import {
  renderPassAssemblySmokeReportToJson,
  renderPassAssemblySmokeReportToJsonValue,
  runInjectedRenderPassAssembly,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassDrawListRecord,
  type RenderPassEncoderLike,
  type UnlitBindGroupResource,
} from "../../src/index.js";

describe("render pass assembly smoke JSON helpers", () => {
  it("creates JSON-safe values for ready render-pass assembly reports", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass(),
    }).assembly;

    expect(renderPassAssemblySmokeReportToJsonValue(report)).toMatchObject({
      ready: true,
      sections: {
        drawList: { present: true, ready: true, diagnosticCodes: [] },
        resources: { present: true, ready: true, diagnosticCodes: [] },
        commands: { present: true, ready: true, diagnosticCodes: [] },
        execution: { present: true, ready: true, diagnosticCodes: [] },
      },
      summary: {
        drawList: { valid: true, drawCount: 1, renderIds: [7] },
        resources: {
          valid: true,
          drawCount: 1,
          draws: [
            {
              renderId: 7,
              pipelineKey: "pipeline:unlit",
              bindGroupKeys: ["bind:0", "bind:1", "bind:2"],
              vertexBufferKeys: ["mesh:triangle:positions"],
            },
          ],
        },
        commands: { valid: true, commandCount: 6, drawCount: 1 },
        execution: { valid: true, commandCount: 6, drawCalls: 1 },
      },
      diagnostics: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
    });
  });

  it("summarizes resource failures", () => {
    const report = renderPassAssemblySmokeReportToJsonValue(
      runInjectedRenderPassAssembly({
        drawList: [draw()],
        pipelines: [],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass(),
      }).assembly,
    );

    expect(report.ready).toBe(false);
    expect(report.sections.resources.diagnosticCodes).toEqual([
      "renderPassAssembly.resourcesNotReady",
    ]);
    expect(report.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.resourcesNotReady": 1,
      "renderPassResource.missingPipeline": 1,
    });
  });

  it("summarizes command planning and execution failures", () => {
    const commandFailure = renderPassAssemblySmokeReportToJsonValue(
      runInjectedRenderPassAssembly({
        drawList: [draw({ vertexCount: 0 })],
        pipelines: [pipeline()],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass(),
      }).assembly,
    );
    const executionFailure = renderPassAssemblySmokeReportToJsonValue(
      runInjectedRenderPassAssembly({
        drawList: [draw()],
        pipelines: [pipeline()],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass({ draw: false }),
      }).assembly,
    );

    expect(commandFailure.sections.commands.ready).toBe(false);
    expect(commandFailure.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.commandPlanNotReady": 1,
      "renderPassCommand.invalidVertexCount": 1,
    });
    expect(executionFailure.sections.execution.ready).toBe(false);
    expect(executionFailure.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
      "renderPassCommandExecutor.missingMethod": 1,
    });
  });

  it("serializes stable output without raw handles", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass(),
    }).assembly;
    const json = renderPassAssemblySmokeReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      renderPassAssemblySmokeReportToJsonValue(report),
    );
    expect(json).toBe(renderPassAssemblySmokeReportToJson(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
  });
});

function draw(
  overrides: Partial<RenderPassDrawListRecord> = {},
): RenderPassDrawListRecord {
  return {
    renderId: 7,
    pipelineKey: "pipeline:unlit",
    bindGroupKeys: ["bind:0", "bind:1", "bind:2"],
    meshResourceKey: "mesh:triangle",
    materialResourceKey: "material:red",
    vertexBufferKeys: ["mesh:triangle:positions"],
    vertexCount: 3,
    indexBufferKey: null,
    indexCount: null,
    instanceCount: 1,
    transformPackedOffset: 0,
    ...overrides,
  };
}

function pipeline(): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key: "pipeline:unlit",
    pipeline: "pipeline-handle",
    diagnostics: [],
  };
}

function bindGroups(): readonly UnlitBindGroupResource[] {
  return [0, 1, 2].map((group) => ({
    group,
    resourceKey: `bind:${group}`,
    layoutKey: `layout:${group}`,
    bindGroup: `bind-group-handle:${group}`,
    entryResourceKeys: group === 2 ? ["material:red"] : [`resource:${group}`],
  }));
}

function mesh(): MeshGpuBufferResource {
  return {
    resourceKey: "mesh:triangle",
    vertexCount: 3,
    vertexBuffers: [
      {
        streamId: "positions",
        resourceKey: "mesh:triangle:positions",
        buffer: "vertex-buffer-handle",
        vertexCount: 3,
      },
    ],
  };
}

function pass(
  methods: { readonly draw?: boolean } = {},
): RenderPassEncoderLike {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    ...(methods.draw === false ? {} : { draw: () => undefined }),
  };
}
