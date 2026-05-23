export const clearColor = [0.018, 0.02, 0.024, 1];
export const sheenMeshId = "sheen-panel-mesh";
export const baseMaterialId = "sheen-base-material";
export const fabricMaterialId = "sheen-fabric-material";

export const sheenReadbackSamples = [
  { id: "base-rim", x: 0.34, y: 0.42 },
  { id: "sheen-rim", x: 0.77, y: 0.42 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerSheenScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(sheenMeshId);
  const baseMaterial = aperture.createMaterialHandle(baseMaterialId);
  const fabricMaterial = aperture.createMaterialHandle(fabricMaterialId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createSphereMeshAsset({
      label: "SheenSphere",
      radius: 0.42,
      widthSegments: 48,
      heightSegments: 24,
    }),
  );
  registry.register(baseMaterial);
  registry.markReady(
    baseMaterial,
    aperture.createStandardMaterialAsset({
      label: "MatteFabricBase",
      baseColorFactor: new Float32Array([0.32, 0.075, 0.045, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.78,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(fabricMaterial);
  registry.markReady(
    fabricMaterial,
    aperture.createStandardMaterialAsset({
      label: "CopperSheenFabric",
      baseColorFactor: new Float32Array([0.32, 0.075, 0.045, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.78,
      sheenColorFactor: [1, 0.55, 0.22],
      sheenRoughnessFactor: 0.28,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    baseMaterial,
    fabricMaterial,
    meshKey: aperture.assetHandleKey(mesh),
    baseMaterialKey: aperture.assetHandleKey(baseMaterial),
    fabricMaterialKey: aperture.assetHandleKey(fabricMaterial),
    samples: sheenReadbackSamples,
  };
}
