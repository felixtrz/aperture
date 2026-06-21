export const MULTI_MATERIAL_GROUPS_CLEAR_COLOR = [0.015, 0.018, 0.024, 1];

export function registerMultiMaterialGroupAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(createTwoGroupMeshAsset(), {
    id: "multi-material-groups-panel",
  });
  const leftMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "MultiMaterialGroupsLeft",
      baseColorFactor: new Float32Array([0.92, 0.16, 0.1, 1]),
    }),
    { id: "multi-material-groups-left" },
  );
  const rightMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "MultiMaterialGroupsRight",
      baseColorFactor: new Float32Array([0.1, 0.78, 0.95, 1]),
    }),
    { id: "multi-material-groups-right" },
  );

  return {
    mesh,
    leftMaterial,
    rightMaterial,
    meshKey: aperture.assetHandleKey(mesh),
    materialKeys: {
      left: aperture.assetHandleKey(leftMaterial),
      right: aperture.assetHandleKey(rightMaterial),
    },
  };
}

function createTwoGroupMeshAsset() {
  const vertices = new Float32Array([
    -1.4, -0.8, 0, 0, 0, 1, 0, 1, -0.04, -0.8, 0, 0, 0, 1, 1, 1, -0.04, 0.8, 0,
    0, 0, 1, 1, 0, -1.4, 0.8, 0, 0, 0, 1, 0, 0, 0.04, -0.8, 0, 0, 0, 1, 0, 1,
    1.4, -0.8, 0, 0, 0, 1, 1, 1, 1.4, 0.8, 0, 0, 0, 1, 1, 0, 0.04, 0.8, 0, 0, 0,
    1, 0, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);

  return {
    kind: "mesh",
    label: "MultiMaterialGroupsPanel",
    vertexStreams: [
      {
        id: "main",
        arrayStride: 32,
        vertexCount: 8,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: vertices,
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: indices,
      indexCount: indices.length,
    },
    materialSlots: [
      { index: 0, label: "left" },
      { index: 1, label: "right" },
    ],
    submeshes: [
      {
        label: "left",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
      {
        label: "right",
        topology: "triangle-list",
        materialSlot: 1,
        vertexStart: 4,
        vertexCount: 4,
        indexStart: 6,
        indexCount: 6,
      },
    ],
    localAabb: {
      min: [-1.4, -0.8, 0],
      max: [1.4, 0.8, 0],
    },
    localSphere: {
      center: [0, 0, 0],
      radius: Math.hypot(1.4, 0.8),
    },
  };
}
