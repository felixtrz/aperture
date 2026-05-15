import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  runInjectedRenderFrameFromSnapshot,
  summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase,
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
  | "binding"
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

describe("injected render frame snapshot diagnostics by phase", () => {
  it("groups snapshot apply and binding failures", () => {
    const apply = summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
      run("duplicate"),
    );
    const bindings = summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
      run("binding"),
    );

    expect(apply.ready).toBe(false);
    expect(apply.phases.apply.diagnostics.byCode).toMatchObject({
      "renderWorld.duplicateRenderId": 1,
    });
    expect(bindings.ready).toBe(false);
    expect(bindings.phases.bindings.diagnostics.byCode).toMatchObject({
      "renderWorld.missingRenderId": 1,
    });
  });

  it("groups transform packing and draw readiness failures", () => {
    const transforms = summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
      run("missingTransform"),
    );
    const readiness = summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
      run("missingBinding"),
    );

    expect(transforms.ready).toBe(false);
    expect(transforms.phases.transforms.diagnostics.byCode).toMatchObject({
      "renderTransformPack.missingTransform": 1,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.phases.readiness.diagnostics.byCode).toMatchObject({
      "renderWorld.missingMeshResource": 1,
      "renderWorld.missingMaterialResource": 1,
    });
  });

  it("reuses downstream render-world package phase diagnostics", () => {
    const report = summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(
      run("submit"),
    );

    expect(
      report.phases.frame.phases.frame.phases.frame.phases.frame.phases
        .frameExecution.sections.commandSubmissionMetrics.diagnostics.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
    expect(report.diagnostics.byCode).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report =
      summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase(run());
    const json = JSON.stringify(report);

    expect(report.ready).toBe(true);
    expect(json).toBe(JSON.stringify(report));
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
      label: "snapshot-diagnostics",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function bindings(failAt: FailurePoint | undefined) {
  if (failAt === "duplicate") {
    return [binding(7)];
  }

  if (failAt === "binding") {
    return [binding(7), binding(9), binding(11)];
  }

  return failAt === "missingBinding" ? [binding(7)] : [binding(7), binding(9)];
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
