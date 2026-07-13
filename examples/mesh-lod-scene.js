// Shared scene for the mesh-LOD example (E2, three.js THREE.LOD analog): a tiny
// field of LOD'd "rocks". Each rock is a single entity carrying a `Lod`
// component with two levels — a high-poly sphere (near / level 0) and a
// low-poly box (far / level 1) — plus a hysteresis band. Deterministic,
// per-camera level selection runs worker-side in extraction and overrides the
// drawn mesh handle, so as the camera dollies in/out the per-level draw
// distribution shifts (asserted from the frame report), while a nudge that
// stays inside the hysteresis band never repicks (no popping).

export const clearColor = [0.02, 0.03, 0.06, 1];
export const meshLodCanvasSize = { width: 240, height: 180 };

// Four rocks clustered symmetrically around the origin on the camera axis, so
// they all sit at (near enough) the same camera distance and switch level
// together — the histogram is then a clean all-level-0 vs all-level-1.
export const ROCK_OFFSETS = [
  [-1, -1, 0],
  [1, -1, 0],
  [-1, 1, 0],
  [1, 1, 0],
];
export const ROCK_COUNT = ROCK_OFFSETS.length;

// Level 1 begins at distance 20; hysteresis band half-width 3 → band [17, 23).
export const LOD_NEAR_DISTANCE = 0;
export const LOD_FAR_DISTANCE = 20;
export const LOD_HYSTERESIS = 3;

export const hiMeshId = "mesh-lod-rock-hi";
export const loMeshId = "mesh-lod-rock-lo";
export const rockMaterialId = "mesh-lod-rock-material";

// A deterministic camera-distance schedule. Order matters: the hysteresis state
// is sticky, so "band-a" and "band-b" straddle the raw threshold (20) from the
// level-0 side and must therefore BOTH stay at level 0 — that is the no-popping
// proof. "far" then clears threshold + hysteresis and every rock drops to
// level 1.
export const FRAME_PLAN = [
  { label: "near", z: 8 },
  { label: "band-a", z: 19 },
  { label: "band-b", z: 21 },
  { label: "far", z: 40 },
];

export function registerMeshLodScene(aperture, registry) {
  const hi = aperture.createMeshHandle(hiMeshId);
  const lo = aperture.createMeshHandle(loMeshId);
  const material = aperture.createMaterialHandle(rockMaterialId);

  registry.register(hi);
  registry.markReady(
    hi,
    aperture.createSphereMeshAsset({
      label: "MeshLodRockHigh",
      radius: 0.8,
      widthSegments: 32,
      heightSegments: 24,
    }),
  );
  registry.register(lo);
  registry.markReady(
    lo,
    aperture.createBoxMeshAsset({
      label: "MeshLodRockLow",
      width: 1.3,
      height: 1.3,
      depth: 1.3,
    }),
  );
  registry.register(material);
  registry.markReady(
    material,
    aperture.createUnlitMaterialAsset({
      label: "MeshLodRock",
      baseColorFactor: new Float32Array([0.62, 0.66, 0.72, 1]),
    }),
  );

  return {
    hi,
    lo,
    material,
    materialKey: aperture.assetHandleKey(material),
  };
}

export function spawnMeshLodSceneEntities(
  aperture,
  app,
  registered,
  canvasSize,
) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  const camera = app.spawn(
    aperture.withTransform({ translation: [0, 0, FRAME_PLAN[0].z] }),
    aperture.withCamera({
      aspect,
      fovYDegrees: 55,
      near: 0.1,
      far: 200,
      priority: 0,
      layerMask: 1,
      clearColor,
    }),
  );

  for (const offset of ROCK_OFFSETS) {
    app.spawn(
      aperture.withTransform({ translation: [...offset] }),
      aperture.withMesh(registered.hi),
      aperture.withMaterial(registered.material),
      aperture.withLod({
        levels: [
          { mesh: registered.hi, distance: LOD_NEAR_DISTANCE },
          { mesh: registered.lo, distance: LOD_FAR_DISTANCE },
        ],
        hysteresis: LOD_HYSTERESIS,
      }),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }

  return camera;
}

// Reposition the camera on the view axis so its distance to the rock field
// changes frame to frame. The transform system recomputes the world matrix on
// the next step, and LOD selection reads it in extraction.
export function moveCameraZ(aperture, camera, z) {
  camera.getVectorView(aperture.LocalTransform, "translation").set([0, 0, z]);
}
