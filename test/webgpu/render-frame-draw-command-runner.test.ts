import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrameFromDrawCommands,
  type DrawCommandDescriptor,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

type FailurePoint = "bindGroup" | "pipeline" | "commandExecution" | "submit";

describe("injected render frame draw-command runner", () => {
  it("plans draw lists and runs injected render frames", () => {
    const events: string[] = [];
    const report = run(events);

    expect(report.drawList.valid).toBe(true);
    expect(report.drawList.draws.map((draw) => draw.renderId)).toEqual([9, 7]);
    expect(report.frame.summary.ready).toBe(true);
    expect(report.frame.execution.counts).toMatchObject({
      commands: 12,
      executedCommands: 12,
      drawCalls: 2,
    });
    expect(events.filter((event) => event === "frame:draw:3")).toHaveLength(2);
  });

  it("reports missing bind groups during draw-list planning", () => {
    const report = run([], "bindGroup");

    expect(report.drawList.valid).toBe(false);
    expect(report.drawList.diagnostics).toMatchObject([
      { code: "renderPassDrawList.missingBindGroupResource" },
      { code: "renderPassDrawList.missingBindGroupResource" },
    ]);
    expect(report.frame.renderPass.assembly.sections.drawList.ready).toBe(
      false,
    );
  });

  it("reports missing pipeline resources during draw-list planning", () => {
    const report = run([], "pipeline");

    expect(report.drawList.valid).toBe(false);
    expect(report.drawList.diagnostics).toMatchObject([
      { code: "renderPassDrawList.missingPipelineResource", renderId: 9 },
      { code: "renderPassDrawList.missingPipelineResource", renderId: 7 },
    ]);
    expect(report.frame.summary.sections.renderPassAssembly.ready).toBe(false);
  });

  it("reports command execution and submit failures", () => {
    const commandExecution = run([], "commandExecution");
    const submit = run([], "submit");

    expect(commandExecution.frame.renderPass.execution.valid).toBe(false);
    expect(
      commandExecution.frame.summary.diagnosticSummary.byCode,
    ).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
    });
    expect(
      submit.frame.execution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
    expect(submit.frame.summary.diagnosticSummary.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });
});

function run(events: string[], failAt?: FailurePoint) {
  return runInjectedRenderFrameFromDrawCommands({
    renderer: renderer(),
    drawCommands: [drawCommand(9), drawCommand(7)],
    pipelines: failAt === "pipeline" ? [] : [pipeline()],
    bindGroups:
      failAt === "bindGroup" ? bindGroups().slice(0, 2) : bindGroups(),
    meshResources: [mesh()],
    pass: renderPass(events, failAt),
    frameExecution: {
      context: context(),
      device: device(events),
      queue: queue(events, failAt),
      label: "draw-command-runner",
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

function drawCommand(renderId: number): DrawCommandDescriptor {
  return {
    renderId,
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

function context() {
  return {
    getCurrentTexture: () => ({ createView: () => ({ label: "view" }) }),
  };
}

function device(events: string[]) {
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
      finish: () => {
        events.push("frame:finish");
        return { label: "command-buffer" };
      },
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
