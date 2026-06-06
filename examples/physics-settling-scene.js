export const physicsSettlingClearColor = [0.012, 0.017, 0.025, 1];

export const physicsSettlingFixedDelta = 1 / 60;
export const physicsSettlingFixedSteps = 480;

export const physicsSettlingReadbackSamples = [
  { id: "background", x: 0.08, y: 0.16 },
  { id: "stack-lower", x: 0.5, y: 0.8 },
  { id: "stack-middle", x: 0.5, y: 0.61 },
  { id: "stack-upper", x: 0.5, y: 0.41 },
  { id: "ground", x: 0.5, y: 0.91 },
  { id: "debug-edge", x: 0.56, y: 0.8 },
];

export const physicsSettlingDynamicBodies = [
  {
    id: "box-0",
    initialTranslation: [0, 3.25, 0],
    material: "rust",
    expectedMinDrop: 2.2,
  },
  {
    id: "box-1",
    initialTranslation: [0.02, 4.35, 0],
    material: "gold",
    expectedMinDrop: 2.25,
  },
  {
    id: "box-2",
    initialTranslation: [-0.02, 5.45, 0],
    material: "blue",
    expectedMinDrop: 2.3,
  },
  {
    id: "box-3",
    initialTranslation: [0.01, 6.55, 0],
    material: "mint",
    expectedMinDrop: 2.35,
  },
];

const debugLineCategories = [
  {
    id: "collider",
    material: "debug",
    slotLabel: "debug-collider",
    submeshLabel: "debug-collider-wireframes",
    color: [0.02, 0.95, 1, 1],
  },
  {
    id: "contactNormal",
    material: "debugContactNormal",
    slotLabel: "debug-contact-normal",
    submeshLabel: "debug-contact-normals",
    color: [1, 0.2, 0.12, 1],
    sourceColor: [1, 0.2, 0.12, 1],
  },
  {
    id: "rayHit",
    material: "debugRayHit",
    slotLabel: "debug-ray-hit",
    submeshLabel: "debug-ray-hits",
    color: [1, 0.86, 0.12, 1],
    sourceColor: [1, 0.86, 0.12, 1],
  },
  {
    id: "rayMiss",
    material: "debugRayMiss",
    slotLabel: "debug-ray-miss",
    submeshLabel: "debug-ray-misses",
    color: [0.45, 0.55, 0.65, 1],
    sourceColor: [0.45, 0.55, 0.65, 1],
  },
  {
    id: "activeBody",
    material: "debugActiveBody",
    slotLabel: "debug-active-body",
    submeshLabel: "debug-active-body-markers",
    color: [0.2, 1, 0.45, 1],
    sourceColor: [0.2, 1, 0.45, 1],
  },
  {
    id: "sleepingBody",
    material: "debugSleepingBody",
    slotLabel: "debug-sleeping-body",
    submeshLabel: "debug-sleeping-body-markers",
    color: [0.65, 0.7, 0.78, 1],
    sourceColor: [0.65, 0.7, 0.78, 1],
  },
];

