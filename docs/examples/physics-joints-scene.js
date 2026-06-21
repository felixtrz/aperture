export const physicsJointsClearColor = [0.012, 0.016, 0.026, 1];

export const physicsJointsFixedDelta = 1 / 60;
export const physicsJointsFixedSteps = 360;

export const physicsJointsHinge = {
  anchorTranslation: [-1.75, 1.45, 0],
  pendulumInitialTranslation: [-1.75, 0.82, 0],
  pendulumAnchorLocal: [0, 0.63, 0],
  axis: [0, 0, 1],
  expectedMaxCenterTravel: 0.1,
  maxAnchorError: 0.14,
};

export const physicsJointsPrismatic = {
  railTranslation: [1.25, 0.48, 0],
  sliderInitialTranslation: [1.25, 0.48, 0],
  axis: [1, 0, 0],
  minLimit: -0.35,
  maxLimit: 0.65,
  motorTarget: 0.48,
  expectedMinAxisTravel: 0.32,
  maxPerpendicularDrift: 0.08,
};

export const physicsJointsReadbackSamples = [
  { id: "background", x: 0.08, y: 0.14 },
  { id: "ground", x: 0.5, y: 0.945 },
  { id: "hinge-anchor", x: 0.295, y: 0.45 },
  { id: "prismatic-rail", x: 0.645, y: 0.65 },
];

const debugLineCategories = [
  {
    id: "collider",
    material: "debugCollider",
    slotLabel: "debug-collider",
    submeshLabel: "debug-collider-wireframes",
    color: [0.04, 0.86, 1, 1],
  },
  {
    id: "jointFrame",
    material: "debugJointFrame",
    slotLabel: "debug-joint-frame",
    submeshLabel: "debug-joint-frames",
    color: [0.9, 0.45, 1, 1],
    sourceColor: [0.9, 0.45, 1, 1],
  },
  {
    id: "jointAxis",
    material: "debugJointAxis",
    slotLabel: "debug-joint-axis",
    submeshLabel: "debug-joint-axes",
    color: [0.2, 0.95, 1, 1],
    sourceColor: [0.2, 0.95, 1, 1],
  },
];

export function registerPhysicsJointsScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PhysicsJointsUnitBox",
    }),
    { id: "physics-joints-unit-box" },
  );
  const debugMesh = assets.meshes.add(
    createPhysicsJointsDebugLineMesh(aperture, []),
    { id: "physics-joints-debug-lines" },
  );
  const groundMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsJointsGroundMaterial",
      baseColorFactor: new Float32Array([0.38, 0.44, 0.45, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.86,
    }),
    { id: "physics-joints-ground" },
  );
  const anchorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsJointsAnchorMaterial",
      baseColorFactor: new Float32Array([0.9, 0.45, 0.18, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.52,
    }),
    { id: "physics-joints-anchor" },
  );
  const pendulumMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsJointsPendulumMaterial",
      baseColorFactor: new Float32Array([0.32, 0.58, 0.96, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.46,
    }),
    { id: "physics-joints-pendulum" },
  );
  const railMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsJointsRailMaterial",
      baseColorFactor: new Float32Array([0.62, 0.66, 0.74, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.5,
    }),
    { id: "physics-joints-rail" },
  );
  const sliderMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsJointsSliderMaterial",
      baseColorFactor: new Float32Array([0.38, 0.86, 0.58, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.48,
    }),
    { id: "physics-joints-slider" },
  );
  const debugColliderMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsJointsDebugCollider",
    "physics-joints-debug-collider",
    [0.04, 0.86, 1, 1],
  );
  const debugJointFrameMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsJointsDebugJointFrame",
    "physics-joints-debug-joint-frame",
    [0.9, 0.45, 1, 1],
  );
  const debugJointAxisMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsJointsDebugJointAxis",
    "physics-joints-debug-joint-axis",
    [0.2, 0.95, 1, 1],
  );

  return {
    boxMesh,
    debugMesh,
    materials: {
      ground: groundMaterial,
      anchor: anchorMaterial,
      pendulum: pendulumMaterial,
      rail: railMaterial,
      slider: sliderMaterial,
      debugCollider: debugColliderMaterial,
      debugJointFrame: debugJointFrameMaterial,
      debugJointAxis: debugJointAxisMaterial,
    },
    meshKey: aperture.assetHandleKey(boxMesh),
    debugMeshKey: aperture.assetHandleKey(debugMesh),
    materialKeys: {
      ground: aperture.assetHandleKey(groundMaterial),
      anchor: aperture.assetHandleKey(anchorMaterial),
      pendulum: aperture.assetHandleKey(pendulumMaterial),
      rail: aperture.assetHandleKey(railMaterial),
      slider: aperture.assetHandleKey(sliderMaterial),
      debugCollider: aperture.assetHandleKey(debugColliderMaterial),
      debugJointFrame: aperture.assetHandleKey(debugJointFrameMaterial),
      debugJointAxis: aperture.assetHandleKey(debugJointAxisMaterial),
    },
    readbackSamples: physicsJointsReadbackSamples,
  };
}

