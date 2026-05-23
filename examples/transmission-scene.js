export const clearColor = [0.018, 0.022, 0.028, 1];
export const transmissionSphereMeshId = "transmission-sphere-mesh";
export const transmissionPanelMeshId = "transmission-panel-mesh";
export const glassMaterialId = "transmission-glass-material";
export const backgroundMaterialId = "transmission-background-material";

export const transmissionReadbackSamples = [
  { id: "through-glass", x: 0.5, y: 0.5 },
  { id: "background", x: 0.8, y: 0.5 },
  { id: "clear", x: 0.08, y: 0.12 },
];

export function registerTransmissionScene(aperture, registry) {
  const sphereMesh = aperture.createMeshHandle(transmissionSphereMeshId);
  const panelMesh = aperture.createMeshHandle(transmissionPanelMeshId);
  const glassMaterial = aperture.createMaterialHandle(glassMaterialId);
  const backgroundMaterial =
    aperture.createMaterialHandle(backgroundMaterialId);

  registry.register(sphereMesh);
  registry.markReady(
    sphereMesh,
    aperture.createSphereMeshAsset({
      label: "TransmissionSphere",
      radius: 0.52,
      widthSegments: 48,
      heightSegments: 24,
    }),
  );
  registry.register(panelMesh);
  registry.markReady(
    panelMesh,
    aperture.createBoxMeshAsset({ label: "TransmissionBackgroundPanel" }),
  );
  registry.register(glassMaterial);
  registry.markReady(
    glassMaterial,
    aperture.createStandardMaterialAsset({
      label: "ThinBlueGlass",
      baseColorFactor: new Float32Array([0.42, 0.72, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.04,
      transmissionFactor: 0.65,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
        cullMode: "none",
      },
    }),
  );
  registry.register(backgroundMaterial);
  registry.markReady(
    backgroundMaterial,
    aperture.createStandardMaterialAsset({
      label: "WarmBackdrop",
      baseColorFactor: new Float32Array([0.95, 0.78, 0.12, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.9,
      emissiveFactor: [0.35, 0.24, 0.03],
      renderState: { cullMode: "none" },
    }),
  );

  return {
    sphereMesh,
    panelMesh,
    glassMaterial,
    backgroundMaterial,
    sphereMeshKey: aperture.assetHandleKey(sphereMesh),
    panelMeshKey: aperture.assetHandleKey(panelMesh),
    glassMaterialKey: aperture.assetHandleKey(glassMaterial),
    backgroundMaterialKey: aperture.assetHandleKey(backgroundMaterial),
    samples: transmissionReadbackSamples,
  };
}
