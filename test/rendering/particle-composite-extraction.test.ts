import { describe, expect, it } from "vitest";
import { createParticleEffectHandle } from "@aperture-engine/simulation";
import {
  createExtractionApp,
  withCamera,
  withParticleEmitter,
  withTransform,
} from "@aperture-engine/runtime";
import {
  ParticleSimulationSpace,
  createParticleEffectAsset,
  isParticleCompositeEffectAsset,
  isParticleEmitterEffectAsset,
  particleEffectDependencies,
  validateParticleEffectAsset,
  validateParticleEffectInput,
  type ParticleEmitterEffectAsset,
} from "@aperture-engine/render";

function leafEffect(): ParticleEmitterEffectAsset {
  const asset = createParticleEffectAsset({
    version: 2,
    main: { maxParticles: 48, startLifetime: { min: 1, max: 1 } },
    emission: { rateOverTime: 8 },
  });

  if (!isParticleEmitterEffectAsset(asset)) {
    throw new Error("expected a leaf emitter effect");
  }

  return asset;
}

function spawnCamera(app: ReturnType<typeof createExtractionApp>): void {
  app.spawn(
    withTransform({ translation: [0, 0, 10] }),
    withCamera({ near: 0.1, far: 100, layerMask: 1, frustumCulling: false }),
  );
}

