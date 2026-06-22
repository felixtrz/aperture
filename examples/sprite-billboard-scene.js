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
    elevation: 0.3,
    distance: 4,
    target: [0, 0, 0],
  },
};

export const readbackSamples = [
  { id: "upper-left", x: 0.47, y: 0.44 },
  { id: "upper-right", x: 0.53, y: 0.44 },
  { id: "lower-left", x: 0.47, y: 0.56 },
  { id: "lower-right", x: 0.53, y: 0.56 },
  { id: "uv-blue-center", x: 0.31, y: 0.27 },
  { id: "rotation-pivot-green", x: 0.74, y: 0.26 },
  { id: "screen-size-yellow", x: 0.5, y: 0.78 },
  { id: "screen-size-clear", x: 0.5, y: 0.87 },
  { id: "cylindrical-red", x: 0.28, y: 0.74 },
];

export const expectedDominantChannels = {
  "upper-left": "red",
  "upper-right": "green",
  "lower-left": "blue",
  "lower-right": "red-green",
  "uv-blue-center": "blue",
  "rotation-pivot-green": "green",
  "screen-size-yellow": "red-green",
  "cylindrical-red": "red",
};

export const spriteProofs = [
  {
    id: "atlas-full",
    translation: [0, 0, 0],
    size: [1.15, 1.15],
    uvRect: [0, 0, 1, 1],
    pivot: [0.5, 0.5],
    rotation: 0,
    billboardMode: "spherical",
    sizeMode: "world-units",
  },
  {
    id: "uv-blue",
    translation: [-1.55, 1.05, 0],
    size: [0.65, 0.65],
    uvRect: [0, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    rotation: 0,
    billboardMode: "spherical",
    sizeMode: "world-units",
  },
  {
    id: "rotation-pivot",
    translation: [1.6, 1.02, 0],
    size: [0.78, 0.78],
    uvRect: [0.5, 0, 0.5, 0.5],
    pivot: [0.15, 0.85],
    rotation: Math.PI / 4,
    billboardMode: "none",
    sizeMode: "world-units",
  },
  {
    id: "screen-size",
    translation: [0, -1.28, 0],
    size: [72, 42],
    uvRect: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    rotation: 0,
    billboardMode: "spherical",
    sizeMode: "screen-pixels",
  },
  {
    id: "cylindrical",
    translation: [-1.7, -1.05, 0],
    size: [0.62, 0.62],
    uvRect: [0, 0, 0.5, 0.5],
    pivot: [0.5, 0.5],
    rotation: 0,
    billboardMode: "cylindrical",
    sizeMode: "world-units",
  },
];

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
