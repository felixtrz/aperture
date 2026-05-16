import { describe, expect, it } from "vitest";

import {
  RenderWorld,
  planRenderFrameFromSnapshot,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshGpuBufferResource,
  type RenderSnapshot,
  type RenderSortKey,
  type UnlitBindGroupResource,
} from "../../src/index.js";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "pipeline:unlit",
  materialKey: "material:red",
  meshLayoutKey: "mesh-layout:triangle",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("render frame snapshot planning helper", () => {
  it("plans from snapshot through render pass commands", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: transforms(),
      resolveMeshResourceKey: () => "mesh:triangle",
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });

    expect(result.summary.ready).toBe(true);
    expect(result.summary.counts).toMatchObject({
      apply: { active: 2, created: 2 },
      binding: { planned: 2, applied: 2, ready: 2, blocked: 0 },
      draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
      command: { drawCount: 2, nonIndexedDrawCount: 2 },
    });
    expect(result.commandPlan.drawCount).toBe(2);
    expect(
      result.commandPlan.commands
        .filter((command) => command.kind === "draw")
        .map((command) => command.renderId),
    ).toEqual([7, 9]);
  });

  it("summarizes missing resource binding diagnostics without planning draws", () => {
    const result = planRenderFrameFromSnapshot({
      snapshot: snapshot(),
      renderWorld: new RenderWorld(),
      transforms: transforms(),
      resolveMeshResourceKey: () => null,
      resolveMaterialResourceKey: () => "material:red",
      meshResources: [mesh()],
      pipelines: [pipeline()],
      bindGroups: bindGroups(),
    });

    expect(result.summary.ready).toBe(false);
    expect(result.summary.counts).toMatchObject({
      binding: { planned: 2, applied: 2, ready: 0, blocked: 2 },
      draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
      command: { drawCount: 0 },
    });
    expect(
      result.summary.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "renderFrameSnapshotBinding.missingMeshResource",
      "renderFrameSnapshotBinding.missingMeshResource",
      "renderWorld.missingMeshResource",
      "renderWorld.missingMeshResource",
      "renderDrawPackage.blockedDraw",
      "renderDrawPackage.blockedDraw",
    ]);
  });
});

function snapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [packet(7, 0), packet(9, 16)],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(32),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 2,
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

function transforms() {
  return {
    data: new Float32Array(32),
    offsets: [
      { renderId: 7, sourceOffset: 0, packedOffset: 0 },
      { renderId: 9, sourceOffset: 16, packedOffset: 16 },
    ],
    diagnostics: [],
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
    bindGroup: `bind-group:${group}`,
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
