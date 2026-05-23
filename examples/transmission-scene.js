export const clearColor = [0.018, 0.022, 0.028, 1];
export const transmissionSphereMeshId = "transmission-sphere-mesh";
export const transmissionPanelMeshId = "transmission-panel-mesh";
export const glassMaterialId = "transmission-glass-material";
export const roughGlassMaterialId = "transmission-rough-glass-material";
export const brightBackgroundMaterialId =
  "transmission-background-bright-material";
export const darkBackgroundMaterialId = "transmission-background-dark-material";

export const transmissionStripeCount = 24;
export const transmissionStripeSpan = 2.16;
export const transmissionExpectedMeshDraws = transmissionStripeCount + 2;

export const transmissionReadbackSamples = [
  { id: "glossy-dark", x: 0.2875, y: 0.5 },
  { id: "glossy-bright", x: 0.325, y: 0.5 },
  { id: "rough-dark", x: 0.6875, y: 0.5 },
  { id: "rough-bright", x: 0.725, y: 0.5 },
  { id: "background-glossy-dark", x: 0.2875, y: 0.72 },
  { id: "background-glossy-bright", x: 0.325, y: 0.72 },
  { id: "background-rough-dark", x: 0.6875, y: 0.72 },
  { id: "background-rough-bright", x: 0.725, y: 0.72 },
  { id: "through-glass", x: 0.2875, y: 0.5 },
  { id: "background", x: 0.325, y: 0.72 },
  { id: "clear", x: 0.08, y: 0.12 },
];

export function registerTransmissionScene(aperture, registry) {
  const sphereMesh = aperture.createMeshHandle(transmissionSphereMeshId);
  const panelMesh = aperture.createMeshHandle(transmissionPanelMeshId);
  const glassMaterial = aperture.createMaterialHandle(glassMaterialId);
  const roughGlassMaterial =
    aperture.createMaterialHandle(roughGlassMaterialId);
  const brightBackgroundMaterial = aperture.createMaterialHandle(
    brightBackgroundMaterialId,
  );
  const darkBackgroundMaterial = aperture.createMaterialHandle(
    darkBackgroundMaterialId,
  );

  registry.register(sphereMesh);
  registry.markReady(
    sphereMesh,
    aperture.createSphereMeshAsset({
      label: "TransmissionSphere",
      radius: 0.4,
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
      label: "GlossyBlueGlass",
      baseColorFactor: new Float32Array([0.42, 0.72, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.02,
      transmissionFactor: 0.9,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
        cullMode: "none",
      },
    }),
  );
  registry.register(roughGlassMaterial);
  registry.markReady(
    roughGlassMaterial,
    aperture.createStandardMaterialAsset({
      label: "RoughBlueGlass",
      baseColorFactor: new Float32Array([0.42, 0.72, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.85,
      transmissionFactor: 0.9,
      renderState: {
        alphaMode: "blend",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
        cullMode: "none",
      },
    }),
  );
  registry.register(brightBackgroundMaterial);
  registry.markReady(
    brightBackgroundMaterial,
    aperture.createStandardMaterialAsset({
      label: "BrightTransmissionStripe",
      baseColorFactor: new Float32Array([0.95, 0.78, 0.12, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.9,
      emissiveFactor: [0.35, 0.24, 0.03],
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(darkBackgroundMaterial);
  registry.markReady(
    darkBackgroundMaterial,
    aperture.createStandardMaterialAsset({
      label: "DarkTransmissionStripe",
      baseColorFactor: new Float32Array([0.02, 0.12, 0.55, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.9,
      emissiveFactor: [0.0, 0.02, 0.18],
      renderState: { cullMode: "none" },
    }),
  );

  return {
    sphereMesh,
    panelMesh,
    glassMaterial,
    roughGlassMaterial,
    brightBackgroundMaterial,
    darkBackgroundMaterial,
    sphereMeshKey: aperture.assetHandleKey(sphereMesh),
    panelMeshKey: aperture.assetHandleKey(panelMesh),
    glassMaterialKey: aperture.assetHandleKey(glassMaterial),
    roughGlassMaterialKey: aperture.assetHandleKey(roughGlassMaterial),
    brightBackgroundMaterialKey: aperture.assetHandleKey(
      brightBackgroundMaterial,
    ),
    darkBackgroundMaterialKey: aperture.assetHandleKey(darkBackgroundMaterial),
    backgroundMaterialKey: aperture.assetHandleKey(brightBackgroundMaterial),
    expectedMeshDraws: transmissionExpectedMeshDraws,
    stripeCount: transmissionStripeCount,
    stripeSpan: transmissionStripeSpan,
    roughness: {
      glossy: 0.02,
      rough: 0.85,
    },
    transmissionFactor: 0.9,
    samples: transmissionReadbackSamples,
  };
}
