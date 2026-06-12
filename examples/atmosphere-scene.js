export const clearColor = [0.014, 0.018, 0.026, 1];

export const fogColor = [0.46, 0.62, 0.82, 1];
export const skyboxTextureId = "atmosphere-skybox-cube";
export const skyboxSamplerId = "atmosphere-skybox-linear";
export const spriteTextureId = "atmosphere-marker-quadrants";
export const spriteSamplerId = "atmosphere-marker-nearest";
export const markerMeshId = "atmosphere-marker-cube-mesh";
export const markerMaterialId = "atmosphere-marker-standard-material";

export const atmosphereReadbackSamples = [
  { id: "sky-upper-left", x: 0.12, y: 0.12 },
  { id: "sky-upper-right", x: 0.88, y: 0.12 },
  { id: "sprite-upper-left", x: 0.45, y: 0.24 },
  { id: "sprite-upper-right", x: 0.55, y: 0.24 },
  { id: "sprite-lower-left", x: 0.45, y: 0.34 },
  { id: "sprite-lower-right", x: 0.55, y: 0.34 },
  { id: "near-cube", x: 0.24, y: 0.66 },
  { id: "far-cube", x: 0.76, y: 0.66 },
];

export function registerAtmosphereScene(aperture, registry) {
  const skyboxTexture = aperture.createTextureHandle(skyboxTextureId);
  const skyboxSampler = aperture.createSamplerHandle(skyboxSamplerId);
  const spriteTexture = aperture.createTextureHandle(spriteTextureId);
  const spriteSampler = aperture.createSamplerHandle(spriteSamplerId);
  const markerMesh = aperture.createMeshHandle(markerMeshId);
  const markerMaterial = aperture.createMaterialHandle(markerMaterialId);

  registry.register(skyboxTexture);
  registry.markReady(
    skyboxTexture,
    aperture.createTextureAsset({
      label: "AtmosphereSkyboxCubeTexture",
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
      label: "AtmosphereSkyboxLinearSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMaxClamp: 0,
    }),
  );
  registry.register(spriteTexture);
  registry.markReady(
    spriteTexture,
    aperture.createTextureAsset({
      label: "AtmosphereMarkerQuadrants",
      dimension: "2d",
      width: 4,
      height: 4,
      // sRGB so the authored display-intent bytes round-trip through the
      // AI-17 output stage: decode on sample, encode on output. With "data"
      // the sprite encode brightens the raw bytes and washes the markers out.
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createSpriteTextureBytes(),
        bytesPerRow: 16,
        rowsPerImage: 4,
      },
    }),
  );
  registry.register(spriteSampler);
  registry.markReady(
    spriteSampler,
    aperture.createSamplerAsset({
      label: "AtmosphereMarkerNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  );
  registry.register(markerMesh);
  registry.markReady(
    markerMesh,
    aperture.createBoxMeshAsset({
      label: "AtmosphereMarkerCube",
      width: 0.68,
      height: 0.68,
      depth: 0.68,
    }),
  );
  registry.register(markerMaterial);
  registry.markReady(
    markerMaterial,
    aperture.createStandardMaterialAsset({
      label: "AtmosphereMarkerStandardMaterial",
      baseColorFactor: new Float32Array([0.96, 0.24, 0.06, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.72,
      renderState: { cullMode: "none" },
    }),
  );

  return {
    skyboxTexture,
    skyboxSampler,
    spriteTexture,
    spriteSampler,
    markerMesh,
    markerMaterial,
    skyboxTextureKey: aperture.assetHandleKey(skyboxTexture),
    skyboxSamplerKey: aperture.assetHandleKey(skyboxSampler),
    spriteTextureKey: aperture.assetHandleKey(spriteTexture),
    spriteSamplerKey: aperture.assetHandleKey(spriteSampler),
    markerMeshKey: aperture.assetHandleKey(markerMesh),
    markerMaterialKey: aperture.assetHandleKey(markerMaterial),
    fogColor,
    samples: atmosphereReadbackSamples,
  };
}

export function atmosphereFogSettings() {
  return {
    mode: "linear",
    color: fogColor,
    start: 7,
    end: 16,
  };
}

function createSkyboxTextureBytes() {
  return new Uint8Array(
    [
      faceBytes([70, 178, 236, 255]),
      faceBytes([46, 144, 220, 255]),
      faceBytes([126, 220, 250, 255]),
      faceBytes([26, 82, 154, 255]),
      faceBytes([86, 168, 230, 255]),
      faceBytes([68, 198, 238, 255]),
    ].flat(),
  );
}

function createSpriteTextureBytes() {
  const red = [235, 35, 45, 255];
  const green = [35, 220, 80, 255];
  const blue = [45, 105, 245, 255];
  const yellow = [245, 220, 45, 255];
  const rows = [
    [red, red, green, green],
    [red, red, green, green],
    [blue, blue, yellow, yellow],
    [blue, blue, yellow, yellow],
  ];

  return new Uint8Array(rows.flat(2));
}

function faceBytes(color) {
  const values = [];

  for (let pixel = 0; pixel < 16; pixel += 1) {
    values.push(...color);
  }

  return values;
}
