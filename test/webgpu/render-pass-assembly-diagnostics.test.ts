import { describe, expect, it } from "vitest";

import {
  summarizeRenderPassAssemblyDiagnosticsBySection,
  runInjectedRenderPassAssembly,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassDrawListRecord,
  type RenderPassEncoderLike,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

describe("render pass assembly diagnostics by section", () => {
  it("groups missing resources", () => {
    const report = summarizeRenderPassAssemblyDiagnosticsBySection(
      runInjectedRenderPassAssembly({
        drawList: [draw()],
        pipelines: [],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass(),
      }).assembly,
    );

    expect(report.ready).toBe(false);
    expect(report.sections.resources.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.resourcesNotReady": 1,
      "renderPassResource.missingPipeline": 1,
    });
  });

  it("groups command planning failures", () => {
    const report = summarizeRenderPassAssemblyDiagnosticsBySection(
      runInjectedRenderPassAssembly({
        drawList: [draw({ vertexCount: 0 })],
        pipelines: [pipeline()],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass(),
      }).assembly,
    );

    expect(report.sections.commands.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.commandPlanNotReady": 1,
      "renderPassCommand.invalidVertexCount": 1,
    });
  });

  it("groups execution failures", () => {
    const report = summarizeRenderPassAssemblyDiagnosticsBySection(
      runInjectedRenderPassAssembly({
        drawList: [draw()],
        pipelines: [pipeline()],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass({ draw: false }),
      }).assembly,
    );

    expect(report.sections.execution.diagnostics.byCode).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
      "renderPassCommandExecutor.missingMethod": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report = summarizeRenderPassAssemblyDiagnosticsBySection(
      runInjectedRenderPassAssembly({
        drawList: [draw()],
        pipelines: [pipeline()],
        bindGroups: bindGroups(),
        meshResources: [mesh()],
        pass: pass({ draw: false }),
      }).assembly,
    );
    const json = JSON.stringify(report);

    expect(json).toBe(JSON.stringify(report));
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
