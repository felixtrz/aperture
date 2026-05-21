export const materialsShowcaseClearColor = [0.015, 0.02, 0.027, 1];
export const materialsShowcaseMaterialNames = [
  "unlit",
  "standard-pbr-diffuse-ibl",
  "matcap",
];
export const materialsShowcaseSpinAxis = [0.35, 1, 0.2];
export const materialsShowcaseCubeSpecs = [
  { key: "unlit", translation: [-1.45, 0, 0], speed: 0.74 },
  { key: "standard", translation: [0, 0, 0], speed: 0.92 },
  { key: "matcap", translation: [1.45, 0, 0], speed: 0.82 },
];

export function registerMaterialsShowcaseAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "ShowcaseCube" }),
    { id: "showcase-cube" },
  );
  const unlit = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "ShowcaseUnlit",
      baseColorFactor: new Float32Array([1, 0.42, 0.18, 1]),
    }),
    { id: "showcase-unlit" },
  );
  const standardBaseColorTexture = aperture.createTextureHandle(
    "showcase-standard-base-color",
  );
  const standardBaseColorSampler = aperture.createSamplerHandle(
    "showcase-standard-base-color-linear",
  );
  const standardMetallicRoughnessTexture = aperture.createTextureHandle(
    "showcase-standard-metallic-roughness",
  );
  const standardMetallicRoughnessSampler = aperture.createSamplerHandle(
    "showcase-standard-metallic-roughness-linear",
  );
  const standardOcclusionTexture = aperture.createTextureHandle(
    "showcase-standard-occlusion",
  );
  const standardOcclusionSampler = aperture.createSamplerHandle(
    "showcase-standard-occlusion-linear",
  );
  const standardEmissiveTexture = aperture.createTextureHandle(
    "showcase-standard-emissive",
  );
  const standardEmissiveSampler = aperture.createSamplerHandle(
    "showcase-standard-emissive-linear",
  );

  registry.register(standardBaseColorTexture);
  registry.markReady(
    standardBaseColorTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardBaseColorTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          92, 255, 148, 255, 30, 204, 220, 255, 190, 255, 116, 255, 42, 124,
          255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(standardBaseColorSampler);
  registry.markReady(
    standardBaseColorSampler,
    aperture.createSamplerAsset({ label: "ShowcaseStandardBaseColorSampler" }),
  );
  registry.register(standardMetallicRoughnessTexture);
  registry.markReady(
    standardMetallicRoughnessTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardMetallicRoughnessTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "metallic-roughness",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          0, 48, 230, 255, 0, 196, 72, 255, 0, 96, 180, 255, 0, 224, 96, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(standardMetallicRoughnessSampler);
  registry.markReady(
    standardMetallicRoughnessSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardMetallicRoughnessSampler",
    }),
  );
  registry.register(standardOcclusionTexture);
  registry.markReady(
    standardOcclusionTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardOcclusionTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "occlusion",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 0, 0, 255, 128, 0, 0, 255, 192, 0, 0, 255, 96, 0, 0, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(standardOcclusionSampler);
  registry.markReady(
    standardOcclusionSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardOcclusionSampler",
    }),
  );
  registry.register(standardEmissiveTexture);
  registry.markReady(
    standardEmissiveTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardEmissiveTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "emissive",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          40, 255, 110, 255, 20, 160, 255, 255, 190, 255, 90, 255, 80, 120, 255,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(standardEmissiveSampler);
  registry.markReady(
    standardEmissiveSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardEmissiveSampler",
    }),
  );

  const standard = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ShowcaseStandard",
      baseColorFactor: new Float32Array([0.85, 1, 0.9, 1]),
      baseColorTexture: {
        texture: standardBaseColorTexture,
        sampler: standardBaseColorSampler,
      },
      metallicRoughnessTexture: {
        texture: standardMetallicRoughnessTexture,
        sampler: standardMetallicRoughnessSampler,
      },
      occlusionTexture: {
        texture: standardOcclusionTexture,
        sampler: standardOcclusionSampler,
      },
      emissiveTexture: {
        texture: standardEmissiveTexture,
        sampler: standardEmissiveSampler,
      },
      metallicFactor: 0.18,
      roughnessFactor: 0.36,
      occlusionStrength: 0.72,
      emissiveFactor: [0.12, 0.2, 0.16],
    }),
    { id: "showcase-standard" },
  );
  const matcapTexture = aperture.createTextureHandle("showcase-matcap");
  const matcapSampler = aperture.createSamplerHandle("showcase-matcap-linear");

  registry.register(matcapTexture);
  registry.markReady(
    matcapTexture,
    aperture.createTextureAsset({
      label: "ShowcaseMatcapTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48, 72,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(matcapSampler);
  registry.markReady(
    matcapSampler,
    aperture.createSamplerAsset({ label: "ShowcaseMatcapSampler" }),
  );

  const matcap = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "ShowcaseMatcap",
      baseColorFactor: new Float32Array([1, 0.54, 0.95, 1]),
      matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
    }),
    { id: "showcase-matcap" },
  );
  const environmentMap = aperture.createEnvironmentMapHandle(
    "materials-showcase-studio",
  );

  registry.register(environmentMap, { label: "Materials showcase IBL" });
  registry.markReady(environmentMap, {
    label: "Materials showcase IBL",
    diffuseResourceKey: "materials-showcase-studio/diffuse",
  });

  return {
    mesh,
    materials: { unlit, standard, matcap },
    standardBaseColorTexture,
    standardBaseColorSampler,
    standardMetallicRoughnessTexture,
    standardMetallicRoughnessSampler,
    standardOcclusionTexture,
    standardOcclusionSampler,
    standardEmissiveTexture,
    standardEmissiveSampler,
    matcapTexture,
    matcapSampler,
    environmentMap,
  };
}
