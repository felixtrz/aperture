export const clearColor = [0.018, 0.02, 0.024, 1];
export const clearcoatMeshId = "clearcoat-panel-mesh";
export const clearcoatMaterialId = "clearcoat-textured-material";
export const clearcoatTextureId = "clearcoat-factor-texture";
export const clearcoatSamplerId = "clearcoat-factor-nearest";
export const clearcoatRoughnessMaterialId =
  "clearcoat-roughness-textured-material";
export const clearcoatRoughnessTextureId = "clearcoat-roughness-factor-texture";
export const clearcoatRoughnessSamplerId = "clearcoat-roughness-factor-nearest";

export const clearcoatReadbackSamples = [
  { id: "base-panel", x: 0.38, y: 0.4 },
  { id: "clearcoat-panel", x: 0.62, y: 0.4 },
  { id: "roughness-broad", x: 0.38, y: 0.68 },
  { id: "roughness-sharp", x: 0.62, y: 0.68 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerClearcoatScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(clearcoatMeshId);
  const material = aperture.createMaterialHandle(clearcoatMaterialId);
  const clearcoatTexture = aperture.createTextureHandle(clearcoatTextureId);
  const clearcoatSampler = aperture.createSamplerHandle(clearcoatSamplerId);
  const roughnessMaterial = aperture.createMaterialHandle(
    clearcoatRoughnessMaterialId,
  );
  const roughnessTexture = aperture.createTextureHandle(
    clearcoatRoughnessTextureId,
  );
  const roughnessSampler = aperture.createSamplerHandle(
    clearcoatRoughnessSamplerId,
  );

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createPlaneMeshAsset({
      label: "ClearcoatFactorPanel",
      width: 1.35,
      height: 0.62,
    }),
  );
  registry.register(clearcoatTexture);
  registry.markReady(
    clearcoatTexture,
    aperture.createTextureAsset({
      label: "ClearcoatFactorTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(clearcoatSampler);
  registry.markReady(
    clearcoatSampler,
    aperture.createSamplerAsset({
      label: "ClearcoatNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    }),
  );
  registry.register(roughnessTexture);
  registry.markReady(
    roughnessTexture,
    aperture.createTextureAsset({
      label: "ClearcoatRoughnessTexture",
      dimension: "2d",
      width: 2,
      height: 1,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "clearcoat-roughness",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([0, 255, 0, 255, 0, 0, 0, 255]),
        bytesPerRow: 8,
        rowsPerImage: 1,
      },
    }),
  );
  registry.register(roughnessSampler);
  registry.markReady(
    roughnessSampler,
    aperture.createSamplerAsset({
      label: "ClearcoatRoughnessNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    }),
  );
  registry.register(material);
  registry.markReady(
    material,
    aperture.createStandardMaterialAsset({
      label: "RedTextureBackedClearcoat",
      baseColorFactor: new Float32Array([0.52, 0.025, 0.018, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.72,
      clearcoatFactor: 1,
      clearcoatTexture: {
        texture: clearcoatTexture,
        sampler: clearcoatSampler,
      },
      clearcoatRoughnessFactor: 0.12,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(roughnessMaterial);
  registry.markReady(
    roughnessMaterial,
    aperture.createStandardMaterialAsset({
      label: "BlueTextureBackedClearcoatRoughness",
      baseColorFactor: new Float32Array([0.05, 0.14, 0.42, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.5,
      clearcoatFactor: 1,
      clearcoatRoughnessFactor: 1,
      clearcoatRoughnessTexture: {
        texture: roughnessTexture,
        sampler: roughnessSampler,
      },
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    material,
    roughnessMaterial,
    clearcoatTexture,
    clearcoatSampler,
    roughnessTexture,
    roughnessSampler,
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
    roughnessMaterialKey: aperture.assetHandleKey(roughnessMaterial),
    clearcoatTextureKey: aperture.assetHandleKey(clearcoatTexture),
    clearcoatSamplerKey: aperture.assetHandleKey(clearcoatSampler),
    roughnessTextureKey: aperture.assetHandleKey(roughnessTexture),
    roughnessSamplerKey: aperture.assetHandleKey(roughnessSampler),
    samples: clearcoatReadbackSamples,
  };
}
