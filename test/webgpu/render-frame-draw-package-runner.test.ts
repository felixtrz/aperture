import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrameFromDrawPackages,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderWorldDrawPackage,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

type FailurePoint = "missingMesh" | "bindGroup" | "commandExecution" | "submit";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame draw-package runner", () => {
  it("creates descriptors and runs injected render frames", () => {
    const report = run();

    expect(report.descriptors.diagnostics).toEqual([]);
    expect(
      report.descriptors.descriptors.map((descriptor) => descriptor.renderId),
    ).toEqual([9, 7]);
    expect(report.frame.drawList.draws.map((draw) => draw.renderId)).toEqual([
      9, 7,
    ]);
    expect(report.frame.frame.execution.counts).toMatchObject({
      commands: 12,
      drawCalls: 2,
    });
  });

  it("reports missing mesh resources", () => {
    const report = run("missingMesh");

    expect(report.descriptors.diagnostics).toMatchObject([
      { code: "drawCommand.missingMeshResource", renderId: 9 },
    ]);
    expect(
      report.descriptors.descriptors.map((descriptor) => descriptor.renderId),
    ).toEqual([7]);
  });

  it("reports missing bind groups and command execution failures", () => {
    const bindGroup = run("bindGroup");
    const commandExecution = run("commandExecution");

    expect(bindGroup.frame.drawList.valid).toBe(false);
    expect(bindGroup.frame.drawList.diagnostics).toHaveLength(2);
    expect(
      bindGroup.frame.drawList.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "renderPassDrawList.missingBindGroupResource",
      "renderPassDrawList.missingBindGroupResource",
    ]);
    expect(commandExecution.frame.frame.renderPass.execution.valid).toBe(false);
    expect(
      commandExecution.frame.frame.summary.diagnosticSummary.byCode,
    ).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
    });
  });

  it("reports submit failures", () => {
    const report = run("submit");

    expect(
      report.frame.frame.execution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromDrawPackages({
    renderer: renderer(),
    packages:
      failAt === "missingMesh"
        ? [drawPackage(9, "mesh:missing"), drawPackage(7, "mesh:triangle")]
        : [drawPackage(9, "mesh:triangle"), drawPackage(7, "mesh:triangle")],
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups:
      failAt === "bindGroup" ? bindGroups().slice(0, 2) : bindGroups(),
    pass: renderPass(failAt),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "draw-package-runner",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function renderer(): RendererAssemblySmokeReport {
  return {
    ready: true,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: [],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: 1,
        ready: true,
        draws: 2,
        batches: 1,
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
    },
  };
}

function drawPackage(
  renderId: number,
  meshResourceKey: string,
): RenderWorldDrawPackage {
  return {
    renderId,
    batchKey: BATCH,
    meshResourceKey,
    materialResourceKey: "material:red",
    transformPackedOffset: renderId * 16,
  } as unknown as RenderWorldDrawPackage;
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

function renderPass(failAt: FailurePoint | undefined): RenderPassEncoderLike {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    ...(failAt === "commandExecution" ? {} : { draw: () => undefined }),
  };
}

function device() {
  return {
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        setPipeline: () => undefined,
        setBindGroup: () => undefined,
        setVertexBuffer: () => undefined,
        draw: () => undefined,
        end: () => undefined,
      }),
      finish: () => ({ label: "command-buffer" }),
    }),
  };
}
