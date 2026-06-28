import { describe, expect, it } from "vitest";
import {
  assetHandleKey,
  createMeshHandle,
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
  createParticleCompositeEffectAsset,
  createRenderAssetCollections,
  createParticleEffectAsset,
  createParticleEmitterEffectAsset,
  packParticleEffectCurves,
  particleEffectDependencies,
  validateParticleEffectAsset,
  validateParticleEffectInput,
  type ParticleEmitterEffectAssetInput,
} from "@aperture-engine/render";

describe("particle effect assets and emitter extraction (M6-T7)", () => {
  it("validates and packs scalar curves plus color gradients", () => {
    const asset = createParticleEmitterEffectAsset({
      version: 2,
      main: {
        maxParticles: 128,
        startLifetime: { min: 0.5, max: 2 },
        startSize: { min: 0.1, max: 0.5 },
      },
      emission: {
        rateOverTime: 12,
      },
      sizeOverLifetime: {
        enabled: true,
        size: {
          mode: "curve",
          curve: [
            { t: 0, value: 0 },
            { t: 0.5, value: 2 },
            { t: 1, value: 0 },
          ],
        },
      },
      colorOverLifetime: {
        enabled: true,
        color: {
          mode: "gradient",
          gradient: [
            { t: 0, color: [1, 0, 0, 1] },
            { t: 1, color: [0, 0, 1, 0] },
          ],
        },
      },
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
      sizeOverLifetime: asset.runtime.sizeOverLifetime,
      colorOverLifetime: asset.runtime.colorOverLifetime,
      sampleCount: 3,
    });

    expect(packed.sampleCount).toBe(3);
    expect(Array.from(packed.sizeOverLifetime)).toEqual([0, 2, 0]);

    const invalid = createParticleEffectAsset({
      version: 2,
      main: {
        maxParticles: 0,
        startLifetime: { min: 2, max: 1 },
      },
      limitVelocityOverLifetime: {
        enabled: true,
        dampen: -1,
      },
      colorOverLifetime: {
        enabled: true,
        color: {
          mode: "gradient",
          gradient: [],
        },
      },
    });

    expect(validateParticleEffectAsset(invalid).valid).toBe(false);
    expect(
      validateParticleEffectAsset(invalid).diagnostics.map((d) => d.code),
    ).toContain("particleEffect.invalidCapacity");
    expect(
      validateParticleEffectAsset(invalid).diagnostics.map((d) => d.code),
    ).toContain("particleEffect.invalidLinearDamping");
  });

  it("reports v2 runtime support for every canonical particle module", () => {
    const acceptedFields = [
      "version",
      "label",
      "main",
      "emission",
      "shape",
      "renderer",
      "textureSheetAnimation",
      "colorOverLifetime",
      "sizeOverLifetime",
      "rotationOverLifetime",
      "velocityOverLifetime",
      "forceOverLifetime",
      "limitVelocityOverLifetime",
      "noise",
      "speedOverLifetime",
      "colorBySpeed",
      "sizeBySpeed",
      "rotationBySpeed",
      "orbitalVelocityOverLifetime",
      "trails",
      "collision",
      "subEmitters",
      "source",
      "curveSampleCount",
    ] satisfies readonly (keyof ParticleEmitterEffectAssetInput)[];
    const report = analyzeParticleEffectRuntimeFeatures({
      version: 2,
      label: "Truthful particle schema",
      main: {
        maxParticles: 128,
        duration: 2,
        loop: true,
        prewarm: true,
        startLifetime: { min: 0.5, max: 1.5 },
        startSpeed: { min: 0.2, max: 1 },
        startSize: { min: 0.1, max: 0.5 },
        startColor: [1, 0, 0, 1],
      },
      emission: {
        rateOverTime: 12,
        bursts: [{ time: 0.2, count: 5 }],
      },
      shape: {
        type: "cone",
        radius: 0.5,
      },
      renderer: {
        renderMode: "stretched-billboard",
        blendMode: "alpha",
        texture: createTextureHandle("texture-placeholder"),
        sampler: createSamplerHandle("sampler-placeholder"),
        softParticles: true,
      },
      textureSheetAnimation: {
        enabled: true,
        tiles: [2, 2],
      },
      sizeOverLifetime: {
        enabled: true,
        size: {
          mode: "curve",
          curve: [
            { t: 0, value: 1 },
            { t: 1, value: 0 },
          ],
        },
      },
      colorOverLifetime: {
        enabled: true,
        color: {
          mode: "gradient",
          gradient: [
            { t: 0, color: [1, 1, 1, 1] },
            { t: 1, color: [1, 1, 1, 0] },
          ],
        },
      },
      rotationOverLifetime: {
        enabled: true,
        angularVelocity: 1,
      },
      velocityOverLifetime: {
        enabled: true,
        velocity: [0, 1, 0],
      },
      forceOverLifetime: {
        enabled: true,
        force: [0, -1, 0],
      },
      limitVelocityOverLifetime: {
        enabled: true,
        dampen: 0.5,
      },
      noise: {
        enabled: true,
        strength: 0.25,
      },
      speedOverLifetime: {
        enabled: true,
        speed: 0.5,
      },
      colorBySpeed: {
        enabled: true,
        color: [1, 0.5, 0.25, 1],
        speedRange: { min: 0, max: 10 },
      },
      sizeBySpeed: {
        enabled: true,
        size: 0.5,
        speedRange: { min: 0, max: 10 },
      },
      rotationBySpeed: {
        enabled: true,
        angularVelocity: 1,
        speedRange: { min: 0, max: 10 },
      },
      orbitalVelocityOverLifetime: {
        enabled: true,
        orbital: [0, 1, 0],
      },
      trails: {
        enabled: true,
        lifetime: 0.5,
      },
      collision: {
        enabled: true,
        mode: "world",
      },
      subEmitters: [
        {
          type: "birth",
          effect: "spark-child",
        },
      ],
      source: {
        format: "shuriken",
        version: "2022.3",
        sourceName: "Truthful particle schema",
        unsupportedFeatures: ["lights"],
      },
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
      "collision",
      "colorBySpeed",
      "colorOverLifetime",
      "curveSampleCount",
      "emission",
      "forceOverLifetime",
      "label",
      "limitVelocityOverLifetime",
      "main",
      "noise",
      "orbitalVelocityOverLifetime",
      "renderer",
      "rotationBySpeed",
      "rotationOverLifetime",
      "shape",
      "sizeBySpeed",
      "sizeOverLifetime",
      "source",
      "speedOverLifetime",
      "subEmitters",
      "textureSheetAnimation",
      "trails",
      "velocityOverLifetime",
      "version",
    ]);
    expect(report.partiallySupportedFields).toEqual([
      "collision",
      "colorBySpeed",
      "noise",
      "orbitalVelocityOverLifetime",
      "renderer.softParticles",
      "rotationBySpeed",
      "sizeBySpeed",
      "speedOverLifetime",
      "trails",
    ]);
    expect(report.unsupportedFields).toEqual(["subEmitters"]);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "particleEffect.unsupportedFeature",
          field: "subEmitters",
          unsupportedModes: ["burst", "continuous"],
        }),
        expect.objectContaining({
          code: "particleEffect.partiallySupportedFeature",
          field: "speedOverLifetime",
          supportedModes: ["continuous"],
          unsupportedModes: ["burst"],
        }),
      ]),
    );

    const legacyReport = analyzeParticleEffectRuntimeFeatures({
      capacity: 128,
    } as unknown as ParticleEmitterEffectAssetInput);
    expect(legacyReport.unsupportedFields).toEqual(["capacity"]);
    expect(legacyReport.diagnostics[0]).toMatchObject({
      code: "particleEffect.unsupportedFeature",
      field: "capacity",
      message: expect.stringContaining("Legacy particle field"),
    });
    expect(
      validateParticleEffectInput({
        version: 2,
        capacity: 128,
      }).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "particleEffect.legacyField",
        field: "capacity",
      }),
    ]);
  });

  it("preserves source metadata while allowing valid partial imports", () => {
    const asset = createParticleEmitterEffectAsset({
      version: 2,
      label: "ConvertedQuarksSmoke",
      main: {
        maxParticles: 64,
        startLifetime: 1,
        startSpeed: 0,
      },
      emission: {
        rateOverTime: 8,
      },
      shape: {
        type: "sphere",
        radius: 0.25,
      },
      renderer: {
        blendMode: "alpha",
      },
      trails: {
        enabled: true,
        lifetime: 0.5,
      },
      source: {
        format: "three.quarks",
        version: "0.14",
        sourceName: "SmokeTrail.json",
        unsupportedFeatures: ["TrailRenderer.widthOverTrail"],
      },
    });

    expect(validateParticleEffectAsset(asset).valid).toBe(true);
    expect(asset.source).toEqual({
      format: "three.quarks",
      version: "0.14",
      sourceName: "SmokeTrail.json",
      unsupportedFeatures: ["TrailRenderer.widthOverTrail"],
    });
    expect(asset.runtimeFeatures.partiallySupportedFields).toContain("trails");
    expect(asset.runtimeFeatures.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "particleEffect.partiallySupportedFeature",
          field: "trails",
        }),
      ]),
    );
  });

  it("tracks mesh-surface source meshes as particle effect dependencies", () => {
    const mesh = createMeshHandle("emitter-surface");
    const texture = createTextureHandle("smoke");
    const asset = createParticleEffectAsset({
      version: 2,
      shape: {
        type: "mesh-surface",
        mesh,
        box: [1, 1, 1],
      },
      renderer: {
        texture,
      },
    });

    expect(particleEffectDependencies(asset).map(assetHandleKey)).toEqual([
      "texture:smoke",
      "mesh:emitter-surface",
    ]);
  });

  it("normalizes composite VFX assets with child emitter transforms and dependencies", () => {
    const smoke = createParticleEffectHandle("smoke");
    const sparks = createParticleEffectHandle("sparks");
    const composite = createParticleCompositeEffectAsset({
      version: 2,
      type: "composite",
      label: "ExplosionComposite",
      emitters: [
        {
          label: "Smoke",
          effect: smoke,
          delay: 0.05,
          duration: 1.5,
          transform: {
            translation: [0, 0.5, 0],
          },
        },
        {
          label: "Sparks",
          effect: sparks,
          delay: 0,
          timeScale: 2,
          transform: {
            rotation: [0, 0, 0, 1],
            scale: [0.5, 0.5, 0.5],
          },
        },
        {
          label: "Smoke echo",
          effect: smoke,
          delay: 0.2,
        },
      ],
      source: {
        format: "three.quarks",
        sourceName: "explosion.json",
        unsupportedFeatures: ["SubEmitter.inheritColor"],
      },
    });
    const collections = createRenderAssetCollections();
    const handle = collections.particleEffects.add(composite, {
      id: "explosion",
    });
    const entry = collections.registry.get(handle);

    expect(composite).toMatchObject({
      kind: "particle-effect",
      type: "composite",
      version: 2,
      label: "ExplosionComposite",
      source: {
        format: "three.quarks",
        sourceName: "explosion.json",
      },
    });
    expect(composite.emitters.map((emitter) => emitter.label)).toEqual([
      "Smoke",
      "Sparks",
      "Smoke echo",
    ]);
    expect(composite.emitters[0]?.transform).toEqual({
      translation: [0, 0.5, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
    expect(composite.emitters[1]?.duration).toBeNull();
    expect(composite.emitters[1]?.timeScale).toBe(2);
    expect(composite.dependencies).toEqual([smoke, sparks]);
    expect(entry?.dependencies).toEqual([smoke, sparks]);
  });

  it("extracts stable emitter packets keyed by effect version without live particles", () => {
    const app = createExtractionApp();
    const effect = createParticleEffectHandle("spark");
    const asset = createParticleEffectAsset({
      version: 2,
      main: {
        maxParticles: 64,
        startSpeed: { min: 1, max: 3 },
        startSize: { min: 0.1, max: 0.3 },
      },
      emission: {
        rateOverTime: 16,
      },
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

  it("derives continuous emitter bounds from effect data when no radius is authored", () => {
    const app = createExtractionApp();
    const effect = createParticleEffectHandle("auto-bounds");
    const asset = createParticleEffectAsset({
      version: 2,
      main: {
        maxParticles: 64,
        startLifetime: { min: 2, max: 2 },
        startSpeed: { min: 2, max: 3 },
        startSize: { min: 0.5, max: 1 },
      },
      forceOverLifetime: {
        enabled: true,
        force: [0, -1, 0],
      },
      sizeOverLifetime: {
        enabled: true,
        size: {
          mode: "curve",
          curve: [
            { t: 0, value: 1 },
            { t: 1, value: 2 },
          ],
        },
      },
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
    app.spawn(
      withTransform({ translation: [1, 2, 0] }),
      withParticleEmitter({
        effect,
        capacity: 32,
      }),
    );

    const snapshot = app.extract(1);
    const bounds = snapshot.bounds[0];
    const expectedRadius = 3 + 0.18 + Math.SQRT2;

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(Array.from(bounds?.worldSphere.center ?? [])).toEqual([1, 2, 0]);
    expect(bounds?.worldSphere.radius).toBeCloseTo(expectedRadius, 5);
    expect(bounds?.localAabb.min[0]).toBeCloseTo(-expectedRadius, 5);
    expect(bounds?.localAabb.min[1]).toBeCloseTo(-expectedRadius, 5);
    expect(bounds?.localAabb.min[2]).toBeCloseTo(-expectedRadius, 5);
    expect(bounds?.localAabb.max[0]).toBeCloseTo(expectedRadius, 5);
    expect(bounds?.localAabb.max[1]).toBeCloseTo(expectedRadius, 5);
    expect(bounds?.localAabb.max[2]).toBeCloseTo(expectedRadius, 5);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("retains off-screen continuous particle emitters to preserve GPU state", () => {
    const app = createExtractionApp();
    const effect = createParticleEffectHandle("culled-auto-bounds");

    app.assets.register(effect);
    app.assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        main: {
          maxParticles: 16,
          startLifetime: { min: 1, max: 1 },
          startSize: { min: 0.25, max: 0.25 },
        },
      }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withCamera({
        fovYRadians: Math.PI / 2,
        near: 0.1,
        far: 100,
        layerMask: 1,
        frustumCulling: true,
      }),
    );
    app.spawn(
      withTransform({ translation: [1000, 0, -5] }),
      withParticleEmitter({ effect, capacity: 16 }),
    );

    const snapshot = app.extract(1);

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(snapshot.bounds).toHaveLength(1);
    expect(snapshot.particleEmitters?.[0]?.effect).toEqual(effect);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
