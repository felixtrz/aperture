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
});
