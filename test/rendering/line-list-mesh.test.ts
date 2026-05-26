import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  Camera,
  Material,
  MaterialSlots,
  Mesh,
  RenderLayer,
  Visibility,
  WorldTransform,
  assetHandleKey,
  createCamera,
  createLineListMeshAsset,
  createMaterialHandle,
  createMaterialSlots,
  createMeshHandle,
  createRootTransform,
  createUnlitMaterialAsset,
  createWorld,
  extractRenderSnapshot,
  registerMetadataComponents,
  registerRenderAuthoringComponents,
  registerTransformComponents,
  validateMeshAsset,
} from "@aperture-engine/core";

describe("line-list mesh assets", () => {
  it("creates an indexed line-list mesh with bounds and material slots", () => {
    const mesh = createTestLineMesh();

    expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
    expect(mesh.indexBuffer).toMatchObject({
      format: "uint16",
      indexCount: 8,
    });
    expect(mesh.submeshes).toEqual([
      {
        label: "cyan-lines",
        topology: "line-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 8,
        indexStart: 0,
        indexCount: 4,
      },
      {
        label: "amber-lines",
        topology: "line-list",
        materialSlot: 1,
        vertexStart: 0,
        vertexCount: 8,
        indexStart: 4,
        indexCount: 4,
      },
    ]);
    expect(mesh.materialSlots).toEqual([
      { index: 0, label: "cyan" },
      { index: 1, label: "amber" },
    ]);
    expect(mesh.localAabb).toEqual({
      min: [-0.8, -0.4, 0],
      max: [0.8, 0.4, 0],
    });
  });

  it("extracts ECS-authored line-list submeshes through render snapshots", () => {
    const world = createWorld({ entityCapacity: 4 });
    const assets = new AssetRegistry();
    const meshHandle = createMeshHandle("line-list-proof");
    const cyan = createMaterialHandle("line-a-cyan");
    const amber = createMaterialHandle("line-b-amber");

    registerTransformComponents(world);
    registerMetadataComponents(world);
    registerRenderAuthoringComponents(world);
    assets.register(meshHandle);
    assets.register(cyan);
    assets.register(amber);
    assets.markReady(meshHandle, createTestLineMesh());
    assets.markReady(
      cyan,
      createUnlitMaterialAsset({
        label: "LineACyan",
        baseColorFactor: new Float32Array([0.05, 0.85, 1, 1]),
      }),
    );
    assets.markReady(
      amber,
      createUnlitMaterialAsset({
        label: "LineBAmber",
        baseColorFactor: new Float32Array([1, 0.62, 0.08, 1]),
      }),
    );

    const camera = world.createEntity();
    const cameraTransform = createRootTransform({ translation: [0, 0, 3] });

    camera.addComponent(WorldTransform, cameraTransform.world);
    camera.addComponent(
      Camera,
      createCamera({
        aspect: 16 / 9,
        near: 0.1,
        far: 20,
        layerMask: 1,
      }),
    );

    const lines = world.createEntity();
    const lineTransform = createRootTransform();

    lines.addComponent(WorldTransform, lineTransform.world);
    lines.addComponent(Mesh, { meshId: assetHandleKey(meshHandle) });
    lines.addComponent(Material, { materialId: assetHandleKey(cyan) });
    lines.addComponent(
      MaterialSlots,
      createMaterialSlots({ slots: [{ slot: 1, material: amber }] }),
    );
    lines.addComponent(RenderLayer, { mask: 1 });
    lines.addComponent(Visibility);

    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws).toHaveLength(2);
    expect(snapshot.meshDraws.map((draw) => draw.batchKey.topology)).toEqual([
      "line-list",
      "line-list",
    ]);
    expect(snapshot.meshDraws.map((draw) => draw.indexCount)).toEqual([4, 4]);
    expect(
      snapshot.meshDraws.map((draw) => assetHandleKey(draw.material)),
    ).toEqual([assetHandleKey(cyan), assetHandleKey(amber)]);
  });
});

function createTestLineMesh() {
  return createLineListMeshAsset({
    label: "LineListProof",
    positions: [
      [-0.8, 0.4, 0],
      [-0.2, 0.4, 0],
      [-0.8, 0.3, 0],
      [-0.2, 0.3, 0],
      [0.2, -0.3, 0],
      [0.8, -0.3, 0],
      [0.2, -0.4, 0],
      [0.8, -0.4, 0],
    ],
    indices: [0, 1, 2, 3, 4, 5, 6, 7],
    materialSlots: ["cyan", "amber"],
    submeshes: [
      {
        label: "cyan-lines",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 8,
        indexStart: 0,
        indexCount: 4,
      },
      {
        label: "amber-lines",
        materialSlot: 1,
        vertexStart: 0,
        vertexCount: 8,
        indexStart: 4,
        indexCount: 4,
      },
    ],
  });
}
