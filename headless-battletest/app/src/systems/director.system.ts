import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { Star } from "../components.ts";
import { DirectorState } from "../resources.ts";

const SPAWN_Y = 6.5;
const MAX_ACTIVE_STARS = 40;
const TAU = Math.PI * 2;

// Spawns falling stars on a deterministic cadence. Every value that varies
// between stars is drawn from context.random (this.random), so a fixed seed
// reproduces the exact star stream.
export default class DirectorSystem extends createSystem({
  priority: 10,
  queries: {
    stars: { required: [Star] },
  },
}) {
  override update(delta: number): void {
    const active = this.queries.stars.entities.size;
    const activeStars = this.signals.activeStars;
    if (activeStars !== undefined) {
      activeStars.value = active;
    }

    // Stop spawning once the game is over.
    if (this.signals.gameOver?.value === true) {
      return;
    }

    const director = this.resources.read(DirectorState);
    const countdown = director.spawnCountdown - delta;

    if (countdown > 0 || active >= MAX_ACTIVE_STARS) {
      this.resources.write(DirectorState, (state) => {
        state.spawnCountdown = countdown;
      });
      return;
    }

    // Time to spawn. Draw this star's traits deterministically.
    const id = director.nextStarId;
    const baseX = this.random.range(-4.2, 4.2);
    const fallSpeed = this.random.range(2, 4.5);
    const swayAmplitude = this.random.range(0, 0.8);
    const swayPhase = this.random.range(0, TAU);
    // Next interval: quicker as the level rises (difficulty ramp), floored so
    // it never becomes impossible. Stays deterministic (level derives from score).
    const level = Number(this.signals.level?.value ?? 1);
    const nextInterval = Math.max(
      0.12,
      this.random.range(0.3, 0.8) / (1 + (level - 1) * 0.18),
    );

    const hue = this.random.range(0.1, 0.9);
    const star = this.spawn.mesh({
      key: `star.${id}`,
      name: `Star ${id}`,
      tags: ["star", "collectible"],
      mesh: mesh.box({ size: [0.5, 0.5, 0.5] }),
      material: material.standard({
        baseColor: [0.9, hue, 0.2, 1],
        roughness: 0.3,
        emissiveFactor: [0.6, 0.5 * hue, 0.1],
      }),
      transform: { translation: [baseX, SPAWN_Y, 0] },
    });
    star.addComponent(Star, { fallSpeed, swayAmplitude, swayPhase, baseX });

    this.resources.write(DirectorState, (state) => {
      state.nextStarId = id + 1;
      state.spawnCountdown = nextInterval;
    });

    this.diagnostics.info("starfall.star.spawned", {
      id,
      baseX,
      fallSpeed,
    });
  }
}
