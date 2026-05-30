// M4-T5 proof scene: a single large floor that is BOTH a shadow caster and a
// shadow receiver, grazed at a shallow angle by a directional light. At bias=0
// (and normalBias=0) the floor self-shadows → acne speckles; an authored bias
// cleans it; a very large bias detaches the self-shadow (peter-panning) and the
// floor brightens. The directional light direction matches the csm scene so the
// same grazing geometry applies.

export const clearColor = [0.01, 0.015, 0.022, 1];

export const shadowBiasIntent = {
  mapSize: 1024,
  cascadeCount: 4,
  shadowDistance: 24,
  // The default authored bias the demo uses when no override is supplied.
  depthBias: 0.0015,
  normalBias: 0.02,
};

export function registerShadowBiasScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const floorMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ShadowBiasFloor",
      width: 40,
      height: 0.1,
      depth: 40,
    }),
    { id: "shadow-bias-floor" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ShadowBiasFloorMatte",
      baseColorFactor: new Float32Array([0.82, 0.82, 0.85, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.92,
    }),
    { id: "shadow-bias-floor-matte" },
  );

  return { floorMesh, floorMaterial };
}

export function createShadowBiasLightRotation() {
  // Light travels almost horizontally (skims the floor) for a strong grazing
  // angle that exposes self-shadow acne without bias.
  return quaternionFromForward([0.12, -0.06, -0.99]);
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
