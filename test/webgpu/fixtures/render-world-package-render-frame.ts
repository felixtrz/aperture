import {
  runInjectedRenderFrameFromRenderWorldPackages,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type InjectedRenderFrameRenderWorldPackageRunnerReport,
  type MeshGpuBufferResource,
  type PackedSnapshotTransforms,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSortKey,
  type RenderWorldDrawReadinessReport,
  type UnlitBindGroupResource,
} from "../../../src/index.js";

export type RenderWorldPackageFrameFailurePoint =
  | "blocked"
  | "missingTransform"
  | "missingMesh"
  | "submit";

export interface RenderWorldPackageFrameFixtureOptions {
  readonly failAt?: RenderWorldPackageFrameFailurePoint;
}

export interface RenderWorldPackageFrameFixture {
  readonly report: InjectedRenderFrameRenderWorldPackageRunnerReport;
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

export function createRenderWorldPackageFrameFixture(
  options: RenderWorldPackageFrameFixtureOptions = {},
): RenderWorldPackageFrameFixture {
  const events: string[] = [];
  const report = runInjectedRenderFrameFromRenderWorldPackages({
    renderer: renderer(),
    readiness: readiness(options.failAt),
    transforms: transforms(options.failAt),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(events),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(events),
      queue: options.failAt === "submit" ? {} : queue(events),
      label: "render-world-package-frame",
      clearColor: [0, 0, 0, 1],
    },
  });

  return { report, events };
}

function readiness(
  failAt: RenderWorldPackageFrameFailurePoint | undefined,
): RenderWorldDrawReadinessReport {
  return {
    ready: [
      readyDraw(9, failAt === "missingMesh" ? "mesh:missing" : "mesh:triangle"),
      readyDraw(7, "mesh:triangle"),
    ],
    blocked:
      failAt === "blocked"
        ? [
            {
              renderId: 11,
              packet: packet(11),
              missing: ["missing-mesh-resource"],
            },
          ]
        : [],
    diagnostics: [],
  };
}

function readyDraw(
  renderId: number,
  meshResourceKey: string,
): RenderWorldDrawReadinessReport["ready"][number] {
  return {
    renderId,
    packet: packet(renderId),
    meshResourceKey,
    materialResourceKey: "material:red",
    batchKey: BATCH,
  };
}

function packet(
  renderId: number,
): RenderWorldDrawReadinessReport["ready"][number]["packet"] {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: { kind: "mesh", id: "triangle" },
    material: { kind: "material", id: "red" },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: renderId * 16,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: sortKey(renderId),
    batchKey: BATCH,
  } as unknown as RenderWorldDrawReadinessReport["ready"][number]["packet"];
}

function sortKey(stableId: number): RenderSortKey {
  return {
    queue: "opaque",
    viewId: 0,
    layer: 0,
    order: 0,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:red",
    meshKey: "mesh:triangle",
    depth: 0,
    stableId,
  };
}

function transforms(
  failAt: RenderWorldPackageFrameFailurePoint | undefined,
): PackedSnapshotTransforms {
  return {
    data: new Float32Array(32),
    offsets:
      failAt === "missingTransform"
        ? [{ renderId: 7, sourceOffset: 112, packedOffset: 0 }]
        : [
            { renderId: 7, sourceOffset: 112, packedOffset: 0 },
            { renderId: 9, sourceOffset: 144, packedOffset: 16 },
          ],
    diagnostics: [],
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
