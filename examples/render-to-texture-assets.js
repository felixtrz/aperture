export const renderToTextureOffscreenSize = 256;
export const renderToTextureOffscreenClearColor = [0.02, 0.035, 0.07, 1];
export const renderToTextureScreenClearColor = {
  r: 0.015,
  g: 0.018,
  b: 0.023,
  a: 1,
};
export const renderToTexturePlaneColor = [0.06, 0.88, 0.22, 1];
export const renderToTextureCenterSample = {
  id: "quad-center",
  x: 0.5,
  y: 0.5,
};

export function registerRenderToTextureAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const renderTarget = aperture.createRenderTargetHandle(
    "render-to-texture-offscreen",
  );
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "RenderToTexturePlane",
      width: 2.2,
      height: 2.2,
    }),
    { id: "render-to-texture-plane" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "RenderToTextureGreen",
      baseColorFactor: new Float32Array(renderToTexturePlaneColor),
    }),
    { id: "render-to-texture-green" },
  );

  return {
    mesh,
    material,
    renderTarget,
  };
}
