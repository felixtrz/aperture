import {
  runInjectedRenderFrameFromDrawPackages,
  type BatchCompatibilityKey,
  type DrawCommandDescriptorPlan,
  type GetOrCreateRenderPipelineResult,
  type InjectedRenderFrameDrawCommandRunnerReport,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderWorldDrawPackage,
  type UnlitBindGroupResource,
} from "../../../src/index.js";

export type DrawPackageRenderFrameFailurePoint = "missingMesh" | "submit";

export interface DrawPackageRenderFrameFixtureOptions {
  readonly failAt?: DrawPackageRenderFrameFailurePoint;
}

export interface DrawPackageRenderFrameFixture {
  readonly descriptors: DrawCommandDescriptorPlan;
  readonly frame: InjectedRenderFrameDrawCommandRunnerReport;
  readonly events: readonly string[];
}

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

export function createDrawPackageRenderFrameFixture(
  options: DrawPackageRenderFrameFixtureOptions = {},
): DrawPackageRenderFrameFixture {
  const events: string[] = [];
  const meshResources = [mesh()];
  const packages =
    options.failAt === "missingMesh"
      ? [drawPackage(9, "mesh:missing"), drawPackage(7, "mesh:triangle")]
      : [drawPackage(9, "mesh:triangle"), drawPackage(7, "mesh:triangle")];
  const report = runInjectedRenderFrameFromDrawPackages({
    renderer: renderer(),
    packages,
    meshResources,
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(events),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(events),
      queue: options.failAt === "submit" ? {} : queue(events),
      label: "draw-package-render-frame",
      clearColor: [0, 0, 0, 1],
    },
  });

  return {
    descriptors: report.descriptors,
    frame: report.frame,
    events,
  };
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

function renderPass(events: string[]): RenderPassEncoderLike {
  return {
    setPipeline: () => events.push("render-pass:pipeline"),
    setBindGroup: (index) => events.push(`render-pass:bind:${index}`),
    setVertexBuffer: (slot) => events.push(`render-pass:vertex:${slot}`),
    draw: (vertexCount) => events.push(`render-pass:draw:${vertexCount}`),
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

function queue(events: string[]) {
  return {
    submit: (buffers: readonly unknown[]) =>
      events.push(`frame:submit:${buffers.length}`),
  };
}
