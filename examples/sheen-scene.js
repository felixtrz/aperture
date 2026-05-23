export const clearColor = [0.018, 0.02, 0.024, 1];
export const sheenMeshId = "sheen-panel-mesh";
export const sheenTextureMeshId = "sheen-texture-panel-mesh";
export const baseMaterialId = "sheen-base-material";
export const fabricMaterialId = "sheen-fabric-material";
export const texturedFabricMaterialId = "sheen-textured-fabric-material";
export const sheenColorTextureId = "sheen-color-factor-texture";
export const sheenColorSamplerId = "sheen-color-nearest";

export const sheenReadbackSamples = [
  { id: "base-rim", x: 0.34, y: 0.42 },
  { id: "sheen-rim", x: 0.77, y: 0.42 },
  { id: "texture-low", x: 0.3, y: 0.76 },
  { id: "texture-high", x: 0.57, y: 0.76 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerSheenScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(sheenMeshId);
  const textureMesh = aperture.createMeshHandle(sheenTextureMeshId);
  const baseMaterial = aperture.createMaterialHandle(baseMaterialId);
  const fabricMaterial = aperture.createMaterialHandle(fabricMaterialId);
  const texturedFabricMaterial = aperture.createMaterialHandle(
    texturedFabricMaterialId,
  );
  const sheenColorTexture = aperture.createTextureHandle(sheenColorTextureId);
  const sheenColorSampler = aperture.createSamplerHandle(sheenColorSamplerId);

  registry.register(mesh);
  registry.markReady(
    mesh,
    aperture.createPlaneMeshAsset({
      label: "SheenPanel",
      width: 0.72,
      height: 0.9,
    }),
  );
  registry.register(textureMesh);
  registry.markReady(
    textureMesh,
    aperture.createPlaneMeshAsset({
      label: "SheenColorTexturePanel",
      width: 1.0,
      height: 0.4,
    }),
  );
  registry.register(sheenColorTexture);
  registry.markReady(
    sheenColorTexture,
    aperture.createTextureAsset({
      label: "SheenColorTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "sheen-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  registry.register(sheenColorSampler);
  registry.markReady(
    sheenColorSampler,
    aperture.createSamplerAsset({
      label: "SheenColorNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    }),
  );
  registry.register(baseMaterial);
  registry.markReady(
    baseMaterial,
    aperture.createStandardMaterialAsset({
      label: "MatteFabricBase",
      baseColorFactor: new Float32Array([0.08, 0.018, 0.012, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(fabricMaterial);
  registry.markReady(
    fabricMaterial,
    aperture.createStandardMaterialAsset({
      label: "GreenSheenFabric",
      baseColorFactor: new Float32Array([0.08, 0.018, 0.012, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
      sheenColorFactor: [0.15, 1, 0.45],
      sheenRoughnessFactor: 1,
      renderState: { cullMode: "none" },
    }),
  );
  registry.register(texturedFabricMaterial);
  registry.markReady(
    texturedFabricMaterial,
    aperture.createStandardMaterialAsset({
      label: "TextureMaskedGreenSheenFabric",
      baseColorFactor: new Float32Array([0.08, 0.018, 0.012, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
      sheenColorFactor: [0.15, 1, 0.45],
      sheenColorTexture: {
        texture: sheenColorTexture,
        sampler: sheenColorSampler,
      },
      sheenRoughnessFactor: 1,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    textureMesh,
    baseMaterial,
    fabricMaterial,
    texturedFabricMaterial,
    sheenColorTexture,
    sheenColorSampler,
    meshKey: aperture.assetHandleKey(mesh),
    textureMeshKey: aperture.assetHandleKey(textureMesh),
    baseMaterialKey: aperture.assetHandleKey(baseMaterial),
    fabricMaterialKey: aperture.assetHandleKey(fabricMaterial),
    texturedFabricMaterialKey: aperture.assetHandleKey(texturedFabricMaterial),
    sheenColorTextureKey: aperture.assetHandleKey(sheenColorTexture),
    sheenColorSamplerKey: aperture.assetHandleKey(sheenColorSampler),
    samples: sheenReadbackSamples,
  };
}
