import { describe, expect, it } from "vitest";

import {
  runInjectedRenderFrameFromRenderWorldPackages,
  summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type PackedSnapshotTransforms,
  type RenderPassEncoderLike,
  type RendererAssemblySmokeReport,
  type RenderSortKey,
  type RenderWorldDrawReadinessReport,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

type FailurePoint =
  | "blocked"
  | "missingMesh"
  | "bindGroup"
  | "commandExecution"
  | "submit"
  | "renderer";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("injected render frame render-world package diagnostics by phase", () => {
  it("groups package and descriptor failures", () => {
    const blocked =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("blocked"),
      );
    const missingMesh =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("missingMesh"),
      );

    expect(blocked.phases.packages.diagnostics.byCode).toMatchObject({
      "renderDrawPackage.blockedDraw": 1,
    });
    expect(
      missingMesh.phases.frame.phases.descriptors.diagnostics.byCode,
    ).toMatchObject({
      "drawCommand.missingMeshResource": 1,
    });
  });

  it("groups draw-list, render-pass, frame execution, and renderer failures", () => {
    const bindGroup =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("bindGroup"),
      );
    const commandExecution =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("commandExecution"),
      );
    const submit =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("submit"),
      );
    const renderer =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("renderer"),
      );

    expect(
      bindGroup.phases.frame.phases.frame.phases.drawList.diagnostics.byCode,
    ).toMatchObject({
      "renderPassDrawList.missingBindGroupResource": 1,
    });
    expect(
      commandExecution.phases.frame.phases.frame.phases.frame.phases
        .renderPassAssembly.sections.execution.diagnostics.byCode,
    ).toMatchObject({
      "renderPassAssembly.executionFailed": 1,
    });
    expect(
      submit.phases.frame.phases.frame.phases.frame.phases.frameExecution
        .sections.commandSubmissionMetrics.diagnostics.byCode,
    ).toMatchObject({
      "commandSubmissionMetrics.submitFailed": 1,
    });
    expect(
      renderer.phases.frame.phases.frame.phases.frame.phases.rendererAssembly
        .diagnostics.byCode,
    ).toMatchObject({
      "rendererAssembly.frameNotReady": 1,
    });
  });

  it("produces stable repeated JSON-safe output", () => {
    const report =
      summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase(
        run("commandExecution"),
      );
    const json = JSON.stringify(report);

    expect(json).toBe(JSON.stringify(report));
    expect(json).not.toContain("pipeline-handle");
    expect(json).not.toContain("bind-group-handle");
  });
});

function run(failAt?: FailurePoint) {
  return runInjectedRenderFrameFromRenderWorldPackages({
    renderer: renderer(failAt !== "renderer"),
    readiness: readiness(failAt),
    transforms: transforms(),
    meshResources: [mesh()],
    pipelines: [pipeline()],
    bindGroups:
      failAt === "bindGroup" ? bindGroups().slice(0, 2) : bindGroups(),
    pass: renderPass(failAt),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(),
      queue: failAt === "submit" ? {} : { submit: () => undefined },
      label: "render-world-package-diagnostics",
      clearColor: [0, 0, 0, 1],
    },
  });
}

function readiness(
  failAt: FailurePoint | undefined,
): RenderWorldDrawReadinessReport {
  return {
    ready: [
      readyDraw(7, failAt === "missingMesh" ? "mesh:missing" : "mesh:triangle"),
    ],
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

function transforms(): PackedSnapshotTransforms {
  return {
    data: new Float32Array(16),
    offsets: [{ renderId: 7, sourceOffset: 112, packedOffset: 0 }],
    diagnostics: [],
  };
}

function renderer(ready: boolean): RendererAssemblySmokeReport {
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

function renderPass(failAt: FailurePoint | undefined): RenderPassEncoderLike {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    ...(failAt === "commandExecution" ? {} : { draw: () => undefined }),
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