describe("particle composite effect composition", () => {
  it("dispatches createParticleEffectAsset to emitter and composite forms", () => {
    const emitter = createParticleEffectAsset({ version: 2 });
    const composite = createParticleEffectAsset({
      version: 2,
      type: "composite",
      emitters: [{ effect: createParticleEffectHandle("smoke") }],
    });

    expect(emitter.kind).toBe("particle-effect");
    expect(emitter.type).toBe("emitter");
    expect(isParticleEmitterEffectAsset(emitter)).toBe(true);

    expect(composite.kind).toBe("particle-effect");
    expect(composite.type).toBe("composite");
    expect(isParticleCompositeEffectAsset(composite)).toBe(true);
  });

  it("detects a composite from an emitters array without an explicit type", () => {
    const composite = createParticleEffectAsset({
      emitters: [{ effect: createParticleEffectHandle("smoke") }],
    } as never);

    expect(composite.type).toBe("composite");
  });

  it("classifies a stray non-array emitters field as a leaf consistently", () => {
    const input = { version: 2, emitters: null, main: { maxParticles: 8 } };

    // Factory and validator must agree: this is a leaf, not a composite.
    expect(createParticleEffectAsset(input as never).type).toBe("emitter");
    expect(validateParticleEffectInput(input).valid).toBe(true);
  });

  it("rejects a non-positive child timeScale in both create and validate", () => {
    const input = {
      version: 2 as const,
      type: "composite" as const,
      emitters: [{ effect: createParticleEffectHandle("smoke"), timeScale: 0 }],
    };

    expect(validateParticleEffectInput(input).valid).toBe(false);
    // The factory must not silently clamp to a value its own validator rejects.
    expect(
      validateParticleEffectAsset(createParticleEffectAsset(input)).valid,
    ).toBe(false);
  });

  it("tracks every distinct child effect as a composite dependency", () => {
    const smoke = createParticleEffectHandle("smoke");
    const sparks = createParticleEffectHandle("sparks");
    const composite = createParticleEffectAsset({
      version: 2,
      type: "composite",
      emitters: [
        { effect: smoke },
        { effect: sparks },
        { effect: smoke, delay: 0.2 },
      ],
    });

    expect(particleEffectDependencies(composite)).toEqual([smoke, sparks]);
  });

  it("rejects mixing composite emitters with Shuriken leaf modules", () => {
    const report = validateParticleEffectInput({
      version: 2,
      type: "composite",
      emitters: [{ effect: createParticleEffectHandle("smoke") }],
      main: { maxParticles: 8 },
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "particleEffect.compositeMixedModules",
    );
  });

  it("rejects a composite without emitters and reports invalid children", () => {
    expect(
      validateParticleEffectInput({ version: 2, type: "composite" }).valid,
    ).toBe(false);

    const childReport = validateParticleEffectInput({
      version: 2,
      type: "composite",
      emitters: [{ effect: 7, timeScale: -1 }],
    });

    expect(childReport.valid).toBe(false);
    expect(childReport.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining([
        "particleEffect.invalidCompositeChildEffect",
        "particleEffect.invalidCompositeEmitter",
      ]),
    );
  });

  it("expands a composite into one leaf packet per child with composed transforms", () => {
    const app = createExtractionApp();
    const smoke = createParticleEffectHandle("smoke");
    const sparks = createParticleEffectHandle("sparks");
    const explosion = createParticleEffectHandle("explosion");

    app.assets.register(smoke);
    app.assets.markReady(smoke, leafEffect());
    app.assets.register(sparks);
    app.assets.markReady(sparks, leafEffect());
    app.assets.register(explosion);
    app.assets.markReady(
      explosion,
      createParticleEffectAsset({
        version: 2,
        type: "composite",
        emitters: [
          {
            label: "Smoke",
            effect: smoke,
            transform: { translation: [0, 0.5, 0] },
          },
          { label: "Sparks", effect: sparks, timeScale: 2 },
        ],
      }),
    );

    spawnCamera(app);
    app.spawn(
      withTransform({ translation: [1, 2, 0] }),
      withParticleEmitter({
        effect: explosion,
        seed: 10,
        timeScale: 0.5,
        simulationSpace: ParticleSimulationSpace.World,
      }),
    );

    const snapshot = app.extract(3);
    const packets = snapshot.particleEmitters ?? [];
    // Packets participate in transparent sorting, so look children up by id.
    const byEffect = new Map(
      packets.map((packet) => [packet.effect.id, packet]),
    );
    const smokePacket = byEffect.get("smoke");
    const sparksPacket = byEffect.get("sparks");

    expect(snapshot.report.particleEmitters).toBe(2);
    expect(snapshot.diagnostics).toEqual([]);
    // Each expanded child points at a concrete leaf effect, never the composite.
    expect(new Set(packets.map((packet) => packet.effect.id))).toEqual(
      new Set(["smoke", "sparks"]),
    );

    const smokeOffset = smokePacket?.worldTransformOffset ?? 0;
    const sparksOffset = sparksPacket?.worldTransformOffset ?? 0;
    // Smoke child local +0.5 on Y composes onto the parent world translation.
    expect(
      Array.from(snapshot.transforms.slice(smokeOffset + 12, smokeOffset + 15)),
    ).toEqual([1, 2.5, 0]);
    expect(
      Array.from(
        snapshot.transforms.slice(sparksOffset + 12, sparksOffset + 15),
      ),
    ).toEqual([1, 2, 0]);

    // Child time scale multiplies the parent emitter time scale.
    expect(smokePacket?.timeScale).toBeCloseTo(0.5, 6);
    expect(sparksPacket?.timeScale).toBeCloseTo(1, 6);
  });

  it("carries child delay and duration onto expanded leaf packets", () => {
    const app = createExtractionApp();
    const smoke = createParticleEffectHandle("smoke");
    const sparks = createParticleEffectHandle("sparks");
    const explosion = createParticleEffectHandle("explosion");

    app.assets.register(smoke);
    app.assets.markReady(smoke, leafEffect());
    app.assets.register(sparks);
    app.assets.markReady(sparks, leafEffect());
    app.assets.register(explosion);
    app.assets.markReady(
      explosion,
      createParticleEffectAsset({
        version: 2,
        type: "composite",
        emitters: [
          { effect: smoke, delay: 0.25, duration: 1.5 },
          { effect: sparks },
        ],
      }),
    );

    spawnCamera(app);
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withParticleEmitter({ effect: explosion }),
    );

    const packets = app.extract(1).particleEmitters ?? [];
    const byEffect = new Map(
      packets.map((packet) => [packet.effect.id, packet]),
    );

    expect(byEffect.get("smoke")?.delay).toBeCloseTo(0.25, 6);
    expect(byEffect.get("smoke")?.duration).toBeCloseTo(1.5, 6);
    // A child with no authored timing leaves the packet fields unset.
    expect(byEffect.get("sparks")?.delay).toBeUndefined();
    expect(byEffect.get("sparks")?.duration).toBeUndefined();
  });

  it("derives stable, distinct child emitter ids across frames", () => {
    const app = createExtractionApp();
    const smoke = createParticleEffectHandle("smoke");
    const sparks = createParticleEffectHandle("sparks");
    const explosion = createParticleEffectHandle("explosion");

    app.assets.register(smoke);
    app.assets.markReady(smoke, leafEffect());
    app.assets.register(sparks);
    app.assets.markReady(sparks, leafEffect());
    app.assets.register(explosion);
    app.assets.markReady(
      explosion,
      createParticleEffectAsset({
        version: 2,
        type: "composite",
        emitters: [{ effect: smoke }, { effect: sparks }],
      }),
    );

    spawnCamera(app);
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withParticleEmitter({ effect: explosion }),
    );

    const first = app.extract(1).particleEmitters ?? [];
    const second = app.extract(2).particleEmitters ?? [];
    const firstIds = first.map((packet) => packet.emitterId);

    expect(firstIds).toHaveLength(2);
    expect(new Set(firstIds).size).toBe(2);
    expect(second.map((packet) => packet.emitterId)).toEqual(firstIds);
  });

  it("rejects nested composites but keeps extracting valid children", () => {
    const app = createExtractionApp();
    const smoke = createParticleEffectHandle("smoke");
    const innerComposite = createParticleEffectHandle("inner");
    const explosion = createParticleEffectHandle("explosion");

    app.assets.register(smoke);
    app.assets.markReady(smoke, leafEffect());
    app.assets.register(innerComposite);
    app.assets.markReady(
      innerComposite,
      createParticleEffectAsset({
        version: 2,
        type: "composite",
        emitters: [{ effect: smoke }],
      }),
    );
    app.assets.register(explosion);
    app.assets.markReady(
      explosion,
      createParticleEffectAsset({
        version: 2,
        type: "composite",
        emitters: [{ effect: innerComposite }, { effect: smoke }],
      }),
    );

    spawnCamera(app);
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withParticleEmitter({ effect: explosion }),
    );

    const snapshot = app.extract(1);

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(snapshot.particleEmitters?.[0]?.effect).toEqual(smoke);
    expect(
      snapshot.diagnostics.some((diagnostic) =>
        diagnostic.code.includes("nestedComposite"),
      ),
    ).toBe(true);
  });
});
