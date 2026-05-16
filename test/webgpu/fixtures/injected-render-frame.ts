import {
  runInjectedRenderFrame,
  type FrameBoundaryAssemblyReport,
  type FrameExecutionReport,
  type GetOrCreateRenderPipelineResult,
  type InjectedRenderPassAssemblyRunnerReport,
  type MeshGpuBufferResource,
  type RenderPassAssemblySmokeReport,
  type RenderPassDrawListRecord,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RendererFrameSummaryReport,
  type RendererFrameSummaryReportJsonValue,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

export type InjectedRenderFrameSmokeFailurePoint =
  | "renderer"
  | "renderPassResource"
  | "commandExecution"
  | "texture"
  | "finish"
  | "submit";

export interface InjectedRenderFrameSmokeFixtureOptions {
  readonly failAt?: InjectedRenderFrameSmokeFailurePoint;
  readonly drawCount?: number;
}

export interface InjectedRenderFrameSmokeFixture {
  readonly renderer: RendererAssemblySmokeReport;
  readonly renderPass: RenderPassAssemblySmokeReport;
  readonly renderPassRun: InjectedRenderPassAssemblyRunnerReport;
  readonly boundary: FrameBoundaryAssemblyReport;
  readonly frameExecution: FrameExecutionReport;
  readonly summary: RendererFrameSummaryReport;
  readonly json: RendererFrameSummaryReportJsonValue;
  readonly events: readonly string[];
}

export function createInjectedRenderFrameSmokeFixture(
  options: InjectedRenderFrameSmokeFixtureOptions = {},
): InjectedRenderFrameSmokeFixture {
  const events: string[] = [];
  const renderer = rendererReport(options.failAt !== "renderer");
  const frame = runInjectedRenderFrame({
    renderer,
    renderPass: {
      drawList: drawList(options.drawCount ?? 1),
      pipelines: options.failAt === "renderPassResource" ? [] : [pipeline()],
      bindGroups: bindGroups(),
      meshResources: [mesh()],
      pass: renderPass(events, options.failAt),
    },
    frameExecution: {
      context: context(options.failAt),
      device: device(events, options.failAt),
      queue: queue(events, options.failAt),
      label: "injected-render-frame",
      clearColor: [0, 0, 0, 1],
    },
  });

  return {
    renderer,
    renderPass: frame.renderPass.assembly,
    renderPassRun: frame.renderPass,
    boundary: frame.assembly,
    frameExecution: frame.execution,
    summary: frame.summary,
    json: frame.json,
    events,
  };
}

function rendererReport(ready: boolean): RendererAssemblySmokeReport {
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

function drawList(drawCount: number): readonly RenderPassDrawListRecord[] {
  if (drawCount <= 1) {
    return [draw(7)];
  }

  return [draw(9), draw(7)];
}

function draw(renderId: number): RenderPassDrawListRecord {
  return {
    renderId,
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
  failAt: InjectedRenderFrameSmokeFailurePoint | undefined,
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

function context(failAt: InjectedRenderFrameSmokeFailurePoint | undefined) {
  return {
    getCurrentTexture: () =>
      failAt === "texture" ? {} : { createView: () => ({ label: "view" }) },
  };
}

function device(
  events: string[],
  failAt: InjectedRenderFrameSmokeFailurePoint | undefined,
) {
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

function queue(
  events: string[],
  failAt: InjectedRenderFrameSmokeFailurePoint | undefined,
) {
  return failAt === "submit"
    ? {}
    : {
        submit: (buffers: readonly unknown[]) =>
          events.push(`frame:submit:${buffers.length}`),
      };
}
