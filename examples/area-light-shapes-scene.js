export const clearColor = [0.012, 0.018, 0.026, 1];

export const areaLightShapes = [
  {
    shape: "rect",
    width: 1.65,
    height: 0.58,
    intensity: 8,
  },
  {
    shape: "disk",
    width: 1.2,
    height: 1.2,
    intensity: 8,
  },
  {
    shape: "sphere",
    width: 1.2,
    height: 1.2,
    intensity: 8,
  },
];

export const areaLightScenarios = areaLightShapes.flatMap((shape) => [
  {
    id: `${shape.shape}-glossy`,
    ...shape,
    material: "glossy",
    roughness: 0.18,
    surfaceRotationY: 0,
  },
  {
    id: `${shape.shape}-rough`,
    ...shape,
    material: "rough",
    roughness: 0.82,
    surfaceRotationY: 0,
  },
  {
    id: `${shape.shape}-oblique`,
    ...shape,
    material: "rough",
    roughness: 0.82,
    surfaceRotationY: 0.42,
  },
]);

export const readbackSamples = [
  { id: "center", x: 0.5, y: 0.5 },
  { id: "left", x: 0.28, y: 0.5 },
  { id: "upper", x: 0.5, y: 0.34 },
];

export function registerAreaLightShapesScene(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "AreaLightShapesSurface",
      width: 2.6,
      height: 1.5,
    }),
    { id: "area-light-shapes-surface" },
  );
  const roughMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "AreaLightShapesRoughMetalSurface",
      baseColorFactor: new Float32Array([0.72, 0.76, 0.82, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }),
    { id: "area-light-shapes-rough-surface" },
  );
  const glossyMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "AreaLightShapesGlossyMetalSurface",
      baseColorFactor: new Float32Array([0.72, 0.76, 0.82, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.18,
    }),
    { id: "area-light-shapes-glossy-surface" },
  );

  return {
    mesh,
    material: roughMaterial,
    materials: {
      rough: roughMaterial,
      glossy: glossyMaterial,
    },
    areaLightShapes,
    areaLightScenarios,
    readbackSamples,
  };
}
