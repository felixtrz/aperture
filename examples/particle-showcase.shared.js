import { asset, defineApertureConfig } from "@aperture-engine/app/config";

const assetPath = (name) => `/examples/assets/kenney-particle-pack/${name}`;

export const particleShowcaseTextures = [
  {
    id: "vfx-fire-mask",
    label: "Kenney fire_01",
    url: assetPath("fire_01.png"),
  },
  {
    id: "vfx-smoke-mask",
    label: "Kenney smoke_09",
    url: assetPath("smoke_09.png"),
  },
  {
    id: "vfx-spark-mask",
    label: "Kenney spark_05",
    url: assetPath("spark_05.png"),
  },
  {
    id: "vfx-flare-mask",
    label: "Kenney flare_01",
    url: assetPath("flare_01.png"),
  },
];

export const particleShowcaseModels = [
  {
    id: "vfx-ground-road",
    label: "Kenney racing track straight",
    url: assetPath("track-straight.glb"),
  },
];

export const particleShowcaseEffects = [
  {
    id: "vfx-ember-plume",
    label: "Ember plume",
    texture: "vfx-fire-mask",
    capacity: 640,
    lifetime: { min: 1.1, max: 2.15 },
    startSize: { min: 0.34, max: 0.92 },
    startColor: [1, 0.38, 0.08, 0.88],
    endColor: [0.08, 0.04, 0.025, 0],
    gravity: [0, -0.04, 0],
    linearDamping: 0.16,
    blendMode: "additive",
    sizeOverLifetime: [
      { t: 0, value: 0.22 },
      { t: 0.22, value: 1.28 },
      { t: 0.72, value: 0.88 },
      { t: 1, value: 0.1 },
    ],
    colorOverLifetime: [
      { t: 0, color: [1, 0.34, 0.06, 0.9] },
      { t: 0.34, color: [1, 0.76, 0.18, 0.68] },
      { t: 0.66, color: [0.92, 0.28, 0.04, 0.36] },
      { t: 0.86, color: [0.36, 0.11, 0.035, 0.16] },
      { t: 1, color: [0.06, 0.035, 0.02, 0] },
    ],
  },
  {
    id: "vfx-smoke-veil",
    label: "Smoke veil",
    texture: "vfx-smoke-mask",
    capacity: 520,
    lifetime: { min: 1.2, max: 2.15 },
    startSize: { min: 0.62, max: 1.36 },
    startColor: [0.3, 0.32, 0.34, 0.3],
    endColor: [0.035, 0.04, 0.045, 0],
    gravity: [0, 0.08, 0],
    linearDamping: 0.54,
    blendMode: "alpha",
    sizeOverLifetime: [
      { t: 0, value: 0.42 },
      { t: 0.38, value: 1.24 },
      { t: 1, value: 1.7 },
    ],
    colorOverLifetime: [
      { t: 0, color: [0.38, 0.4, 0.42, 0.24] },
      { t: 0.52, color: [0.17, 0.18, 0.2, 0.2] },
      { t: 1, color: [0.035, 0.04, 0.045, 0] },
    ],
  },
  {
    id: "vfx-electric-fork",
    label: "Electric fork",
    texture: "vfx-spark-mask",
    capacity: 448,
    lifetime: { min: 0.14, max: 0.32 },
    startSize: { min: 0.32, max: 0.88 },
    startColor: [0.78, 0.95, 1, 0.92],
    endColor: [0.16, 0.42, 1, 0],
    gravity: [0, 0, 0],
    linearDamping: 0.05,
    blendMode: "additive",
    sizeOverLifetime: [
      { t: 0, value: 0.58 },
      { t: 0.16, value: 1.22 },
      { t: 0.48, value: 0.62 },
      { t: 1, value: 0.04 },
    ],
    colorOverLifetime: [
      { t: 0, color: [0.86, 0.98, 1, 0.96] },
      { t: 0.32, color: [0.35, 0.78, 1, 0.74] },
      { t: 1, color: [0.08, 0.22, 1, 0] },
    ],
  },
];

export const particleShowcaseExpected = {
  minReadyAssets:
    particleShowcaseTextures.length +
    particleShowcaseModels.length +
    particleShowcaseEffects.length,
  minEnqueuedBursts: 8,
  minLiveParticles: 120,
  minDrawCalls: 2,
};

export const particleShowcaseClearColor = [0.004, 0.006, 0.011, 1];

export const particleShowcaseConfig = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  assets: Object.fromEntries([
    ...particleShowcaseTextures.map((texture) => [
      texture.id,
      asset.texture(texture.url, {
        preload: "blocking",
        label: texture.label,
        colorSpace: "srgb",
        semantic: "base-color",
        mimeType: "image/png",
      }),
    ]),
    ...particleShowcaseModels.map((model) => [
      model.id,
      asset.gltf(model.url, {
        preload: "blocking",
        label: model.label,
      }),
    ]),
    ...particleShowcaseEffects.map((effect) => [
      effect.id,
      asset.particleEffect({
        preload: "blocking",
        label: effect.label,
        main: {
          maxParticles: effect.capacity,
          startLifetime: effect.lifetime,
          startSpeed: 0,
          startSize: effect.startSize,
          startRotation: { min: 0, max: Math.PI * 2 },
          startColor: effect.startColor,
          gravityModifier: 0,
        },
        emission: {
          rateOverTime: 0,
        },
        shape: {
          type: "point",
        },
        renderer: {
          texture: effect.texture,
          blendMode: effect.blendMode,
        },
        forceOverLifetime: {
          enabled: true,
          force: effect.gravity,
        },
        limitVelocityOverLifetime: {
          enabled: true,
          dampen: effect.linearDamping,
        },
        sizeOverLifetime: {
          enabled: true,
          size: {
            mode: "curve",
            curve: effect.sizeOverLifetime,
          },
        },
        colorOverLifetime: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: effect.colorOverLifetime,
          },
        },
      }),
    ]),
  ]),
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: particleShowcaseClearColor,
    tonemap: "aces",
    exposure: 1.08,
    bloom: {
      enabled: true,
      threshold: 0.55,
      intensity: 0.72,
      radius: 0.62,
    },
  },
  diagnostics: {
    level: "info",
  },
});
