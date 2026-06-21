export const clearColor = [0.012, 0.016, 0.024, 1];

export const skyboxTextureId = "skybox-demo-cube";
export const skyboxSamplerId = "skybox-demo-linear";
export const cubeMeshId = "skybox-demo-cube-mesh";
export const cubeMaterialId = "skybox-demo-cube-material";

export const readbackSamples = [
  { id: "sky-upper-left", x: 0.12, y: 0.12 },
  { id: "sky-upper-right", x: 0.88, y: 0.12 },
  { id: "sky-lower-left", x: 0.12, y: 0.88 },
  { id: "cube-center", x: 0.5, y: 0.5 },
];

export function registerSkyboxScene(aperture, registry) {
  const skyboxTexture = aperture.createTextureHandle(skyboxTextureId);
  const skyboxSampler = aperture.createSamplerHandle(skyboxSamplerId);
  const cubeMesh = aperture.createMeshHandle(cubeMeshId);
  const cubeMaterial = aperture.createMaterialHandle(cubeMaterialId);

  registry.register(skyboxTexture);
  registry.markReady(
    skyboxTexture,
    aperture.createTextureAsset({
      label: "SkyboxDemoCubeTexture",
      dimension: "cube",
      width: 4,
      height: 4,
      depthOrLayers: 6,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createSkyboxTextureBytes(),
        bytesPerRow: 16,
        rowsPerImage: 4,
      },
    }),
  );
  registry.register(skyboxSampler);
  registry.markReady(
    skyboxSampler,
    aperture.createSamplerAsset({
      label: "SkyboxDemoLinearSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMaxClamp: 0,
    }),
  );
  registry.register(cubeMesh);
  registry.markReady(
    cubeMesh,
    aperture.createBoxMeshAsset({ label: "SkyboxDemoOccluder" }),
  );
  registry.register(cubeMaterial);
  registry.markReady(
    cubeMaterial,
    aperture.createUnlitMaterialAsset({
      label: "SkyboxDemoOccluderMaterial",
      baseColorFactor: [1, 0.22, 0.06, 1],
    }),
  );

  return {
    skyboxTexture,
    skyboxSampler,
    cubeMesh,
    cubeMaterial,
    textureKey: aperture.assetHandleKey(skyboxTexture),
    samplerKey: aperture.assetHandleKey(skyboxSampler),
    cubeMeshKey: aperture.assetHandleKey(cubeMesh),
    cubeMaterialKey: aperture.assetHandleKey(cubeMaterial),
    samples: readbackSamples,
  };
}

function createSkyboxTextureBytes() {
  return new Uint8Array(
    [
      faceBytes([76, 180, 238, 255]),
      faceBytes([48, 148, 220, 255]),
      faceBytes([114, 214, 250, 255]),
      faceBytes([30, 88, 162, 255]),
      faceBytes([92, 170, 230, 255]),
      faceBytes([72, 196, 238, 255]),
    ].flat(),
  );
}

function faceBytes(color) {
  const values = [];

  for (let pixel = 0; pixel < 16; pixel += 1) {
    values.push(...color);
  }

  return values;
}
