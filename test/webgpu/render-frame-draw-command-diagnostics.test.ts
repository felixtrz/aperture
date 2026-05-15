import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrameFromDrawCommands,
  summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase,
  type DrawCommandDescriptor,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type UnlitBindGroupResource,
} from "../../src/index.js";

type FailurePoint = "bindGroup" | "commandExecution" | "submit" | "renderer";

describe("injected render frame draw-command diagnostics by phase", () => {
  it("groups draw-list planning failures", () => {
    const report = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
      run("bindGroup"),
    );

    expect(report.ready).toBe(false);
    expect(report.phases.drawList.diagnostics.byCode).toMatchObject({
      "renderPassDrawList.missingBindGroupResource": 1,
    });
    expect(
      report.phases.frame.phases.renderPassAssembly.sections.drawList
        .diagnostics.byCode,
    ).toMatchObject({
      "renderPassDrawList.missingBindGroupResource": 1,
    });
  });

  it("groups render-pass execution failures", () => {
    const report = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
      run("commandExecution"),
    );

    expect(
      report.phases.frame.phases.renderPassAssembly.sections.execution
        .diagnostics.byCode,
    ).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
      "renderPassCommandExecutor.missingMethod": 1,
    });
  });

  it("groups frame execution failures", () => {
    const report = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
      run("submit"),
    );

    expect(
      report.phases.frame.phases.frameExecution.sections
        .commandSubmissionMetrics.diagnostics.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });

  it("groups renderer failures and stable JSON-safe output", () => {
    const report = summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase(
      run("renderer"),
    );
    const json = JSON.stringify(report);

    expect(
      report.phases.frame.phases.rendererAssembly.diagnostics.byCode,
    ).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
    });
    expect(json).toBe(JSON.stringify(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromDrawCommands({
    renderer: renderer(failAt !== "renderer"),
    drawCommands: [drawCommand()],
    pipelines: [pipeline()],
    bindGroups:
      failAt === "bindGroup" ? bindGroups().slice(0, 2) : bindGroups(),
    meshResources: [mesh()],
    pass: renderPass(failAt),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "draw-command-diagnostics",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function renderer(ready: boolean): RendererAssemblySmokeReport {
  return {
    ready,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "rendererAssembly.frameNotReady",
            message: "Frame report is not ready.",
            severity: "warning",
            section: "frame",
          },
        ],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: 1,
        ready,
        draws: 1,
        batches: 1,
        diagnostics: {
          total: ready ? 0 : 1,
          bySeverity: { info: 0, warning: ready ? 0 : 1, error: 0 },
          byCode: ready ? {} : { "rendererAssembly.frameNotReady": 1 },
        },
      },
    },
  };
}

function drawCommand(): DrawCommandDescriptor {
  return {
    renderId: 7,
    pipelineKey: "pipeline:unlit",
    topology: "triangle-list",
    meshResourceKey: "mesh:triangle",
    materialResourceKey: "material:red",
    vertexBufferKeys: ["mesh:triangle:positions"],
    vertexCount: 3,
    indexBufferKey: null,
    indexCount: null,
    transformPackedOffset: 0,
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
