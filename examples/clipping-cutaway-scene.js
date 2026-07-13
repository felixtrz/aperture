// Shared scene for the clipping-cutaway example (parity plan D2). A single
// SYMMETRIC box is drawn under one orthographic camera that carries a per-camera
// world-space clip plane. The plane keeps fragments where `dot(worldPos, n) + d
// >= 0` (three.js THREE.Plane semantics) and DISCARDS the rest in the fragment
// shader — WebGPU core has no `clip_distances`, so clipping is a per-fragment
// discard path.
//
// The clip plane is `(1, 0, 0, 0)` -> keep world x >= 0. Because the box spans a
// symmetric x range [-1.5, 1.5], the ONLY reason the left half of the view is
// background (dark clear colour) while the right half is the opaque box colour is
// the clip plane. A point that is opaque without clipping (left half) becomes
// background once the plane is active — that asymmetry is the cutaway proof.

export const clearColor = [0.02, 0.03, 0.09, 1];
export const clippingCutawayCanvasSize = { width: 256, height: 256 };
export const clippingCutawayFrameCount = 3;

// Bright box colour so the kept half reads clearly against the dark clear colour.
export const boxColor = [0.95, 0.58, 0.16, 1];

// World-space clip plane (nx, ny, nz, d): keep x >= 0, discard x < 0.
export const cutawayClipPlane = [1, 0, 0, 0];

// Orthographic framing: height 4, aspect 1 -> visible world x,y in [-2, 2]. The
// box spans [-1.5, 1.5] in x and y, so screen x fraction (worldX + 2) / 4 puts
// the box between 0.125 and 0.875. The clip plane cuts at worldX 0 -> screen 0.5.
export const orthographicHeight = 4;

// Sample points for the e2e screenshot (x, y as 0..1 of the canvas, y top-down).
// Kept (worldX >= 0) -> box colour; clipped (worldX < 0) -> dark background.
export const clippingCutawaySamplePoints = [
  { id: "kept-box", x: 0.7, y: 0.5 },
  { id: "kept-box-2", x: 0.8, y: 0.35 },
  { id: "clipped-bg", x: 0.3, y: 0.5 },
  { id: "clipped-bg-2", x: 0.2, y: 0.65 },
];

export function registerClippingCutawayScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });

  const boxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CutawayBox",
      width: 3,
      height: 3,
      depth: 1,
    }),
    { id: "clipping-cutaway-box-mesh" },
  );

  const boxMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "CutawayBox",
      baseColorFactor: new Float32Array(boxColor),
      renderState: {
        // Double-sided so the exposed cut cross-section stays visible and the
        // silhouette never depends on triangle winding.
        cullMode: "none",
      },
    }),
    { id: "clipping-cutaway-box-material" },
  );

  return {
    boxMesh,
    boxMaterial,
    boxMaterialKey: aperture.assetHandleKey(boxMaterial),
  };
}

export function spawnClippingCutawayEntities(
  aperture,
  app,
  registered,
  canvasSize,
) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  // One orthographic camera carrying the per-camera clip plane (three.js
  // renderer.clippingPlanes analog). `withCamera` attaches the CameraClipPlanes
  // companion component when `clipPlanes` is present.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      projection: "orthographic",
      orthographicHeight,
      aspect,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor,
      clipPlanes: [cutawayClipPlane],
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.boxMesh),
    aperture.withMaterial(registered.boxMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}
