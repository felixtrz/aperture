// Shared scene for the stencil-portal example (parity plan D1). A stencil MASK
// marks a small centered "portal" region in the stencil buffer, then a large
// scene-content quad is drawn ONLY where the stencil equals the mask reference
// — so the content is revealed through the portal shape and masked out
// everywhere else. This is the three.js stencil-portal recipe
// (Material.stencilWrite / stencilFunc "equal" / stencilRef).
//
// Everything happens in ONE camera / ONE render pass: `withRenderOrder` gives
// the opaque queue a deterministic order (mask first, content second), the
// stencil buffer is written by the mask and tested by the content, and the
// content (drawn second, depth-test disabled) overwrites the mask's colour in
// the portal region. Outside the portal the content fails the stencil test and
// the dark clear colour shows through — proving the mask.

export const clearColor = [0.03, 0.04, 0.12, 1];
export const stencilPortalCanvasSize = { width: 256, height: 256 };
export const stencilPortalFrameCount = 3;

// Bright green content revealed through the portal; the mask colour is never
// seen (the content overwrites it inside the portal region).
export const portalContentColor = [0.1, 0.85, 0.25, 1];
export const portalMaskColor = [0.4, 0.4, 0.4, 1];

// Sample points for the e2e screenshot. Center is inside the portal (content
// revealed -> green); the corners are outside (masked -> dark clear colour).
export const stencilPortalSamplePoints = [
  { id: "portal-center", x: 0.5, y: 0.5 },
  { id: "portal-center-2", x: 0.44, y: 0.56 },
  { id: "masked-corner", x: 0.1, y: 0.1 },
  { id: "masked-corner-2", x: 0.9, y: 0.9 },
];

export function registerStencilPortalScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });

  // A small centered quad that stamps stencil = 1 over the portal region.
  const maskMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PortalMask",
      width: 1.7,
      height: 1.7,
      depth: 0.05,
    }),
    { id: "stencil-portal-mask-mesh" },
  );
  const maskMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PortalMask",
      baseColorFactor: new Float32Array(portalMaskColor),
      renderState: {
        // Depth off so the mask always stamps stencil; stencil replace writes
        // the reference (1) wherever the mask draws.
        depth: { test: false, write: false, compare: "always" },
        stencil: aperture.createStencilState({
          compare: "always",
          passOp: "replace",
          reference: 1,
        }),
      },
    }),
    { id: "stencil-portal-mask-material" },
  );

  // A large quad covering the whole view; only the portal region (stencil == 1)
  // survives the stencil test, revealing the green content.
  const contentMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PortalContent",
      width: 12,
      height: 12,
      depth: 0.05,
    }),
    { id: "stencil-portal-content-mesh" },
  );
  const contentMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "PortalContent",
      baseColorFactor: new Float32Array(portalContentColor),
      renderState: {
        depth: { test: false, write: false, compare: "always" },
        stencil: aperture.createStencilState({
          compare: "equal",
          passOp: "keep",
          reference: 1,
        }),
      },
    }),
    { id: "stencil-portal-content-material" },
  );

  return {
    maskMesh,
    maskMaterial,
    contentMesh,
    contentMaterial,
    contentMaterialKey: aperture.assetHandleKey(contentMaterial),
  };
}

export function spawnStencilPortalEntities(
  aperture,
  app,
  registered,
  canvasSize,
) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      aspect,
      fovYDegrees: 55,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor,
    }),
  );

  // Mask first (render order 0) — stamps the stencil portal region.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.maskMesh),
    aperture.withMaterial(registered.maskMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
    aperture.withVisibility(true),
  );

  // Content second (render order 1) — revealed only where stencil == 1.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.contentMesh),
    aperture.withMaterial(registered.contentMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(1),
    aperture.withVisibility(true),
  );
}
