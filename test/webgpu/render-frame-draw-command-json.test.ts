import { describe, expect, it } from "vitest";

import {
  injectedRenderFrameDrawCommandRunnerReportToJson,
  injectedRenderFrameDrawCommandRunnerReportToJsonValue,
  runInjectedRenderFrameFromDrawCommands,
  type DrawCommandDescriptor,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type UnlitBindGroupResource,
} from "../../src/index.js";

type FailurePoint = "bindGroup" | "submit";

describe("injected render frame draw-command JSON helpers", () => {
  it("creates JSON-safe values for ready draw-command runner reports", () => {
    const report = injectedRenderFrameDrawCommandRunnerReportToJsonValue(run());

    expect(report).toMatchObject({
      ready: true,
      drawList: {
        valid: true,
        drawCount: 1,
        renderIds: [7],
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
      frame: {
        ready: true,
        frameExecution: {
          counts: { commands: 6, executedCommands: 6, drawCalls: 1 },
        },
      },
    });
  });

  it("serializes draw-list failures", () => {
    const report = injectedRenderFrameDrawCommandRunnerReportToJsonValue(
      run("bindGroup"),
    );

    expect(report.ready).toBe(false);
    expect(report.drawList.valid).toBe(false);
    expect(report.drawList.diagnostics.byCode).toMatchObject({
      "renderPassDrawList.missingBindGroupResource": 1,
    });
    expect(report.frame.renderPass.sections.drawList.ready).toBe(false);
  });

  it("serializes render-frame failures", () => {
    const report = injectedRenderFrameDrawCommandRunnerReportToJsonValue(
      run("submit"),
    );

    expect(report.ready).toBe(false);
    expect(report.drawList.valid).toBe(true);
    expect(
      report.frame.frameExecution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });

  it("produces stable repeated JSON without raw handles", () => {
    const report = run();
    const json = injectedRenderFrameDrawCommandRunnerReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      injectedRenderFrameDrawCommandRunnerReportToJsonValue(report),
    );
    expect(json).toBe(injectedRenderFrameDrawCommandRunnerReportToJson(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
    expect(json).not.toContain("command-buffer");
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromDrawCommands({
    renderer: renderer(),
    drawCommands: [drawCommand()],
    pipelines: [pipeline()],
    bindGroups:
      failAt === "bindGroup" ? bindGroups().slice(0, 2) : bindGroups(),
    meshResources: [mesh()],
    pass: renderPass(),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "draw-command-json",
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
        draws: 1,
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

function renderPass(): RenderPassEncoderLike {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    draw: () => undefined,
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
