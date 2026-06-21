export const clearColor = [0.012, 0.014, 0.018, 1];

export const msaaCanvasSize = {
  width: 512,
  height: 512,
};

export function registerMsaaScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const edgeMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "MsaaEdgePlane",
      width: 1.56,
      height: 1.78,
    }),
    { id: "msaa-edge-plane" },
  );
  const whiteMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "MsaaWhite",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      renderState: { cullMode: "none" },
    }),
    { id: "msaa-white" },
  );

  return {
    edgeMesh,
    whiteMaterial,
    meshKey: aperture.assetHandleKey(edgeMesh),
    materialKey: aperture.assetHandleKey(whiteMaterial),
  };
}
