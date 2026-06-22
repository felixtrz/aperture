export const clearColor = [0.012, 0.018, 0.026, 1];

export const rectAreaLight = {
  width: 1.65,
  height: 0.58,
  intensity: 8,
};

export const readbackSamples = [
  { id: "center-lit", x: 0.5, y: 0.5 },
  { id: "left-falloff", x: 0.28, y: 0.5 },
  { id: "right-falloff", x: 0.72, y: 0.5 },
];

export function registerRectAreaLightScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "RectAreaLightSurface",
      width: 2.6,
      height: 1.5,
    }),
    { id: "rect-area-light-surface" },
  );
  const material = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "RectAreaLightMatteSurface",
      baseColorFactor: new Float32Array([0.72, 0.76, 0.82, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.52,
    }),
    { id: "rect-area-light-matte-surface" },
  );

  return {
    mesh,
    material,
    rectAreaLight,
    readbackSamples,
  };
}
