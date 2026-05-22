export const clearColor = [0.018, 0.02, 0.024, 1];
export const clearcoatMeshId = "clearcoat-panel-mesh";
export const baseMaterialId = "clearcoat-base-material";
export const coatedMaterialId = "clearcoat-coated-material";

export const clearcoatReadbackSamples = [
  { id: "base-panel", x: 0.21, y: 0.5 },
  { id: "clearcoat-panel", x: 0.63, y: 0.5 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerClearcoatScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(clearcoatMeshId);
  const baseMaterial = aperture.createMaterialHandle(baseMaterialId);
  const coatedMaterial = aperture.createMaterialHandle(coatedMaterialId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createSphereMeshAsset({
      label: "ClearcoatSphere",
      radius: 0.42,
      widthSegments: 48,
      heightSegments: 24,
    }),
  );
  registry.register(baseMaterial);
  registry.markReady(
    baseMaterial,
    aperture.createStandardMaterialAsset({
      label: "RedBaseCoat",
      baseColorFactor: new Float32Array([0.52, 0.025, 0.018, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.72,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(coatedMaterial);
  registry.markReady(
    coatedMaterial,
    aperture.createStandardMaterialAsset({
      label: "RedClearcoat",
      baseColorFactor: new Float32Array([0.52, 0.025, 0.018, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.72,
      clearcoatFactor: 1,
      clearcoatRoughnessFactor: 0.12,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    baseMaterial,
    coatedMaterial,
    meshKey: aperture.assetHandleKey(mesh),
    baseMaterialKey: aperture.assetHandleKey(baseMaterial),
    coatedMaterialKey: aperture.assetHandleKey(coatedMaterial),
    samples: clearcoatReadbackSamples,
  };
}