export function registerPhysicsSettlingScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PhysicsSettlingUnitBox",
    }),
    { id: "physics-settling-unit-box" },
  );
  const groundMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsSettlingGroundMaterial",
      baseColorFactor: new Float32Array([0.44, 0.5, 0.48, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "physics-settling-ground" },
  );
  const rustMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsSettlingRustBox",
      baseColorFactor: new Float32Array([0.86, 0.38, 0.2, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.58,
    }),
    { id: "physics-settling-rust-box" },
  );
  const goldMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsSettlingGoldBox",
      baseColorFactor: new Float32Array([0.95, 0.72, 0.26, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.54,
    }),
    { id: "physics-settling-gold-box" },
  );
  const blueMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsSettlingBlueBox",
      baseColorFactor: new Float32Array([0.28, 0.52, 0.92, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.56,
    }),
    { id: "physics-settling-blue-box" },
  );
  const mintMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsSettlingMintBox",
      baseColorFactor: new Float32Array([0.38, 0.82, 0.68, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.6,
    }),
    { id: "physics-settling-mint-box" },
  );
  const debugMesh = assets.meshes.add(
    createPhysicsSettlingDebugLineMesh(aperture, []),
    { id: "physics-settling-debug-wireframes" },
  );
  const debugMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PhysicsSettlingDebugWireframe",
      baseColorFactor: new Float32Array([0.02, 0.95, 1, 1]),
    }),
    { id: "physics-settling-debug-wireframe" },
  );
  const debugContactNormalMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsSettlingDebugContactNormal",
    "physics-settling-debug-contact-normal",
    [1, 0.2, 0.12, 1],
  );
  const debugRayHitMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsSettlingDebugRayHit",
    "physics-settling-debug-ray-hit",
    [1, 0.86, 0.12, 1],
  );
  const debugRayMissMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsSettlingDebugRayMiss",
    "physics-settling-debug-ray-miss",
    [0.45, 0.55, 0.65, 1],
  );
  const debugActiveBodyMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsSettlingDebugActiveBody",
    "physics-settling-debug-active-body",
    [0.2, 1, 0.45, 1],
  );
  const debugSleepingBodyMaterial = createDebugMaterial(
    aperture,
    assets,
    "PhysicsSettlingDebugSleepingBody",
    "physics-settling-debug-sleeping-body",
    [0.65, 0.7, 0.78, 1],
  );

  return {
    boxMesh,
    debugMesh,
    materials: {
      ground: groundMaterial,
      rust: rustMaterial,
      gold: goldMaterial,
      blue: blueMaterial,
      mint: mintMaterial,
      debug: debugMaterial,
      debugContactNormal: debugContactNormalMaterial,
      debugRayHit: debugRayHitMaterial,
      debugRayMiss: debugRayMissMaterial,
      debugActiveBody: debugActiveBodyMaterial,
      debugSleepingBody: debugSleepingBodyMaterial,
    },
    meshKey: aperture.assetHandleKey(boxMesh),
    debugMeshKey: aperture.assetHandleKey(debugMesh),
    materialKeys: {
      ground: aperture.assetHandleKey(groundMaterial),
      rust: aperture.assetHandleKey(rustMaterial),
      gold: aperture.assetHandleKey(goldMaterial),
      blue: aperture.assetHandleKey(blueMaterial),
      mint: aperture.assetHandleKey(mintMaterial),
      debug: aperture.assetHandleKey(debugMaterial),
      debugContactNormal: aperture.assetHandleKey(debugContactNormalMaterial),
      debugRayHit: aperture.assetHandleKey(debugRayHitMaterial),
      debugRayMiss: aperture.assetHandleKey(debugRayMissMaterial),
      debugActiveBody: aperture.assetHandleKey(debugActiveBodyMaterial),
      debugSleepingBody: aperture.assetHandleKey(debugSleepingBodyMaterial),
    },
    readbackSamples: physicsSettlingReadbackSamples,
  };
}

export function createPhysicsSettlingDebugLineMesh(aperture, lines) {
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
    label: "PhysicsSettlingDebugWireframes",
    positions,
    indices,
    materialSlots: debugLineCategories.map((category) => category.slotLabel),
    submeshes,
  });
}

export function createPhysicsSettlingDebugMaterialSlots(materials) {
  return {
    slots: debugLineCategories.slice(1).map((category, index) => ({
      slot: index + 1,
      material: materials[category.material],
    })),
  };
}

export function countPhysicsSettlingDebugLinesByCategory(lines) {
  const counts = Object.fromEntries(
    debugLineCategories.map((category) => [category.id, 0]),
  );

  for (const line of lines) {
    counts[debugLineCategory(line)] += 1;
  }

  return counts;
}

export function physicsSettlingDirectionalLightRotation() {
  return quaternionFromForward([0.35, -0.62, -0.7]);
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
