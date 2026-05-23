export const clearColor = [0.015, 0.017, 0.021, 1];
export const iridescenceMeshId = "iridescence-panel-mesh";
export const baseMaterialId = "iridescence-base-material";
export const filmMaterialId = "iridescence-film-material";

export const iridescenceReadbackSamples = [
  { id: "base-highlight", x: 0.25, y: 0.5 },
  { id: "film-highlight", x: 0.625, y: 0.5 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerIridescenceScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(iridescenceMeshId);
  const baseMaterial = aperture.createMaterialHandle(baseMaterialId);
  const filmMaterial = aperture.createMaterialHandle(filmMaterialId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createSphereMeshAsset({
      label: "IridescenceSphere",
      radius: 0.42,
      widthSegments: 64,
      heightSegments: 32,
    }),
  );
  registry.register(baseMaterial);
  registry.markReady(
    baseMaterial,
    aperture.createStandardMaterialAsset({
      label: "DarkGlossBase",
      baseColorFactor: new Float32Array([0.045, 0.07, 0.105, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.18,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(filmMaterial);
  registry.markReady(
    filmMaterial,
    aperture.createStandardMaterialAsset({
      label: "SoapFilmIridescence",
      baseColorFactor: new Float32Array([0.045, 0.07, 0.105, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.18,
      iridescenceFactor: 1,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 560,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    baseMaterial,
    filmMaterial,
    meshKey: aperture.assetHandleKey(mesh),
    baseMaterialKey: aperture.assetHandleKey(baseMaterial),
    filmMaterialKey: aperture.assetHandleKey(filmMaterial),
    samples: iridescenceReadbackSamples,
  };
}
