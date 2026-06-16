import {
  clamp,
  createSystem,
  type SystemParticleEffectAssetHandle,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { VehicleResource } from "../lib/vehicle-resource.js";

// Port of Particles.js (REFERENCE_SPEC section 6). Aperture now owns the
// textured billboard particle renderer and transient burst simulation; racing
// only authors wheel-smoke intent from game state.

const EMIT_THRESHOLD = 0.7;
const EMIT_PER_WHEEL = 3;
const Y_OFFSET = 0.05;
const POSITION_JITTER = {
  min: [-0.075, 0, -0.075],
  max: [0.075, 0.15, 0.075],
} as const;
const VELOCITY = {
  min: [-0.1, 0.5, -0.1],
  max: [0.1, 1.0, 0.1],
} as const;

export default class ParticlesSystem extends createSystem({ priority: 125 }) {
  #smoke: SystemParticleEffectAssetHandle | null = null;

  override init(): void {
    this.#smoke = this.particles.effect("smoke-effect");
  }

  override update(delta: number): void {
    if (this.#smoke === null || clampDt(delta) <= 0) {
      return;
    }

    const vehicle = this.resources.read(VehicleResource);
    if (!vehicle.ready || vehicle.driftIntensity <= EMIT_THRESHOLD) {
      return;
    }

    const groundY = vehicle.container[1] + Y_OFFSET;
    this.#emitFromWheel(vehicle.wheelBL, groundY);
    this.#emitFromWheel(vehicle.wheelBR, groundY);
  }

  #emitFromWheel(wheel: Vec3 | null, groundY: number): void {
    if (wheel === null || this.#smoke === null) {
      return;
    }

    this.particles.emit(this.#smoke, {
      count: EMIT_PER_WHEEL,
      position: [wheel[0], groundY, wheel[2]],
      positionJitter: POSITION_JITTER,
      velocity: VELOCITY,
      boundsRadius: 8,
    });
  }
}

function clampDt(delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return clamp(delta, 0, 1 / 30);
}
