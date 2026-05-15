import { describe, expect, it } from "vitest";

import {
  injectedRenderFrameRenderWorldPackageRunnerReportToJson,
  injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue,
  runInjectedRenderFrameFromRenderWorldPackages,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type PackedSnapshotTransforms,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSortKey,
  type RenderWorldDrawReadinessReport,
  type UnlitBindGroupResource,
} from "../../src/index.js";

type FailurePoint = "blocked" | "submit";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame render-world package JSON helpers", () => {
  it("creates JSON-safe values for ready render-world package reports", () => {
    const report =
      injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(run());

    expect(report).toMatchObject({
      ready: true,
      packages: {
        valid: true,
        packageCount: 1,
        renderIds: [7],
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
      frame: {
        ready: true,
        descriptors: { descriptorCount: 1, renderIds: [7] },
      },
    });
  });

  it("serializes package failures", () => {
    const report = injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(
      run("blocked"),
    );

    expect(report.ready).toBe(false);
    expect(report.packages.valid).toBe(false);
    expect(report.packages.diagnostics.byCode).toMatchObject({
      "renderDrawPackage.blockedDraw": 1,
    });
  });

  it("serializes downstream frame failures", () => {
    const report = injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(
      run("submit"),
    );

    expect(report.ready).toBe(false);
    expect(report.packages.valid).toBe(true);
    expect(
      report.frame.frame.frame.frameExecution.sections.commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });

  it("produces stable repeated JSON without raw handles", () => {
    const report = run();
    const json =
      injectedRenderFrameRenderWorldPackageRunnerReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue(report),
    );
    expect(json).toBe(
      injectedRenderFrameRenderWorldPackageRunnerReportToJson(report),
    );
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
    expect(json).not.toContain("command-buffer");
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromRenderWorldPackages({
    renderer: renderer(),
    readiness: {
      ready: [readyDraw(7)],
      blocked:
        failAt === "blocked"
          ? [
              {
                renderId: 9,
                packet: packet(9),
                missing: ["missing-mesh-resource"],
              },
            ]
          : [],
      diagnostics: [],
    },
    transforms: transforms(),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "render-world-package-json",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function readyDraw(
  renderId: number,
): RenderWorldDrawReadinessReport["ready"][number] {
  return {
    renderId,
    packet: packet(renderId),
    meshResourceKey: "mesh:triangle",
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

function transforms(): PackedSnapshotTransforms {
  return {
    data: new Float32Array(16),
    offsets: [{ renderId: 7, sourceOffset: 112, packedOffset: 0 }],
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
