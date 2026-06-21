// Shared scene for the custom-graph-pass example (M3-T7): a single unlit cube on
// a dark clear, so the offscreen scene-color a user compute pass reads has clear
// content and a user render overlay has something to draw over.

export const clearColor = [0.02, 0.03, 0.05, 1];

export const customGraphPassCanvasSize = {
  width: 512,
  height: 512,
};

export const customGraphPassFrameCount = 6;

// A fixed cube orientation (deterministic across frames for stable pixels).
export const cubeRotation = [0.146, 0.354, 0.354, 0.853];

export function registerCustomGraphPassScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "CustomGraphPassCube",
      width: 1.5,
      height: 1.5,
      depth: 1.5,
    }),
    { id: "custom-graph-pass-cube" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "CustomGraphPassUnlit",
      baseColorFactor: new Float32Array([0.95, 0.78, 0.28, 1]),
    }),
    { id: "custom-graph-pass-unlit" },
  );

  return {
    mesh,
    material,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
  };
}
