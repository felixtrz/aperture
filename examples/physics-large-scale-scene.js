export const physicsLargeScaleClearColor = [0.012, 0.016, 0.024, 1];

export const physicsLargeScaleFixedDelta = 1 / 60;
export const physicsLargeScaleFixedSteps = 300;
export const physicsLargeScaleDynamicBodyCount = 256;

export const physicsLargeScaleReadbackSamples = [
  { id: "background", x: 0.5, y: 0.04 },
  { id: "terrain", x: 0.5, y: 0.91 },
  { id: "body-field-left", x: 0.475, y: 0.85 },
  { id: "body-field-center", x: 0.525, y: 0.85 },
  { id: "body-field-right", x: 0.575, y: 0.85 },
];

export function registerPhysicsLargeScaleScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const terrainMesh = assets.meshes.add(createTerrainMeshAsset(), {
    id: "physics-large-scale-terrain",
  });
  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PhysicsLargeScaleUnitBox",
    }),
    { id: "physics-large-scale-unit-box" },
  );
  const terrainMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsLargeScaleTerrainMaterial",
      baseColorFactor: new Float32Array([0.34, 0.45, 0.38, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "physics-large-scale-terrain" },
  );
  const blueMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsLargeScaleBlueBodies",
      baseColorFactor: new Float32Array([0.22, 0.54, 0.9, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.56,
    }),
    { id: "physics-large-scale-blue" },
  );
  const goldMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsLargeScaleGoldBodies",
      baseColorFactor: new Float32Array([0.95, 0.7, 0.24, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.54,
    }),
    { id: "physics-large-scale-gold" },
  );
  const mintMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PhysicsLargeScaleMintBodies",
      baseColorFactor: new Float32Array([0.38, 0.78, 0.58, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.6,
    }),
    { id: "physics-large-scale-mint" },
  );

  return {
    terrainMesh,
    boxMesh,
    materials: {
      terrain: terrainMaterial,
      blue: blueMaterial,
      gold: goldMaterial,
      mint: mintMaterial,
    },
    meshKeys: {
      terrain: aperture.assetHandleKey(terrainMesh),
      box: aperture.assetHandleKey(boxMesh),
    },
    materialKeys: {
      terrain: aperture.assetHandleKey(terrainMaterial),
      blue: aperture.assetHandleKey(blueMaterial),
      gold: aperture.assetHandleKey(goldMaterial),
      mint: aperture.assetHandleKey(mintMaterial),
    },
    readbackSamples: physicsLargeScaleReadbackSamples,
  };
}

export function physicsLargeScaleBodySpec(index) {
  const columns = 16;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const layer = Math.floor(index / 64);
  const x = (column - 7.5) * 0.72;
  const z = (row - 7.5) * 0.72;
  const y = 2.0 + layer * 0.74 + ((row + column) % 4) * 0.09;
  const material = index % 3 === 0 ? "blue" : index % 3 === 1 ? "gold" : "mint";

  return {
    id: `body-${index}`,
    translation: [x, y, z],
    material,
  };
}

export function physicsLargeScaleDirectionalLightRotation() {
  return quaternionFromForward([0.34, -0.72, -0.6]);
}

export function physicsLargeScaleCameraRotation() {
  const translation = [0, 5.5, 11];
  const target = [0, 0.15, 0];
  const forward = normalize([
    target[0] - translation[0],
    target[1] - translation[1],
    target[2] - translation[2],
  ]);

  return quaternionFromForward([-forward[0], -forward[1], -forward[2]]);
}

function createTerrainMeshAsset() {
  const half = 8.5;
  const positions = [
    [-half, 0, -half],
    [half, 0, -half],
    [-half, 0, half],
    [half, 0, half],
  ];
  const vertices = [];

  for (const position of positions) {
    vertices.push(position[0], position[1], position[2], 0, 1, 0, 0, 0);
  }

  return {
    kind: "mesh",
    label: "PhysicsLargeScaleTerrainMesh",
    vertexStreams: [
      {
        id: "terrain-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array(vertices),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 2, 1, 2, 3, 1]),
    },
    submeshes: [
      {
        label: "terrain",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "terrain" }],
    localAabb: { min: [-half, 0, -half], max: [half, 0, half] },
    localSphere: { center: [0, 0, 0], radius: Math.hypot(half, half) },
  };
}

function quaternionFromForward(forward) {
  const f = normalize(forward);
  const up = [0, 1, 0];
  let right = normalize(cross(up, f));

  if (length(right) === 0) {
    right = [1, 0, 0];
  }

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

    return normalizeQuat([
      (m21 - m12) / s,
      (m02 - m20) / s,
      (m10 - m01) / s,
      0.25 * s,
    ]);
  }

  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;

    return normalizeQuat([
      0.25 * s,
      (m01 + m10) / s,
      (m02 + m20) / s,
      (m21 - m12) / s,
    ]);
  }

  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;

    return normalizeQuat([
      (m01 + m10) / s,
      0.25 * s,
      (m12 + m21) / s,
      (m02 - m20) / s,
    ]);
  }

  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;

  return normalizeQuat([
    (m02 + m20) / s,
    (m12 + m21) / s,
    0.25 * s,
    (m10 - m01) / s,
  ]);
}

function normalize(value) {
  const len = length(value);

  return len === 0 ? [0, 0, -1] : value.map((component) => component / len);
}

function normalizeQuat(value) {
  const len = Math.hypot(value[0], value[1], value[2], value[3]);

  return len === 0 ? [0, 0, 0, 1] : value.map((component) => component / len);
}

function length(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}
