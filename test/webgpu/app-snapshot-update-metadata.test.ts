import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createRenderSortKey,
  createStableRenderId,
  type BatchCompatibilityKey,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { describe, expect, it } from "vitest";
import { createWebGpuAppSnapshotUpdateMetadata } from "../../packages/webgpu/src/app/snapshot.js";

describe("WebGPU app snapshot update metadata", () => {
  it("keeps formatted change-set keys out of the frame hot path", () => {
    const previous = snapshot(1);
    const next = snapshot(2);
    const metadata = createWebGpuAppSnapshotUpdateMetadata(next, {
      previousSnapshotForUpdate: previous,
    });

    expect(metadata.snapshotChangeSet.keys).toBeUndefined();
    expect(metadata.snapshotChangeSet.unchangedMeshDrawRenderIds).toEqual([
      meshDraw().renderId,
    ]);
    expect(metadata.snapshotUpdateSchedule.byFamily.meshDraws.action).toBe(
      "reuse",
    );
  });
});

function snapshot(frame: number): RenderSnapshot {
  const transforms = new Float32Array(16);
  writeIdentity(transforms);

  return {
    frame,
    views: [],
    meshDraws: [meshDraw()],
    shadowCasterDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms,
    instanceTints: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      shadowCasterDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function meshDraw(): MeshDrawPacket {
  const entity = { index: 7, generation: 0 };
  const renderId = createStableRenderId(entity);

  return {
    renderId,
    entity,
    mesh: createMeshHandle("cube"),
    material: createMaterialHandle("white"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    castsShadow: true,
    receivesShadow: true,
    sortKey: createRenderSortKey({ stableId: renderId }),
    batchKey: batchKey(),
  };
}

function batchKey(): BatchCompatibilityKey {
  return {
    pipelineKey: "unlit|opaque|back|less|none",
    materialKey: "material:white",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
}

function writeIdentity(values: Float32Array): void {
  for (let index = 0; index < 16; index += 1) {
    values[index] = index % 5 === 0 ? 1 : 0;
  }
}
