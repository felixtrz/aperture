export const renderToTextureOffscreenSize = 256;
export const renderToTextureDualSizeSecondarySize = {
  width: 384,
  height: 192,
};
export const renderToTextureOffscreenClearColor = [0.02, 0.035, 0.07, 1];
export const renderToTextureScreenClearColor = {
  r: 0.015,
  g: 0.018,
  b: 0.023,
  a: 1,
};
export const renderToTexturePlaneColor = [0.06, 0.88, 0.22, 1];
export const renderToTextureClearMaterialColor = [
  ...renderToTextureOffscreenClearColor,
];
export const renderToTextureCanvasPlaneColor = [0.1, 0.42, 0.95, 1];
export const renderToTextureCurrentPlaneColor = [0.95, 0.28, 0.08, 1];
export const renderToTextureCropRect = [0.3, 0.25, 0.4, 0.5];
export const renderToTextureCenterSample = {
  id: "quad-center",
  x: 0.5,
  y: 0.5,
};
export const renderToTextureScreenClearSample = {
  id: "screen-clear-corner",
  x: 0.12,
  y: 0.12,
};
export const renderToTextureCanvasSample = {
  id: "canvas-direct-left",
  x: 0.25,
  y: 0.5,
};
export const renderToTextureMixedMultiCurrentSample = {
  id: "current-texture-direct-left",
  x: 0.25,
  y: 0.5,
};
export const renderToTexturePreviewSample = {
  id: "offscreen-preview-center",
  x: 0.75,
  y: 0.5,
};
export const renderToTextureLeftPreviewSample = {
  id: "left-target-preview-center",
  x: 0.26,
  y: 0.5,
};
export const renderToTextureRightPreviewSample = {
  id: "right-target-preview-center",
  x: 0.74,
  y: 0.5,
};
export const renderToTextureCropInsideSample = {
  id: "offscreen-crop-inside",
  x: 0.5,
  y: 0.5,
};
export const renderToTextureCropOutsideSample = {
  id: "offscreen-crop-outside",
  x: 0.31,
  y: 0.5,
};
export const renderToTextureClearLoadClearSample = {
  id: "offscreen-clear-only",
  x: 0.21,
  y: 0.32,
};
export const renderToTextureClearLoadBaseSample = {
  id: "offscreen-base-preserved",
  x: 0.36,
  y: 0.5,
};
export const renderToTextureClearLoadOverlaySample = {
  id: "offscreen-overlay-center",
  x: 0.5,
  y: 0.5,
};
export const renderToTextureSecondaryCropInsideSample = {
  id: "secondary-crop-inside",
  x: 0.74,
  y: 0.5,
};
export const renderToTextureSecondaryCropOutsideSample = {
  id: "secondary-crop-outside",
  x: 0.602,
  y: 0.5,
};

export function registerRenderToTextureAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const renderTarget = aperture.createRenderTargetHandle(
    "render-to-texture-offscreen",
  );
  const secondaryRenderTarget = aperture.createRenderTargetHandle(
    "render-to-texture-offscreen-secondary",
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
  const clearMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "RenderToTextureClear",
      baseColorFactor: new Float32Array(renderToTextureClearMaterialColor),
    }),
    { id: "render-to-texture-clear" },
  );
  const canvasMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "RenderToTextureCanvasBlue",
      baseColorFactor: new Float32Array(renderToTextureCanvasPlaneColor),
    }),
    { id: "render-to-texture-canvas-blue" },
  );
  const currentMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "RenderToTextureCurrentOrange",
      baseColorFactor: new Float32Array(renderToTextureCurrentPlaneColor),
    }),
    { id: "render-to-texture-current-orange" },
  );

  return {
    mesh,
    material,
    clearMaterial,
    canvasMaterial,
    currentMaterial,
    renderTarget,
    secondaryRenderTarget,
  };
}
