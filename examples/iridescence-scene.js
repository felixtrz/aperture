export const clearColor = [0.015, 0.017, 0.021, 1];
export const iridescenceMeshId = "iridescence-panel-mesh";
export const iridescenceTextureMeshId = "iridescence-texture-panel-mesh";
export const baseMaterialId = "iridescence-base-material";
export const filmMaterialId = "iridescence-film-material";
export const texturedFilmMaterialId = "iridescence-textured-film-material";
export const iridescenceTextureId = "iridescence-factor-texture";
export const iridescenceSamplerId = "iridescence-factor-nearest";

export const iridescenceReadbackSamples = [
  { id: "base-highlight", x: 0.25, y: 0.5 },
  { id: "film-highlight", x: 0.625, y: 0.5 },
  { id: "texture-low", x: 0.38, y: 0.78 },
  { id: "texture-high", x: 0.66, y: 0.78 },
  { id: "background", x: 0.5, y: 0.12 },
];

export function registerIridescenceScene(aperture, registry) {
  const mesh = aperture.createMeshHandle(iridescenceMeshId);
  const textureMesh = aperture.createMeshHandle(iridescenceTextureMeshId);
  const baseMaterial = aperture.createMaterialHandle(baseMaterialId);
  const filmMaterial = aperture.createMaterialHandle(filmMaterialId);
  const texturedFilmMaterial = aperture.createMaterialHandle(
    texturedFilmMaterialId,
  );
  const iridescenceTexture = aperture.createTextureHandle(iridescenceTextureId);
  const iridescenceSampler = aperture.createSamplerHandle(iridescenceSamplerId);

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
  registry.register(textureMesh);
  registry.markReady(
    textureMesh,
    aperture.createPlaneMeshAsset({
      label: "IridescenceTexturePanel",
      width: 1.4,
      height: 0.36,
    }),
  );
  registry.register(iridescenceTexture);
  registry.markReady(
    iridescenceTexture,
    aperture.createTextureAsset({
      label: "IridescenceFactorTexture",
      dimension: "2d",
      width: 2,
      height: 1,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "iridescence",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255]),
        bytesPerRow: 8,
      },
    }),
  );
  registry.register(iridescenceSampler);
  registry.markReady(
    iridescenceSampler,
    aperture.createSamplerAsset({
      label: "IridescenceNearestSampler",
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
  registry.register(texturedFilmMaterial);
  registry.markReady(
    texturedFilmMaterial,
    aperture.createStandardMaterialAsset({
      label: "TextureMaskedSoapFilmIridescence",
      baseColorFactor: new Float32Array([0.045, 0.07, 0.105, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.18,
      iridescenceFactor: 1,
      iridescenceTexture: {
        texture: iridescenceTexture,
        sampler: iridescenceSampler,
      },
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 560,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    mesh,
    textureMesh,
    baseMaterial,
    filmMaterial,
    texturedFilmMaterial,
    iridescenceTexture,
    iridescenceSampler,
    meshKey: aperture.assetHandleKey(mesh),
    textureMeshKey: aperture.assetHandleKey(textureMesh),
    baseMaterialKey: aperture.assetHandleKey(baseMaterial),
    filmMaterialKey: aperture.assetHandleKey(filmMaterial),
    texturedFilmMaterialKey: aperture.assetHandleKey(texturedFilmMaterial),
    iridescenceTextureKey: aperture.assetHandleKey(iridescenceTexture),
    iridescenceSamplerKey: aperture.assetHandleKey(iridescenceSampler),
    samples: iridescenceReadbackSamples,
  };
}
