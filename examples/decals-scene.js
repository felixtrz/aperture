// Shared scene for the decals example (D4, advanced-audit scenario #17): an
// FPS-style stream of bullet-hole decals accumulating on an opaque wall. Each
// frame the worker fires one "shot" — spawning a projected decal entity at the
// next slot along the wall. The decal subsystem depth-biases each projected
// quad onto the wall (no z-fighting) and caps the live decals at
// DECAL_CAPACITY, evicting the OLDEST first (ring buffer). So after the cap is
// reached the LEFT (oldest) decals disappear while the RIGHT (newest) stay:
//   - right half  -> newest decals survive  -> orange bullet holes;
//   - left half   -> oldest decals evicted  -> bare wall.

export const clearColor = [0.02, 0.03, 0.05, 1];
export const decalsCanvasSize = { width: 360, height: 240 };

// One shot fired per frame; DECAL_CAPACITY < DECAL_SHOTS so the cap is exceeded
// and eviction is exercised, asserted via the frame report.
export const DECAL_SHOTS = 12;
export const DECAL_CAPACITY = 6;

export const wallColor = [0.16, 0.22, 0.42, 1];
// The decal tint: bright orange (high red) so a decaled wall pixel is trivially
// distinguishable from the blue-grey wall (low red).
export const decalColor = [1.0, 0.42, 0.12, 1];

export const wallMeshId = "decals-wall-mesh";
export const wallMaterialId = "decals-wall-material";
export const decalTextureId = "decals-bullet-texture";
export const decalSamplerId = "decals-bullet-sampler";

// The decal row lies at y = 0, z = the wall front, marching left → right. Slot i
// world-x. Newest DECAL_CAPACITY slots survive; the rest (lower i) are evicted.
export function decalSlotX(index) {
  return -3.3 + index * 0.6;
}

export const decalRowY = 0;
export const decalRowZ = 0.2;
export const decalSize = [0.7, 0.7];

// Normalized canvas sample points for the e2e screenshot. Decals accumulate as a
// continuous orange band over the RIGHT half (surviving newest slots); the LEFT
// half is bare wall (evicted oldest slots). A control point below the band stays
// wall-coloured.
export const decalsSamplePoints = [
  { id: "decal-hit-a", x: 0.6, y: 0.5 },
  { id: "decal-hit-b", x: 0.68, y: 0.5 },
  { id: "evicted-a", x: 0.2, y: 0.5 },
  { id: "evicted-b", x: 0.35, y: 0.5 },
  { id: "wall-control", x: 0.5, y: 0.85 },
];

export function registerDecalsScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });

  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DecalsWall",
      width: 10,
      height: 6,
      depth: 0.4,
    }),
    { id: wallMeshId },
  );
  const wallMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DecalsWall",
      baseColorFactor: new Float32Array(wallColor),
    }),
    { id: wallMaterialId },
  );

  // A solid-white 2x2 bullet-hole texture; the orange comes from the decal tint
  // so the same texture can front any decal colour.
  const decalTexture = aperture.createTextureHandle(decalTextureId);
  const decalSampler = aperture.createSamplerHandle(decalSamplerId);

  registry.register(decalTexture);
  registry.markReady(
    decalTexture,
    aperture.createTextureAsset({
      label: "DecalsBulletHole",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(decalSampler);
  registry.markReady(
    decalSampler,
    aperture.createSamplerAsset({
      label: "DecalsBulletSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  );

  return {
    wallMesh,
    wallMaterial,
    decalTexture,
    decalSampler,
    wallMaterialKey: aperture.assetHandleKey(wallMaterial),
  };
}

// Spawn the camera + opaque wall (shot decals are spawned per frame by the
// worker; see spawnDecalShot).
export function spawnDecalsSceneEntities(
  aperture,
  app,
  registered,
  canvasSize,
) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 7] }),
    aperture.withCamera({
      aspect,
      fovYDegrees: 45,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.wallMesh),
    aperture.withMaterial(registered.wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}

// Fire one bullet-hole decal at slot `index` (0-based). `sequence` stamps spawn
// order so the oldest-first cap evicts in firing order.
export function spawnDecalShot(aperture, app, registered, index) {
  app.spawn(
    aperture.withTransform({
      translation: [decalSlotX(index), decalRowY, decalRowZ],
    }),
    aperture.withDecal({
      texture: registered.decalTexture,
      sampler: registered.decalSampler,
      size: decalSize,
      color: decalColor,
      capacity: DECAL_CAPACITY,
      sequence: index + 1,
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}
