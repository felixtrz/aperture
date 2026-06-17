import { describe, expect, it } from "vitest";
import {
  assetHandleKey,
  createParticleEffectHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createExtractionApp,
  withCamera,
  withParticleEmitter,
  withTransform,
} from "@aperture-engine/runtime";
import {
  ParticleSimulationSpace,
  analyzeParticleEffectRuntimeFeatures,
  createParticleEffectAsset,
  packParticleEffectCurves,
  validateParticleEffectAsset,
  type ParticleEffectAssetInput,
} from "@aperture-engine/render";

describe("particle effect assets and emitter extraction (M6-T7)", () => {
  it("validates and packs scalar curves plus color gradients", () => {
    const asset = createParticleEffectAsset({
      capacity: 128,
      emissionRate: 12,
      lifetime: { min: 0.5, max: 2 },
      startSize: { min: 0.1, max: 0.5 },
      sizeOverLifetime: [
        { t: 0, value: 0 },
        { t: 0.5, value: 2 },
        { t: 1, value: 0 },
      ],
      colorOverLifetime: [
        { t: 0, color: [1, 0, 0, 1] },
        { t: 1, color: [0, 0, 1, 0] },
      ],
      curveSampleCount: 5,
    });

    expect(validateParticleEffectAsset(asset)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(Array.from(asset.curves.sizeOverLifetime)).toEqual([0, 1, 2, 1, 0]);
    expect(Array.from(asset.curves.colorOverLifetime.slice(0, 4))).toEqual([
      1, 0, 0, 1,
    ]);

    const packed = packParticleEffectCurves({
      sizeOverLifetime: asset.sizeOverLifetime,
      colorOverLifetime: asset.colorOverLifetime,
      sampleCount: 3,
    });

    expect(packed.sampleCount).toBe(3);
    expect(Array.from(packed.sizeOverLifetime)).toEqual([0, 2, 0]);

    const invalid = createParticleEffectAsset({
      capacity: 0,
      lifetime: { min: 2, max: 1 },
      colorOverLifetime: [],
    });

    expect(validateParticleEffectAsset(invalid).valid).toBe(false);
    expect(
      validateParticleEffectAsset(invalid).diagnostics.map((d) => d.code),
    ).toContain("particleEffect.invalidCapacity");
  });

  it("reports V1 runtime support for every accepted particle effect field", () => {
    const acceptedFields = [
      "label",
      "capacity",
      "duration",
      "looping",
      "prewarm",
      "emissionRate",
      "bursts",
      "lifetime",
      "startSpeed",
      "startSize",
      "startColor",
      "endColor",
      "gravity",
      "blendMode",
      "texture",
      "sampler",
      "atlasFrameCount",
      "sizeOverLifetime",
      "colorOverLifetime",
      "curveSampleCount",
    ] satisfies readonly (keyof ParticleEffectAssetInput)[];
    const report = analyzeParticleEffectRuntimeFeatures({
      label: "Truthful particle schema",
      capacity: 128,
      duration: 2,
      looping: true,
      prewarm: true,
      emissionRate: 12,
      bursts: [{ time: 0.2, count: 5 }],
      lifetime: { min: 0.5, max: 1.5 },
      startSpeed: { min: 0.2, max: 1 },
      startSize: { min: 0.1, max: 0.5 },
      startColor: [1, 0, 0, 1],
      endColor: [0, 0, 1, 0],
      gravity: [0, -1, 0],
      blendMode: "alpha",
      texture: createTextureHandle("texture-placeholder"),
      sampler: createSamplerHandle("sampler-placeholder"),
      atlasFrameCount: 4,
      sizeOverLifetime: [
        { t: 0, value: 1 },
        { t: 1, value: 0 },
      ],
      colorOverLifetime: [
        { t: 0, color: [1, 1, 1, 1] },
        { t: 1, color: [1, 1, 1, 0] },
      ],
      curveSampleCount: 8,
    });
    const coveredFields = new Set([
      ...report.supportedFields,
      ...report.partiallySupportedFields,
      ...report.unsupportedFields,
    ]);

    expect(acceptedFields.every((field) => coveredFields.has(field))).toBe(
      true,
    );
    expect(report.supportedFields).toEqual([
      "blendMode",
      "capacity",
      "colorOverLifetime",
      "curveSampleCount",
      "endColor",
      "label",
      "sampler",
      "sizeOverLifetime",
      "startColor",
      "startSize",
      "texture",
    ]);
    expect(report.partiallySupportedFields).toEqual([
      "gravity",
      "lifetime",
      "startSpeed",
    ]);
    expect(report.unsupportedFields).toEqual([
      "atlasFrameCount",
      "bursts",
      "duration",
      "emissionRate",
      "looping",
      "prewarm",
    ]);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "particleEffect.unsupportedFeature",
          field: "emissionRate",
          unsupportedModes: ["burst", "continuous"],
        }),
        expect.objectContaining({
          code: "particleEffect.unsupportedFeature",
          field: "bursts",
          message: expect.stringContaining("this.particles.emit"),
        }),
        expect.objectContaining({
          code: "particleEffect.partiallySupportedFeature",
          field: "gravity",
          supportedModes: ["burst"],
          unsupportedModes: ["continuous"],
        }),
        expect.objectContaining({
          code: "particleEffect.partiallySupportedFeature",
          field: "lifetime",
          supportedModes: ["burst"],
          unsupportedModes: ["continuous"],
        }),
      ]),
    );

    expect(
      createParticleEffectAsset({
        emissionRate: 0,
        lifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
        blendMode: "alpha",
      }).runtimeFeatures.unsupportedFields,
    ).toEqual(["emissionRate"]);
  });

  it("extracts stable emitter packets keyed by effect version without live particles", () => {
    const app = createExtractionApp();
    const effect = createParticleEffectHandle("spark");
    const asset = createParticleEffectAsset({
      capacity: 64,
      emissionRate: 16,
      startSpeed: { min: 1, max: 3 },
      startSize: { min: 0.1, max: 0.3 },
    });

    app.assets.register(effect);
    app.assets.markReady(effect, asset);
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({
        near: 0.1,
        far: 100,
        layerMask: 1,
        frustumCulling: false,
      }),
    );
    const emitter = app.spawn(
      withTransform({ translation: [1, 2, 0] }),
      withParticleEmitter({
        effect,
        capacity: 32,
        seed: 99,
        resetEpoch: 3,
        timeScale: 0.5,
        simulationSpace: ParticleSimulationSpace.Local,
        boundsCenter: [0, 1, 0],
        boundsRadius: 2,
      }),
    );

    const snapshot = app.extract(7);
    const packet = snapshot.particleEmitters?.[0];

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(packet).toMatchObject({
      entity: { index: emitter.index, generation: emitter.generation },
      effect,
      effectVersion: 1,
      capacity: 32,
      seed: 99,
      resetEpoch: 3,
      timeScale: 0.5,
      simulationSpace: "local",
      layerMask: 1,
    });
    expect(packet?.worldTransformOffset).toBeGreaterThanOrEqual(0);
    expect(packet?.boundsIndex).toBe(0);
    expect(Array.from(snapshot.bounds[0]?.worldSphere.center ?? [])).toEqual([
      1, 3, 0,
    ]);
    expect(JSON.stringify(snapshot)).toContain(assetHandleKey(effect));
    expect("particles" in snapshot).toBe(false);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
