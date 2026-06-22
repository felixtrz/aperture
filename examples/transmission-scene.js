export const clearColor = [0.018, 0.022, 0.028, 1];
export const transmissionSphereMeshId = "transmission-sphere-mesh";
export const transmissionPanelMeshId = "transmission-panel-mesh";
export const transmissionMaskMeshId = "transmission-mask-panel-mesh";
export const glassMaterialId = "transmission-glass-material";
export const roughGlassMaterialId = "transmission-rough-glass-material";
export const texturedGlassMaterialId = "transmission-textured-glass-material";
export const transmissionTextureId = "transmission-factor-texture";
export const transmissionSamplerId = "transmission-factor-nearest";
export const brightBackgroundMaterialId =
  "transmission-background-bright-material";
export const darkBackgroundMaterialId = "transmission-background-dark-material";

export const transmissionStripeCount = 24;
export const transmissionStripeSpan = 2.16;
export const transmissionExpectedMeshDraws = transmissionStripeCount + 4;

export const transmissionReadbackSamples = [
  { id: "glossy-dark", x: 0.2875, y: 0.5 },
  { id: "glossy-bright", x: 0.325, y: 0.5 },
  { id: "rough-dark", x: 0.6875, y: 0.5 },
  { id: "rough-bright", x: 0.725, y: 0.5 },
  { id: "background-glossy-dark", x: 0.2875, y: 0.72 },
  { id: "background-glossy-bright", x: 0.325, y: 0.72 },
  { id: "background-rough-dark", x: 0.6875, y: 0.72 },
  { id: "background-rough-bright", x: 0.725, y: 0.72 },
  { id: "texture-low", x: 0.4125, y: 0.865 },
  { id: "texture-high", x: 0.5875, y: 0.865 },
  { id: "texture-background", x: 0.5875, y: 0.955 },
  { id: "through-glass", x: 0.2875, y: 0.5 },
  { id: "background", x: 0.325, y: 0.72 },
  { id: "clear", x: 0.08, y: 0.12 },
];

export function registerTransmissionScene(aperture, registry) {
  const sphereMesh = aperture.createMeshHandle(transmissionSphereMeshId);
  const panelMesh = aperture.createMeshHandle(transmissionPanelMeshId);
  const maskMesh = aperture.createMeshHandle(transmissionMaskMeshId);
  const glassMaterial = aperture.createMaterialHandle(glassMaterialId);
  const roughGlassMaterial =
    aperture.createMaterialHandle(roughGlassMaterialId);
  const texturedGlassMaterial = aperture.createMaterialHandle(
    texturedGlassMaterialId,
  );
  const transmissionTexture = aperture.createTextureHandle(
    transmissionTextureId,
  );
  const transmissionSampler = aperture.createSamplerHandle(
    transmissionSamplerId,
  );
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
  registry.register(maskMesh);
  registry.markReady(
    maskMesh,
    aperture.createPlaneMeshAsset({
      label: "TransmissionTextureMaskPanel",
      width: 0.84,
      height: 0.34,
    }),
  );
  registry.register(transmissionTexture);
  registry.markReady(
    transmissionTexture,
    aperture.createTextureAsset({
      label: "TransmissionFactorTexture",
      dimension: "2d",
      width: 2,
      height: 1,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255]),
        bytesPerRow: 8,
      },
    }),
  );
  registry.register(transmissionSampler);
  registry.markReady(
    transmissionSampler,
    aperture.createSamplerAsset({
      label: "TransmissionNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    }),
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
  registry.register(texturedGlassMaterial);
  registry.markReady(
    texturedGlassMaterial,
    aperture.createStandardMaterialAsset({
      label: "TextureMaskedBlueGlass",
      baseColorFactor: new Float32Array([0.42, 0.72, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.02,
      transmissionFactor: 0.9,
      transmissionTexture: {
        texture: transmissionTexture,
        sampler: transmissionSampler,
      },
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
    maskMesh,
    glassMaterial,
    roughGlassMaterial,
    texturedGlassMaterial,
    transmissionTexture,
    transmissionSampler,
    brightBackgroundMaterial,
    darkBackgroundMaterial,
    sphereMeshKey: aperture.assetHandleKey(sphereMesh),
    panelMeshKey: aperture.assetHandleKey(panelMesh),
    maskMeshKey: aperture.assetHandleKey(maskMesh),
    glassMaterialKey: aperture.assetHandleKey(glassMaterial),
    roughGlassMaterialKey: aperture.assetHandleKey(roughGlassMaterial),
    texturedGlassMaterialKey: aperture.assetHandleKey(texturedGlassMaterial),
    transmissionTextureKey: aperture.assetHandleKey(transmissionTexture),
    transmissionSamplerKey: aperture.assetHandleKey(transmissionSampler),
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
