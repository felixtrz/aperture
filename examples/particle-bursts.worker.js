import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { createSystem } from "@aperture-engine/app/systems";
import {
  particleBurstsConfig,
  particleBurstsEffectId,
  particleBurstsExpected,
} from "./particle-bursts.shared.js";

class ParticleBurstProofSystem extends createSystem({ priority: 0 }) {
  #effect = null;
  #emissions = 0;
  #nextEmissionTime = 0;

  init() {
    this.#effect = this.particles.effect(particleBurstsEffectId);
    this.spawn.camera({
      key: "camera.particle-bursts",
      name: "particle burst proof camera",
      transform: {
        translation: [0, 0.45, 5.25],
        lookAt: [0, 0.28, 0],
      },
      fovYDegrees: 48,
      near: 0.1,
      far: 50,
      camera: {
        frustumCulling: false,
      },
    });
  }

  update(_delta, time) {
    if (
      this.#effect === null ||
      !this.#effect.ready.value ||
      this.#emissions >= particleBurstsExpected.burstCount ||
      time + 1e-6 < this.#nextEmissionTime
    ) {
      return;
    }

    this.particles.emit(this.#effect, {
      count: 24,
      position: [0, 0.08, 0],
      positionJitter: {
        min: [-0.52, -0.08, -0.06],
        max: [0.52, 0.46, 0.06],
      },
      velocity: {
        min: [-0.18, 0.28, -0.05],
        max: [0.18, 0.92, 0.05],
      },
      seed: 0x5042_0000 + this.#emissions,
      boundsRadius: 2.8,
    });
    this.#emissions += 1;
    this.#nextEmissionTime = time + 1 / 12;
  }
}

startGeneratedSimulationWorker({
  config: particleBurstsConfig,
  systems: [{ default: ParticleBurstProofSystem }],
});
