import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrame,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassDrawListRecord,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

type FailurePoint =
  | "renderer"
  | "renderPassResource"
  | "commandExecution"
  | "texture"
  | "finish"
  | "submit";

describe("injected render frame runner", () => {
  it("wires render-pass assembly into frame execution and summary output", () => {
    const events: string[] = [];
    const report = run(events);

    expect(report.renderPass.assembly.ready).toBe(true);
    expect(report.execution.ready).toBe(true);
    expect(report.summary.ready).toBe(true);
    expect(report.json.ready).toBe(true);
    expect(report.summary.counts).toMatchObject({
      plannedDraws: 1,
      commands: 6,
      executedCommands: 6,
      submittedCommandBuffers: 1,
    });
    expect(events).toEqual([
      "render-pass:pipeline",
      "render-pass:bind:0",
      "render-pass:bind:1",
      "render-pass:bind:2",
      "render-pass:vertex:0",
      "render-pass:draw:3",
      "frame:begin",
      "frame:pipeline",
      "frame:bind:0",
      "frame:bind:1",
      "frame:bind:2",
      "frame:vertex:0",
      "frame:draw:3",
      "frame:end",
      "frame:finish",
      "frame:submit:1",
    ]);
  });

  it("reports renderer failures", () => {
    const report = run([], "renderer");

    expect(report.summary.ready).toBe(false);
    expect(report.summary.sections.rendererAssembly.ready).toBe(false);
    expect(report.summary.diagnosticSummary.byCode).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
      "mvpFrameReadiness.rendererAssemblyNotReady": 1,
    });
  });

  it("reports render-pass resource and execution failures", () => {
    const resourceFailure = run([], "renderPassResource");
    const executionFailure = run([], "commandExecution");

    expect(resourceFailure.renderPass.resources.valid).toBe(false);
    expect(resourceFailure.summary.sections.renderPassAssembly.ready).toBe(
      false,
    );
    expect(executionFailure.renderPass.execution.valid).toBe(false);
    expect(executionFailure.summary.diagnosticSummary.byCode).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
    });
  });

  it("reports texture, finish, and submit failures", () => {
    const texture = run([], "texture");
    const finish = run([], "finish");
    const submit = run([], "submit");

    expect(texture.execution.sections.commandSubmissionMetrics.present).toBe(
      false,
    );
    expect(finish.summary.sections.commandSubmissionMetrics.present).toBe(
      false,
    );
    expect(submit.summary.sections.commandSubmissionMetrics).toMatchObject({
      present: true,
      ready: false,
    });
    expect(submit.json.diagnostics.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });
});

function run(events: string[], failAt?: FailurePoint) {
  return runInjectedRenderFrame({
    renderer: renderer(failAt !== "renderer"),
    renderPass: {
      drawList: [draw()],
      pipelines: failAt === "renderPassResource" ? [] : [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: renderPass(events, failAt),
    },
    frameExecution: {
      context: context(failAt),
      device: device(events, failAt),
      queue: queue(events, failAt),
      label: "render-frame-runner",
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

function draw(): RenderPassDrawListRecord {
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

function renderPass(
  events: string[],
  failAt: FailurePoint | undefined,
): RenderPassEncoderLike {
  return {
    setPipeline: () => events.push("render-pass:pipeline"),
    setBindGroup: (index) => events.push(`render-pass:bind:${index}`),
    setVertexBuffer: (slot) => events.push(`render-pass:vertex:${slot}`),
    ...(failAt === "commandExecution"
      ? {}
      : {
          draw: (vertexCount) => events.push(`render-pass:draw:${vertexCount}`),
        }),
  };
}

function context(failAt: FailurePoint | undefined) {
  return {
    getCurrentTexture: () =>
      failAt === "texture" ? {} : { createView: () => ({ label: "view" }) },
  };
}

function device(events: string[], failAt: FailurePoint | undefined) {
  return {
    createCommandEncoder: () => ({
      beginRenderPass: () => {
        events.push("frame:begin");
        return {
          setPipeline: () => events.push("frame:pipeline"),
          setBindGroup: (index: number) => events.push(`frame:bind:${index}`),
          setVertexBuffer: (slot: number) =>
            events.push(`frame:vertex:${slot}`),
          draw: (vertexCount: number) =>
            events.push(`frame:draw:${vertexCount}`),
          end: () => events.push("frame:end"),
        };
      },
      ...(failAt === "finish"
        ? {}
        : {
            finish: () => {
              events.push("frame:finish");
              return { label: "command-buffer" };
            },
          }),
    }),
  };
}

function queue(events: string[], failAt: FailurePoint | undefined) {
  return failAt === "submit"
    ? {}
    : {
        submit: (buffers: readonly unknown[]) =>
          events.push(`frame:submit:${buffers.length}`),
      };
}
