import { describe, expect, it } from "vitest";

import {
  runInjectedRenderPassAssembly,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassDrawListRecord,
  type RenderPassEncoderLike,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

describe("injected render pass assembly runner", () => {
  it("resolves resources, plans commands, executes, and derives smoke output", () => {
    const events: string[] = [];
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass(events),
    });

    expect(report.resources.valid).toBe(true);
    expect(report.commands.valid).toBe(true);
    expect(report.execution.valid).toBe(true);
    expect(report.assembly.ready).toBe(true);
    expect(report.assembly.summary.commands).toMatchObject({
      commandCount: 6,
      drawCount: 1,
    });
    expect(events).toEqual([
      "pipeline",
      "bind:0",
      "bind:1",
      "bind:2",
      "vertex:0",
      "draw:3",
    ]);
  });

  it("reports missing pipeline resources", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass([]),
    });

    expect(report.resources.valid).toBe(false);
    expect(report.resources.diagnostics).toMatchObject([
      { code: "renderPassResource.missingPipeline" },
    ]);
    expect(report.assembly.sections.resources).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["renderPassAssembly.resourcesNotReady"],
    });
  });

  it("reports invalid draw counts during command planning", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw({ vertexCount: 0 })],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass([]),
    });

    expect(report.commands.valid).toBe(false);
    expect(report.commands.diagnostics).toMatchObject([
      { code: "renderPassCommand.invalidVertexCount" },
    ]);
    expect(report.assembly.sections.commands).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["renderPassAssembly.commandPlanNotReady"],
    });
  });

  it("reports missing pass methods during execution", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass([], { draw: false }),
    });

    expect(report.execution.valid).toBe(false);
    expect(report.execution.diagnostics).toMatchObject([
      { code: "renderPassCommandExecutor.missingMethod", method: "draw" },
    ]);
    expect(report.assembly.sections.execution).toMatchObject({
      present: true,
      ready: false,
      diagnosticCodes: ["renderPassAssembly.executionFailed"],
    });
  });

  it("keeps raw handles out of render-pass assembly summaries", () => {
    const report = runInjectedRenderPassAssembly({
      drawList: [draw()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: pass([]),
    });

    const summary = JSON.stringify(report.assembly.summary);

    expect(summary).not.toContain("pipeline-handle");
    expect(summary).not.toContain("bind-group-handle");
    expect(summary).not.toContain("vertex-buffer-handle");
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
  events: string[],
  methods: { readonly draw?: boolean } = {},
): RenderPassEncoderLike {
  return {
    setPipeline: () => events.push("pipeline"),
    setBindGroup: (index) => events.push(`bind:${index}`),
    setVertexBuffer: (slot) => events.push(`vertex:${slot}`),
    ...(methods.draw === false
      ? {}
      : { draw: (vertexCount) => events.push(`draw:${vertexCount}`) }),
  };
}
