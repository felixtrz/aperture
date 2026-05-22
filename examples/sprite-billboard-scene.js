export const clearColor = [0.012, 0.018, 0.026, 1];

export const spriteTextureId = "sprite-billboard-quadrants";
export const spriteSamplerId = "sprite-billboard-nearest";

export const cameraStates = {
  front: {
    yaw: 0,
    elevation: 0,
    distance: 4,
    target: [0, 0, 0],
  },
  orbit: {
    yaw: 0.82,
    elevation: 0,
    distance: 4,
    target: [0, 0, 0],
  },
};

export const readbackSamples = [
  { id: "upper-left", x: 0.47, y: 0.44 },
  { id: "upper-right", x: 0.53, y: 0.44 },
  { id: "lower-left", x: 0.47, y: 0.56 },
  { id: "lower-right", x: 0.53, y: 0.56 },
];

export const expectedDominantChannels = {
  "upper-left": "red",
  "upper-right": "green",
  "lower-left": "blue",
  "lower-right": "red-green",
};

export function registerSpriteBillboardScene(aperture, registry) {
  const texture = aperture.createTextureHandle(spriteTextureId);
  const sampler = aperture.createSamplerHandle(spriteSamplerId);

  registry.register(texture);
  registry.markReady(
    texture,
    aperture.createTextureAsset({
      label: "SpriteBillboardQuadrants",
      dimension: "2d",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: createQuadrantTextureBytes(),
        bytesPerRow: 16,
        rowsPerImage: 4,
      },
    }),
  );
  registry.register(sampler);
  registry.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: "SpriteBillboardNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  );

  return {
    texture,
    sampler,
    textureKey: aperture.assetHandleKey(texture),
    samplerKey: aperture.assetHandleKey(sampler),
    samples: readbackSamples,
    expectedDominantChannels,
  };
}

function createQuadrantTextureBytes() {
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
