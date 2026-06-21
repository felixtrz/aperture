import { asset, defineApertureConfig } from "/aperture/worker-modules/packages/app/dist/config.js";

export const particleBurstsTextureId = "particle-burst-checker";
export const particleBurstsEffectId = "particle-burst-effect";
export const particleBurstsExpected = {
  minEnqueuedBursts: 1,
  burstCount: 1000000,
  minLiveParticles: 1,
};
export const particleBurstsClearColor = [0.012, 0.014, 0.02, 1];

export const particleBurstsConfig = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  assets: {
    [particleBurstsTextureId]: asset.texture(
      "/aperture/examples/assets/aperture-alpha-blend-checker.png",
      {
        preload: "blocking",
        label: "Particle burst checker texture",
        colorSpace: "srgb",
        semantic: "base-color",
        mimeType: "image/png",
      },
    ),
    [particleBurstsEffectId]: asset.particleEffect({
      preload: "blocking",
      label: "Particle burst proof effect",
      texture: particleBurstsTextureId,
      capacity: 256,
      duration: 1.4,
      emissionRate: 0,
      lifetime: { min: 0.9, max: 1.25 },
      startSize: { min: 0.28, max: 0.62 },
      startColor: [1, 0.86, 0.32, 0.88],
      endColor: [0.54, 0.72, 1, 0],
      gravity: [0, -0.18, 0],
      blendMode: "alpha",
      sizeOverLifetime: [
        { t: 0, value: 0.8 },
        { t: 0.35, value: 1.35 },
        { t: 1, value: 0.18 },
      ],
      colorOverLifetime: [
        { t: 0, color: [1, 0.86, 0.32, 0.88] },
        { t: 0.45, color: [0.92, 0.38, 1, 0.58] },
        { t: 1, color: [0.32, 0.48, 1, 0] },
      ],
    }),
  },
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: particleBurstsClearColor,
  },
  diagnostics: {
    level: "info",
  },
});
