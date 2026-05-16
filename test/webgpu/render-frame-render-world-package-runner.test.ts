import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrameFromRenderWorldPackages,
  type BatchCompatibilityKey,
  type MeshGpuBufferResource,
  type PackedSnapshotTransforms,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSortKey,
  type RenderWorldDrawReadinessReport,
  type UnlitBindGroupResource,
  type GetOrCreateRenderPipelineResult,
} from "../../src/index.js";

type FailurePoint = "blocked" | "missingTransform" | "missingMesh" | "submit";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame render-world package runner", () => {
  it("plans packages and runs injected render frames", () => {
    const report = run();

    expect(report.packages.diagnostics).toEqual([]);
    expect(report.packages.packages.map((pkg) => pkg.renderId)).toEqual([9, 7]);
    expect(
      report.frame.descriptors.descriptors.map(
        (descriptor) => descriptor.renderId,
      ),
    ).toEqual([9, 7]);
    expect(report.frame.frame.frame.execution.counts).toMatchObject({
      commands: 12,
      drawCalls: 2,
    });
  });

  it("reports blocked draws and missing packed transforms", () => {
    const blocked = run("blocked");
    const missingTransform = run("missingTransform");

    expect(blocked.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.blockedDraw" },
    ]);
    expect(blocked.packages.packages.map((pkg) => pkg.renderId)).toEqual([
      9, 7,
    ]);
    expect(missingTransform.packages.diagnostics).toMatchObject([
      { code: "renderDrawPackage.missingPackedTransform" },
    ]);
    expect(
      missingTransform.packages.packages.map((pkg) => pkg.renderId),
    ).toEqual([7]);
  });

  it("reports missing mesh resources downstream", () => {
    const report = run("missingMesh");

    expect(report.packages.diagnostics).toEqual([]);
    expect(report.frame.descriptors.diagnostics).toMatchObject([
      { code: "drawCommand.missingMeshResource", renderId: 9 },
    ]);
  });

  it("reports submit failures", () => {
    const report = run("submit");

    expect(
      report.frame.frame.frame.execution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromRenderWorldPackages({
    renderer: renderer(),
    readiness: readiness(failAt),
    transforms: transforms(failAt),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "render-world-package-runner",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function readiness(
  failAt: FailurePoint | undefined,
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

function readyDraw(renderId: number, meshResourceKey: string) {
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
    order: stableId === 9 ? 0 : stableId === 7 ? 1 : stableId,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:red",
    meshKey: "mesh:triangle",
    depth: 0,
    stableId,
  };
}

function transforms(
  failAt: FailurePoint | undefined,
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