export function createPhysicsJointsDebugLineMesh(aperture, lines) {
  const buckets = debugLineCategories.map(() => []);
  const positions = [];
  const indices = [];
  const submeshes = [];

  for (const line of lines) {
    if (!finiteVec3(line.from) || !finiteVec3(line.to)) {
      continue;
    }

    buckets[debugLineBucketIndex(line)].push(line);
  }

  for (let slot = 0; slot < debugLineCategories.length; slot += 1) {
    const category = debugLineCategories[slot];
    const bucket = buckets[slot];

    if (category === undefined || bucket === undefined || bucket.length === 0) {
      continue;
    }

    const indexStart = indices.length;

    for (const line of bucket) {
      positions.push(vec3(line.from), vec3(line.to));
      indices.push(indices.length, indices.length + 1);
    }

    submeshes.push({
      label: category.submeshLabel,
      materialSlot: slot,
      vertexStart: 0,
      vertexCount: positions.length,
      indexStart,
      indexCount: bucket.length * 2,
    });
  }

  if (submeshes.length === 0) {
    submeshes.push({
      label: debugLineCategories[0].submeshLabel,
      materialSlot: 0,
      vertexStart: 0,
      vertexCount: 0,
      indexStart: 0,
      indexCount: 0,
    });
  }

  return aperture.createLineListMeshAsset({
    label: "PhysicsJointsDebugLines",
    positions,
    indices,
    materialSlots: debugLineCategories.map((category) => category.slotLabel),
    submeshes,
  });
}

export function createPhysicsJointsDebugMaterialSlots(materials) {
  return {
    slots: debugLineCategories.slice(1).map((category, index) => ({
      slot: index + 1,
      material: materials[category.material],
    })),
  };
}

export function countPhysicsJointsDebugLinesByCategory(lines) {
  const counts = Object.fromEntries(
    debugLineCategories.map((category) => [category.id, 0]),
  );

  for (const line of lines) {
    counts[debugLineCategory(line)] += 1;
  }

  return counts;
}

export function physicsJointsDirectionalLightRotation() {
  return quaternionFromForward([0.28, -0.66, -0.7]);
}

function createDebugMaterial(aperture, assets, label, id, color) {
  return assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label,
      baseColorFactor: new Float32Array(color),
    }),
    { id },
  );
}

function debugLineCategoryIndex(line) {
  return debugLineCategories.findIndex(
    (category) =>
      category.sourceColor !== undefined &&
      sameColor(line.color, category.sourceColor),
  );
}

function debugLineBucketIndex(line) {
  const index = debugLineCategoryIndex(line);

  return index === -1 ? 0 : index;
}

function debugLineCategory(line) {
  return debugLineCategories[debugLineBucketIndex(line)].id;
}

function sameColor(left, right) {
  return (
    Array.isArray(left) &&
    left.length >= 4 &&
    left.every((value, index) => Math.abs(value - right[index]) < 0.0001)
  );
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

function finiteVec3(value) {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Number.isFinite(value[2])
  );
}

function vec3(value) {
  return [value[0], value[1], value[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
