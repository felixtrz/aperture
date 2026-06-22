export const gpuParticlesEffectId = "gpu-particles-sparks";
export const gpuParticlesClearColor = [0.01, 0.014, 0.026, 1];
export const gpuParticlesCapacity = 384;

export const gpuParticlesReadbackSamples = [
  { id: "center-emitter", x: 0.5, y: 0.5 },
  { id: "upper-spark", x: 0.46, y: 0.39 },
  { id: "right-spark", x: 0.58, y: 0.52 },
  { id: "background", x: 0.88, y: 0.14 },
];

export function registerGpuParticlesScene(aperture, registry) {
  const effect = aperture.createParticleEffectHandle(gpuParticlesEffectId);
  const asset = aperture.createParticleEffectAsset({
    label: "GpuParticlesSparks",
    capacity: gpuParticlesCapacity,
    duration: 3,
    looping: true,
    emissionRate: 160,
    lifetime: { min: 0.8, max: 1.8 },
    startSpeed: { min: 0.35, max: 1.55 },
    startSize: { min: 0.055, max: 0.34 },
    startColor: [1, 0.34, 0.08, 0.92],
    endColor: [0.08, 0.72, 1, 0.56],
    gravity: [0, -0.1, 0],
    sizeOverLifetime: [
      { t: 0, value: 0.8 },
      { t: 0.2, value: 1.5 },
      { t: 1, value: 0.2 },
    ],
    colorOverLifetime: [
      { t: 0, color: [1, 0.34, 0.08, 0.92] },
      { t: 0.55, color: [0.18, 0.92, 1, 0.76] },
      { t: 1, color: [0.08, 0.18, 1, 0] },
    ],
    curveSampleCount: 16,
  });

  registry.register(effect);
  registry.markReady(effect, asset);

  return {
    effect,
    effectKey: aperture.assetHandleKey(effect),
    curves: particleCurveStatus(asset),
    expected: {
      particleEmitters: 1,
      liveParticles: gpuParticlesCapacity,
      dispatches: 1,
      drawCalls: 1,
    },
    samples: gpuParticlesReadbackSamples,
  };
}

function particleCurveStatus(asset) {
  const midpoint = Math.floor(asset.curves.sampleCount / 2);
  const last = asset.curves.sampleCount - 1;

  return {
    sampleCount: asset.curves.sampleCount,
    size: {
      first: asset.curves.sizeOverLifetime[0],
      middle: asset.curves.sizeOverLifetime[midpoint],
      last: asset.curves.sizeOverLifetime[last],
    },
    color: {
      first: colorSample(asset, 0),
      middle: colorSample(asset, midpoint),
      last: colorSample(asset, last),
    },
  };
}

function colorSample(asset, index) {
  const offset = index * 4;

  return Array.from(asset.curves.colorOverLifetime.slice(offset, offset + 4));
}
