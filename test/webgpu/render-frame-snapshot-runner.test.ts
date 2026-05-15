import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  runInjectedRenderFrameFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "../../src/index.js";

type FailurePoint =
  | "duplicate"
  | "missingBinding"
  | "missingTransform"
  | "submit";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame snapshot runner", () => {
  it("applies snapshots, binds resources, packs transforms, and runs frames", () => {
    const report = run();

    expect(report.apply).toMatchObject({ created: 2, updated: 0, active: 2 });
    expect(report.bindings.every((binding) => binding.result.ok)).toBe(true);
    expect(report.transforms.offsets.map((offset) => offset.renderId)).toEqual([
      7, 9,
    ]);
    expect(report.readiness.ready.map((draw) => draw.renderId)).toEqual([7, 9]);
    expect(report.frame.frame.frame.frame.execution.counts).toMatchObject({
      commands: 12,
      drawCalls: 2,
    });
  });

  it("reports duplicate render ids during snapshot apply", () => {
    const report = run("duplicate");

    expect(report.apply.diagnostics).toMatchObject([
      { code: "renderWorld.duplicateRenderId" },
    ]);
  });

  it("reports missing bindings and missing transforms", () => {
    const missingBinding = run("missingBinding");
    const missingTransform = run("missingTransform");

    expect(missingBinding.readiness.blocked).toMatchObject([
      {
        renderId: 9,
        missing: ["missing-mesh-resource", "missing-material-resource"],
      },
    ]);
    expect(missingBinding.frame.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.blockedDraw" },
    ]);
    expect(missingTransform.transforms.diagnostics).toMatchObject([
      { code: "renderTransformPack.missingTransform" },
    ]);
    expect(missingTransform.frame.packages.diagnostics).toMatchObject([
      { code: "renderTransformPack.missingTransform" },
      { code: "renderDrawPackage.missingPackedTransform" },
    ]);
  });

  it("reports submit failures", () => {
    const report = run("submit");

    expect(
      report.frame.frame.frame.frame.execution.sections
        .commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });
});

function run(failAt?: FailurePoint) {
  const renderWorld = new RenderWorld();

  return runInjectedRenderFrameFromSnapshot({
    renderer: renderer(),
    renderWorld,
    snapshot: snapshot(failAt),
    bindings:
      failAt === "missingBinding" ? [binding(7)] : [binding(7), binding(9)],
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "snapshot-runner",
      clearColor: [0, 0, 0, 1],
    },
  });
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

function snapshot(failAt: FailurePoint | undefined): RenderSnapshot {
  const draws =
    failAt === "duplicate"
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
      failAt === "missingTransform"
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
