import { describe, expect, it } from "vitest";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  createApertureRandom,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

describe("createApertureRandom (PD.1)", () => {
  it("is deterministic for a given seed and stays in [0, 1)", () => {
    const a = createApertureRandom(7);
    const b = createApertureRandom(7);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("fork yields independent, label-stable sub-streams", () => {
    const enemiesA = createApertureRandom(1).fork("enemies");
    const enemiesB = createApertureRandom(1).fork("enemies");
    const loot = createApertureRandom(1).fork("loot");
    expect(enemiesA.next()).toBe(enemiesB.next());
    expect(createApertureRandom(1).fork("enemies").next()).not.toBe(loot.next());
  });
});

// A system that consumes the sanctioned context RNG + sim-time every frame, so
// its captured output is fully determined by the seed.
function wanderingCubeSystem(draws: number[]): ApertureSystemModule {
  return {
    default: class WanderingCube extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        this.spawn.mesh({
          key: "cube",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
      }
      override update(): void {
        draws.push(this.random.range(-1, 1) * this.time.delta);
      }
    },
  };
}

async function runSeeded(seed: number, frames: number): Promise<number[]> {
  const draws: number[] = [];
  const runner: ApertureHeadlessRunner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [wanderingCubeSystem(draws)],
    random: seed,
  });
  for (let frame = 0; frame < frames; frame += 1) {
    runner.step(1 / 60, frame / 60);
  }
  return draws;
}

describe("context.random + context.time replay (PD.1/PD.2/PD.3)", () => {
  it("advances context.time once per step", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [wanderingCubeSystem([])],
    });

    expect(runner.app.context.time.frame).toBe(0);
    runner.step(1 / 60, 1 / 60);
    runner.step(1 / 60, 2 / 60);
    expect(runner.app.context.time.frame).toBe(2);
    expect(runner.app.context.time.delta).toBeCloseTo(1 / 60, 6);
    expect(runner.app.context.time.elapsed).toBeCloseTo(2 / 60, 6);
  });

  it("replays bit-identically for the same seed and diverges for a different one", async () => {
    const a = await runSeeded(42, 30);
    const b = await runSeeded(42, 30);
    const c = await runSeeded(99, 30);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
