export const dofClearColor = [0.035, 0.038, 0.045, 1];

export const dofCanvasSize = {
  width: 512,
  height: 512,
};

export function registerDofScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const stripeMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "DofBackgroundStripe",
      width: 0.18,
      height: 4.45,
    }),
    { id: "dof-background-stripe" },
  );
  const focusBoxMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DofFocusBox",
      width: 0.92,
      height: 0.92,
      depth: 0.92,
    }),
    { id: "dof-focus-box" },
  );
  const brightStripeMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DofBrightStripe",
      baseColorFactor: new Float32Array([0.96, 0.96, 0.9, 1]),
      renderState: { cullMode: "none" },
    }),
    { id: "dof-bright-stripe" },
  );
  const darkStripeMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DofDarkStripe",
      baseColorFactor: new Float32Array([0.05, 0.065, 0.08, 1]),
      renderState: { cullMode: "none" },
    }),
    { id: "dof-dark-stripe" },
  );
  const focusBoxMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DofFocusOrange",
      baseColorFactor: new Float32Array([0.96, 0.31, 0.12, 1]),
      renderState: { cullMode: "back" },
    }),
    { id: "dof-focus-orange" },
  );

  return {
    stripeMesh,
    focusBoxMesh,
    brightStripeMaterial,
    darkStripeMaterial,
    focusBoxMaterial,
    meshKeys: [
      aperture.assetHandleKey(stripeMesh),
      aperture.assetHandleKey(focusBoxMesh),
    ],
    materialKeys: [
      aperture.assetHandleKey(brightStripeMaterial),
      aperture.assetHandleKey(darkStripeMaterial),
      aperture.assetHandleKey(focusBoxMaterial),
    ],
  };
}
