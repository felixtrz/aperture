import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  injectedRenderFrameSnapshotRunnerReportToJson,
  injectedRenderFrameSnapshotRunnerReportToJsonValue,
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

type FailurePoint = "duplicate" | "binding" | "missingTransform" | "submit";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame snapshot JSON helpers", () => {
  it("creates JSON-safe values for ready snapshot runner reports", () => {
    const report = injectedRenderFrameSnapshotRunnerReportToJsonValue(run());

    expect(report).toMatchObject({
      ready: true,
      apply: {
        valid: true,
        created: 2,
        updated: 0,
        removed: 0,
        active: 2,
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
      bindings: {
        valid: true,
        attemptedCount: 2,
        succeededCount: 2,
        failedCount: 0,
        renderIds: [7, 9],
        failedRenderIds: [],
      },
      transforms: {
        valid: true,
        floatCount: 32,
        matrixCount: 2,
        offsetCount: 2,
        renderIds: [7, 9],
      },
      readiness: {
        valid: true,
        readyDrawCount: 2,
        blockedDrawCount: 0,
        readyRenderIds: [7, 9],
        blockedRenderIds: [],
      },
      frame: {
        ready: true,
        packages: { packageCount: 2, renderIds: [7, 9] },
      },
    });
  });

  it("serializes apply failures", () => {
    const report = injectedRenderFrameSnapshotRunnerReportToJsonValue(
      run("duplicate"),
    );

    expect(report.ready).toBe(false);
    expect(report.apply.valid).toBe(false);
    expect(report.apply.diagnostics.byCode).toMatchObject({
      "renderWorld.duplicateRenderId": 1,
    });
  });

  it("serializes binding failures", () => {
    const report = injectedRenderFrameSnapshotRunnerReportToJsonValue(
      run("binding"),
    );

    expect(report.ready).toBe(false);
    expect(report.bindings).toMatchObject({
      valid: false,
      attemptedCount: 3,
      succeededCount: 2,
      failedCount: 1,
      failedRenderIds: [11],
    });
    expect(report.bindings.diagnostics.byCode).toMatchObject({
      "renderWorld.missingRenderId": 1,
    });
  });

  it("serializes transform and downstream failures", () => {
    const transformFailure = injectedRenderFrameSnapshotRunnerReportToJsonValue(
      run("missingTransform"),
    );
    const submitFailure = injectedRenderFrameSnapshotRunnerReportToJsonValue(
      run("submit"),
    );

    expect(transformFailure.ready).toBe(false);
    expect(transformFailure.transforms.valid).toBe(false);
    expect(transformFailure.transforms.diagnostics.byCode).toMatchObject({
      "renderTransformPack.missingTransform": 1,
    });
    expect(transformFailure.frame.packages.valid).toBe(false);
    expect(submitFailure.ready).toBe(false);
    expect(submitFailure.apply.valid).toBe(true);
    expect(submitFailure.bindings.valid).toBe(true);
    expect(
      submitFailure.frame.frame.frame.frame.frameExecution.sections
        .commandSubmissionMetrics,
    ).toMatchObject({
      present: true,
      ready: false,
    });
  });

  it("produces stable repeated JSON without raw handles", () => {
    const report = run();
    const json = injectedRenderFrameSnapshotRunnerReportToJson(report);

    expect(JSON.parse(json)).toEqual(
      injectedRenderFrameSnapshotRunnerReportToJsonValue(report),
    );
    expect(json).toBe(injectedRenderFrameSnapshotRunnerReportToJson(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
    expect(json).not.toContain("vertex-buffer-handle");
    expect(json).not.toContain("command-buffer");
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromSnapshot({
    renderer: renderer(),
    renderWorld: new RenderWorld(),
    snapshot: snapshot(failAt),
    bindings: bindings(failAt),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups: bindGroups(),
    pass: renderPass(),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "snapshot-json",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function bindings(failAt: FailurePoint | undefined) {
  if (failAt === "duplicate") {
    return [binding(7)];
  }

  return failAt === "binding"
    ? [binding(7), binding(9), binding(11)]
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
