// Shared scene for the stencil-outline example (parity plan D1). The classic
// three.js "single-pass outline" recipe: draw a mesh normally while stamping
// stencil = 1 over its silhouette, then draw a scaled-up copy of the same mesh
// where stencil != 1 (Material.stencilFunc "notequal"). Only the enlarged
// copy's border (the ring that extends BEYOND the original silhouette, where no
// stencil was written) survives — producing a solid outline halo, while the
// enlarged copy's interior is masked out by the stencil the base wrote.
//
// One camera / one pass; `withRenderOrder` sequences base-before-outline in the
// opaque queue. The depth attachment is auto-selected as depth24plus-stencil8
// because a material enables `renderState.stencil`.

export const clearColor = [0.03, 0.03, 0.06, 1];
export const stencilOutlineCanvasSize = { width: 256, height: 256 };
export const stencilOutlineFrameCount = 3;

export const outlineBaseColor = [0.15, 0.32, 0.95, 1];
export const outlineColor = [1.0, 0.5, 0.12, 1];

// Sample points: center is the base mesh (blue); the halo ring around it is the
// outline (orange); the corners are outside the enlarged copy (dark clear).
export const stencilOutlineSamplePoints = [
  { id: "base-center", x: 0.5, y: 0.5 },
  { id: "outline-top", x: 0.5, y: 0.27 },
  { id: "outline-bottom", x: 0.5, y: 0.73 },
  { id: "background-corner", x: 0.07, y: 0.07 },
];

export function registerStencilOutlineScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });

  // Base mesh: drawn normally (blue), stamps stencil = 1 over its silhouette.
  const baseMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutlineBase",
      width: 1.4,
      height: 1.4,
      depth: 1.4,
    }),
    { id: "stencil-outline-base-mesh" },
  );
  const baseMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OutlineBase",
      baseColorFactor: new Float32Array(outlineBaseColor),
      renderState: {
        depth: { test: true, write: true, compare: "less-equal" },
        stencil: aperture.createStencilState({
          compare: "always",
          passOp: "replace",
          reference: 1,
        }),
      },
    }),
    { id: "stencil-outline-base-material" },
  );

  // Outline mesh: a scaled-up copy (orange) drawn ONLY where stencil != 1, so
  // just the border ring beyond the base silhouette shows. Depth test off so it
  // is not occluded by the base it surrounds.
  const outlineMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "OutlineShell",
      width: 2.3,
      height: 2.3,
      depth: 2.3,
    }),
    { id: "stencil-outline-shell-mesh" },
  );
  const outlineMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "OutlineShell",
      baseColorFactor: new Float32Array(outlineColor),
      renderState: {
        depth: { test: false, write: false, compare: "always" },
        stencil: aperture.createStencilState({
          compare: "not-equal",
          passOp: "keep",
          reference: 1,
        }),
      },
    }),
    { id: "stencil-outline-shell-material" },
  );

  return {
    baseMesh,
    baseMaterial,
    outlineMesh,
    outlineMaterial,
    outlineMaterialKey: aperture.assetHandleKey(outlineMaterial),
  };
}

export function spawnStencilOutlineEntities(
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

  // Base first (render order 0) — writes stencil = 1 over its silhouette.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.baseMesh),
    aperture.withMaterial(registered.baseMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
    aperture.withVisibility(true),
  );

  // Outline second (render order 1) — drawn only where stencil != 1.
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.outlineMesh),
    aperture.withMaterial(registered.outlineMaterial),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(1),
    aperture.withVisibility(true),
  );
}
