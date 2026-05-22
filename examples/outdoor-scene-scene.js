export const clearColor = [0.015, 0.023, 0.034, 1];

export const outdoorShadowIntent = {
  key: "outdoor-scene:csm-directional:0",
  mapSize: 1024,
  cascadeCount: 4,
  shadowDistance: 18,
  depthBias: 0.002,
  normalBias: 0.012,
  center: [0, 0, -3.8],
  orthographicSize: 9.5,
};

export const outdoorAreaLight = {
  width: 1.65,
  height: 1.05,
  intensity: 13,
};

export function registerOutdoorSceneAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const nearReceiverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutdoorNearCourtyardWall",
      width: 3.5,
      height: 2.35,
      depth: 0.06,
    }),
    { id: "outdoor-near-courtyard-wall" },
  );
  const farReceiverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutdoorFarCourtyardWall",
      width: 4.8,
      height: 2.75,
      depth: 0.06,
    }),
    { id: "outdoor-far-courtyard-wall" },
  );
  const nearCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutdoorNearPergolaBlock",
      width: 0.56,
      height: 0.72,
      depth: 0.56,
    }),
    { id: "outdoor-near-pergola-block" },
  );
  const farCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutdoorFarCanopyBlock",
      width: 0.88,
      height: 0.88,
      depth: 0.88,
    }),
    { id: "outdoor-far-canopy-block" },
  );
  const windowReceiverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutdoorWindowAreaReceiver",
      width: 1.45,
      height: 1.65,
      depth: 0.05,
    }),
    { id: "outdoor-window-area-receiver" },
  );
  const nearReceiverMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "OutdoorNearWallWarmStone",
      baseColorFactor: new Float32Array([0.68, 0.74, 0.64, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "outdoor-near-wall-warm-stone" },
  );
  const farReceiverMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "OutdoorFarWallCoolStone",
      baseColorFactor: new Float32Array([0.56, 0.64, 0.76, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.86,
    }),
    { id: "outdoor-far-wall-cool-stone" },
  );
  const nearCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "OutdoorNearCasterTerracotta",
      baseColorFactor: new Float32Array([0.94, 0.52, 0.28, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.55,
    }),
    { id: "outdoor-near-caster-terracotta" },
  );
  const farCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "OutdoorFarCasterBlue",
      baseColorFactor: new Float32Array([0.32, 0.58, 0.94, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.58,
    }),
    { id: "outdoor-far-caster-blue" },
  );
  const windowReceiverMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "OutdoorWindowAreaMatte",
      baseColorFactor: new Float32Array([0.64, 0.69, 0.72, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.48,
    }),
    { id: "outdoor-window-area-matte" },
  );

  return {
    nearReceiverMesh,
    farReceiverMesh,
    nearCasterMesh,
    farCasterMesh,
    windowReceiverMesh,
    nearReceiverMaterial,
    farReceiverMaterial,
    nearCasterMaterial,
    farCasterMaterial,
    windowReceiverMaterial,
    receiverMeshKeys: [
      aperture.assetHandleKey(nearReceiverMesh),
      aperture.assetHandleKey(farReceiverMesh),
      aperture.assetHandleKey(windowReceiverMesh),
    ],
    casterMeshKeys: [
      aperture.assetHandleKey(nearCasterMesh),
      aperture.assetHandleKey(farCasterMesh),
    ],
  };
}

export function createOutdoorDirectionalLightRotation() {
  return quaternionFromForward([0.28, -0.12, -0.95]);
}

function quaternionFromForward(forward) {
  const zAxis = normalize([-forward[0], -forward[1], -forward[2]]);
  const xAxis = normalize(cross([0, 1, 0], zAxis));
  const yAxis = cross(zAxis, xAxis);

  return quaternionFromBasis(xAxis, yAxis, zAxis);
}

function quaternionFromBasis(xAxis, yAxis, zAxis) {
  const m00 = xAxis[0];
  const m01 = yAxis[0];
  const m02 = zAxis[0];
  const m10 = xAxis[1];
  const m11 = yAxis[1];
  const m12 = zAxis[1];
  const m20 = xAxis[2];
  const m21 = yAxis[2];
  const m22 = zAxis[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    return [
      (m21 - m12) / scale,
      (m02 - m20) / scale,
      (m10 - m01) / scale,
      0.25 * scale,
    ];
  }

  if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [
      0.25 * scale,
      (m01 + m10) / scale,
      (m02 + m20) / scale,
      (m21 - m12) / scale,
    ];
  }

  if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [
      (m01 + m10) / scale,
      0.25 * scale,
      (m12 + m21) / scale,
      (m02 - m20) / scale,
    ];
  }

  const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [
    (m02 + m20) / scale,
    (m12 + m21) / scale,
    0.25 * scale,
    (m10 - m01) / scale,
  ];
}

function normalize(value) {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 0.0001) {
    return [0, 0, 1];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
