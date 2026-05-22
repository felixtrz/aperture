export const clearColor = [0.012, 0.018, 0.026, 1];

export const shadowIntent = {
  key: "csm-directional-shadow:2d-array:0",
  mapSize: 1024,
  cascadeCount: 4,
  shadowDistance: 14,
  depthBias: 0.002,
  normalBias: 0.01,
  center: [0, 0, -3.4],
  orthographicSize: 8,
};

export function registerCsmDirectionalShadowScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const nearReceiverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CsmNearReceiverPanel",
      width: 3.2,
      height: 2.2,
      depth: 0.06,
    }),
    { id: "csm-near-receiver-panel" },
  );
  const farReceiverMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CsmFarReceiverPanel",
      width: 4.4,
      height: 2.7,
      depth: 0.06,
    }),
    { id: "csm-far-receiver-panel" },
  );
  const nearCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CsmNearCasterBox",
      width: 0.46,
      height: 0.46,
      depth: 0.46,
    }),
    { id: "csm-near-caster-box" },
  );
  const farCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CsmFarCasterBox",
      width: 0.74,
      height: 0.74,
      depth: 0.74,
    }),
    { id: "csm-far-caster-box" },
  );
  const nearReceiverMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "CsmNearReceiverMatte",
      baseColorFactor: new Float32Array([0.72, 0.82, 0.76, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.78,
    }),
    { id: "csm-near-receiver-matte" },
  );
  const farReceiverMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "CsmFarReceiverMatte",
      baseColorFactor: new Float32Array([0.7, 0.76, 0.88, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "csm-far-receiver-matte" },
  );
  const nearCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "CsmNearCasterWarm",
      baseColorFactor: new Float32Array([1.0, 0.58, 0.28, 1]),
      metallicFactor: 0.03,
      roughnessFactor: 0.48,
    }),
    { id: "csm-near-caster-warm" },
  );
  const farCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "CsmFarCasterCool",
      baseColorFactor: new Float32Array([0.36, 0.66, 1.0, 1]),
      metallicFactor: 0.03,
      roughnessFactor: 0.5,
    }),
    { id: "csm-far-caster-cool" },
  );

  return {
    nearReceiverMesh,
    farReceiverMesh,
    nearCasterMesh,
    farCasterMesh,
    nearReceiverMaterial,
    farReceiverMaterial,
    nearCasterMaterial,
    farCasterMaterial,
    receiverMeshKeys: [
      aperture.assetHandleKey(nearReceiverMesh),
      aperture.assetHandleKey(farReceiverMesh),
    ],
    casterMeshKeys: [
      aperture.assetHandleKey(nearCasterMesh),
      aperture.assetHandleKey(farCasterMesh),
    ],
  };
}

export function createDirectionalLightRotation() {
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
