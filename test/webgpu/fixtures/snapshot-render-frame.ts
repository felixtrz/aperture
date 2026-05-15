import {
  RenderWorld,
  runInjectedRenderFrameFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type InjectedRenderFrameSnapshotRunnerReport,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "../../../src/index.js";

export type SnapshotRenderFrameFailurePoint =
  | "duplicateRenderIds"
  | "missingResourceBindings"
  | "missingTransforms"
  | "submit";

export interface SnapshotRenderFrameFixtureOptions {
  readonly failAt?: SnapshotRenderFrameFailurePoint;
}

export interface SnapshotRenderFrameFixture {
  readonly report: InjectedRenderFrameSnapshotRunnerReport;
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

export function createSnapshotRenderFrameFixture(
  options: SnapshotRenderFrameFixtureOptions = {},
): SnapshotRenderFrameFixture {
  const events: string[] = [];
  const report = runInjectedRenderFrameFromSnapshot({
    renderer: renderer(),
    renderWorld: new RenderWorld(),
    snapshot: snapshot(options.failAt),
    bindings: bindings(options.failAt),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(events),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(events),
      queue: options.failAt === "submit" ? {} : queue(events),
      label: "snapshot-render-frame",
      clearColor: [0, 0, 0, 1],
    },
  });

  return { report, events };
}

function bindings(
  failAt: SnapshotRenderFrameFailurePoint | undefined,
): readonly {
  renderId: number;
  update: { meshResourceKey: string; materialResourceKey: string };
}[] {
  return failAt === "missingResourceBindings"
    ? [binding(7)]
    : [binding(7), binding(9)];
}

function binding(renderId: number) {
  return {
    renderId,
    update: {
      meshResourceKey: "mesh:triangle",
      materialResourceKey: "material:red",
    },
  };
}

function snapshot(
  failAt: SnapshotRenderFrameFailurePoint | undefined,
): RenderSnapshot {
  const draws =
    failAt === "duplicateRenderIds"
      ? [packet(7, 0), packet(7, 16)]
      : [packet(7, 0), packet(9, 16)];

  return {
    frame: 1,
    views: [],
    meshDraws: draws,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms:
      failAt === "missingTransforms"
        ? new Float32Array(16)
        : new Float32Array(32),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: draws.length,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

function packet(renderId: number, worldTransformOffset: number) {
  return {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: { kind: "mesh", id: "triangle" },
    material: { kind: "material", id: "red" },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: sortKey(renderId),
    batchKey: BATCH,
  };
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
