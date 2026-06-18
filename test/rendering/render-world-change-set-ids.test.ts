import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createRenderSnapshotChangeSet,
  createRenderSortKey,
  createStableRenderId,
  RenderWorld,
  type BatchCompatibilityKey,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { describe, expect, it } from "vitest";

describe("render world counts-only change sets", () => {
  it("reuses render object bindings from unchanged mesh render ids", () => {
    const world = new RenderWorld();
    const draw = meshDraw(35, 3);
    const nextDraw = {
      ...draw,
      sortKey: createRenderSortKey({
        stableId: draw.sortKey.stableId,
        depth: 13,
      }),
    };
    const previous = snapshot([draw], 3);
    const next = snapshot([nextDraw], 4);

    world.applySnapshot(previous);
    world.updateResourceBindings(draw.renderId, {
      meshResourceKey: "mesh:counts-only",
      materialResourceKey: "material:counts-only",
    });

    const changeSet = createRenderSnapshotChangeSet(previous, next, {
      includeKeys: false,
      includeUnchangedMeshDrawRenderIds: true,
    });
    const report = world.applySnapshot(next, { changeSet });

    expect(changeSet.keys).toBeUndefined();
    expect(changeSet.unchangedMeshDrawRenderIds).toEqual([draw.renderId]);
    expect(report).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
      removed: 0,
      active: 1,
    });
    expect(world.getObject(draw.renderId)?.gpu).toEqual({
      meshResourceKey: "mesh:counts-only",
      materialResourceKey: "material:counts-only",
    });
  });
});

function snapshot(
  meshDraws: readonly MeshDrawPacket[],
  frame: number,
): RenderSnapshot {
  const transforms = new Float32Array(16);
  writeIdentity(transforms);

  return {
    frame,
    views: [],
    meshDraws,
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
      meshDraws: meshDraws.length,
      shadowCasterDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function meshDraw(index: number, depth: number): MeshDrawPacket {
  const entity = { index, generation: 0 };
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
    sortKey: createRenderSortKey({ stableId: renderId, depth }),
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
