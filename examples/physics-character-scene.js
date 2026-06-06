export const physicsCharacterClearColor = [0.014, 0.018, 0.025, 1];

export const physicsCharacterFixedDelta = 1 / 60;
export const physicsCharacterFixedSteps = 1;

export const physicsCharacterReadbackSamples = [
  { id: "background", x: 0.08, y: 0.12 },
  { id: "floor", x: 0.5, y: 0.82 },
  { id: "character", x: 0.55, y: 0.56 },
  { id: "obstacle", x: 0.39, y: 0.78 },
];

const debugLineCategories = [
  {
    id: "collider",
    material: "debugCollider",
    slotLabel: "debug-collider",
    submeshLabel: "debug-collider-wireframes",
    color: [0.08, 0.86, 1, 1],
  },
];

export function registerPhysicsCharacterScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PhysicsCharacterUnitBox",
    }),
    { id: "physics-character-unit-box" },
  );
  const debugMesh = assets.meshes.add(
    createPhysicsCharacterDebugLineMesh(aperture, []),
    { id: "physics-character-debug-lines" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsCharacterFloorMaterial",
      baseColorFactor: new Float32Array([0.34, 0.4, 0.42, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.84,
    }),
    { id: "physics-character-floor" },
  );
  const characterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsCharacterAvatarMaterial",
      baseColorFactor: new Float32Array([0.2, 0.66, 0.94, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.42,
    }),
    { id: "physics-character-avatar" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsCharacterWallMaterial",
      baseColorFactor: new Float32Array([0.88, 0.5, 0.26, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.56,
    }),
    { id: "physics-character-wall" },
  );
  const stepMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsCharacterStepMaterial",
      baseColorFactor: new Float32Array([0.36, 0.82, 0.5, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.5,
    }),
    { id: "physics-character-step" },
  );
  const slopeMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsCharacterSlopeMaterial",
      baseColorFactor: new Float32Array([0.64, 0.48, 0.9, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.58,
    }),
    { id: "physics-character-slope" },
  );
  const debugColliderMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PhysicsCharacterDebugCollider",
      baseColorFactor: new Float32Array([0.08, 0.86, 1, 1]),
    }),
    { id: "physics-character-debug-collider" },
  );

  return {
    boxMesh,
    debugMesh,
    materials: {
      floor: floorMaterial,
      character: characterMaterial,
      wall: wallMaterial,
      step: stepMaterial,
      slope: slopeMaterial,
      debugCollider: debugColliderMaterial,
    },
    meshKey: aperture.assetHandleKey(boxMesh),
    debugMeshKey: aperture.assetHandleKey(debugMesh),
    materialKeys: {
      floor: aperture.assetHandleKey(floorMaterial),
      character: aperture.assetHandleKey(characterMaterial),
      wall: aperture.assetHandleKey(wallMaterial),
      step: aperture.assetHandleKey(stepMaterial),
      slope: aperture.assetHandleKey(slopeMaterial),
      debugCollider: aperture.assetHandleKey(debugColliderMaterial),
    },
    readbackSamples: physicsCharacterReadbackSamples,
  };
}

export function createPhysicsCharacterDebugLineMesh(aperture, lines) {
  const positions = [];
  const indices = [];

  for (const line of lines) {
    if (!finiteVec3(line.from) || !finiteVec3(line.to)) {
      continue;
    }

    positions.push(vec3(line.from), vec3(line.to));
    indices.push(indices.length, indices.length + 1);
  }

  return aperture.createLineListMeshAsset({
    label: "PhysicsCharacterDebugLines",
    positions,
    indices,
    materialSlots: debugLineCategories.map((category) => category.slotLabel),
    submeshes: [
      {
        label: debugLineCategories[0].submeshLabel,
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: positions.length,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
  });
}

export function physicsCharacterDirectionalLightRotation() {
  return quaternionFromForward([0.32, -0.64, -0.7]);
}

export function quatFromZRotation(radians) {
  return [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
}

function finiteVec3(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => Number.isFinite(component))
  );
}

function vec3(value) {
  return [value[0], value[1], value[2]];
}

function quaternionFromForward(forward) {
  const f = normalize(forward);
  const up = [0, 1, 0];
  const right = normalize(cross(up, f));
  const correctedUp = cross(f, right);
  const m00 = right[0];
  const m01 = correctedUp[0];
  const m02 = f[0];
  const m10 = right[1];
  const m11 = correctedUp[1];
  const m12 = f[1];
  const m20 = right[2];
  const m21 = correctedUp[2];
  const m22 = f[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }

  return [0, 0, 0, 1];
}

function normalize(value) {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}
