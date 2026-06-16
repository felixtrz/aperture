import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import {
  createSystem,
  ParticleSimulationSpace,
} from "@aperture-engine/app/systems";
import type { Entity } from "@aperture-engine/simulation";

describe("app particle emitter spawning", () => {
  it("spawns renderer-independent particle emitters from config particle effects", async () => {
    const refs: { emitter: Entity | null } = { emitter: null };

    class ParticleSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.particles",
          transform: { translation: [0, 0, 6], lookAt: [0, 0, 0] },
          camera: { frustumCulling: false },
        });
        refs.emitter = this.spawn.particles({
          key: "smoke.emitter",
          effect: this.assets.particleEffect("smokeEffect"),
          capacity: 32,
          seed: 99,
          resetEpoch: 3,
          timeScale: 0.5,
          simulationSpace: ParticleSimulationSpace.Local,
          boundsCenter: [0, 1, 0],
          boundsRadius: 4,
          transform: { translation: [1, 2, 0] },
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          smokeEffect: asset.particleEffect({
            preload: "blocking",
            capacity: 64,
            emissionRate: 16,
            lifetime: { min: 1, max: 2 },
            startSize: { min: 0.5, max: 1 },
            blendMode: "alpha",
          }),
        },
      }),
      systems: [{ default: ParticleSetupSystem }],
    });

    const snapshot = app.extract(7);
    const packet = snapshot.particleEmitters?.[0];

    expect(refs.emitter).not.toBeNull();
    expect(snapshot.report.particleEmitters).toBe(1);
    expect(packet).toMatchObject({
      entity: {
        index: refs.emitter?.index,
        generation: refs.emitter?.generation,
      },
      effect: { kind: "particle-effect", id: "smokeEffect" },
      capacity: 32,
      seed: 99,
      resetEpoch: 3,
      timeScale: 0.5,
      simulationSpace: "local",
      layerMask: 1,
    });
    expect(packet?.effectVersion).toBeGreaterThan(0);
    expect(Array.from(snapshot.bounds[0]?.worldSphere.center ?? [])).toEqual([
      1, 3, 0,
    ]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("queues transient particle bursts from app systems", async () => {
    class ParticleBurstSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.particles",
          transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
          camera: { frustumCulling: false },
        });
      }

      override update(): void {
        this.particles.emit(this.particles.effect("smokeEffect"), {
          count: 3,
          position: [1, 2, 3],
          positionJitter: {
            min: [-0.1, 0, -0.1],
            max: [0.1, 0.2, 0.1],
          },
          velocity: {
            min: [-0.1, 0.5, -0.1],
            max: [0.1, 1, 0.1],
          },
          boundsRadius: 6,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          smokeEffect: asset.particleEffect({
            preload: "blocking",
            capacity: 64,
            emissionRate: 0,
            lifetime: { min: 1, max: 1 },
            startSize: { min: 0.5, max: 1 },
            blendMode: "alpha",
          }),
        },
      }),
      systems: [{ default: ParticleBurstSystem }],
    });

    const snapshot = app.stepAndExtract(1 / 60, 0, 12);
    const packet = snapshot.particleEmitters?.[0];

    expect(snapshot.report.particleEmitters).toBe(1);
    expect(packet).toMatchObject({
      effect: { kind: "particle-effect", id: "smokeEffect" },
      capacity: 3,
      mode: "burst",
      burst: {
        count: 3,
        position: [1, 2, 3],
        velocityMin: [-0.1, 0.5, -0.1],
        velocityMax: [0.1, 1, 0.1],
      },
    });
    expect(app.context.particles.summary().active).toBe(1);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("keeps sustained two-source burst emission below the default queue budget", async () => {
    class SustainedBurstSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.particles",
          transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
          camera: { frustumCulling: false },
        });
      }

      override update(): void {
        const effect = this.particles.effect("smokeEffect");
        this.particles.emit(effect, {
          count: 3,
          position: [-1, 0, 0],
          boundsRadius: 8,
        });
        this.particles.emit(effect, {
          count: 3,
          position: [1, 0, 0],
          boundsRadius: 8,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          smokeEffect: asset.particleEffect({
            preload: "blocking",
            capacity: 1280,
            emissionRate: 0,
            lifetime: { min: 2.5, max: 2.5 },
            startSize: { min: 0.5, max: 1 },
            blendMode: "alpha",
          }),
        },
      }),
      systems: [{ default: SustainedBurstSystem }],
    });

    let snapshot = app.extract(0);
    for (let frame = 1; frame <= 180; frame += 1) {
      snapshot = app.stepAndExtract(1 / 60, 0, frame);
      expect(snapshot.diagnostics).toEqual([]);
    }

    const summary = app.context.particles.summary();
    expect(summary.dropped).toBe(0);
    expect(summary.active).toBeGreaterThan(256);
    expect(snapshot.report.particleEmitters).toBeGreaterThan(256);
  });
});
