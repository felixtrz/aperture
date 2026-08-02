import {
  getOrCreateParticleBurstQueue,
  type ParticleBurstBudget,
  type ParticleBurstQueueSummary,
  type ParticleBurstRequest,
  type ParticleVec3RangeInput,
} from "@aperture-engine/render";
import type {
  EcsWorld,
  ParticleEffectHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  SystemAssetAccess,
  SystemParticleEffectAssetHandle,
} from "./assets.js";
import type { ParticleEffectDescriptorInput } from "./spawn/types.js";

export interface ParticleEmitOptions {
  readonly count: number;
  readonly position: Vec3Like;
  readonly positionJitter?: ParticleVec3RangeInput;
  readonly velocity?: ParticleVec3RangeInput;
  readonly seed?: number;
  readonly timeScale?: number;
  readonly layerMask?: number;
  readonly boundsCenter?: Vec3Like;
  readonly boundsRadius?: number;
  /**
   * Uniform multiplier applied to each particle's authored start size.
   *
   * Useful when one recipe represents a family of differently sized bursts
   * (for example, a normal projectile and a heavy projectile). Omitted uses
   * the authored size unchanged.
   */
  readonly sizeScale?: number;
  /** Multiplier applied to the effect's authored launch speed. */
  readonly speedScale?: number;
  /** Multiplier applied to the effect's authored particle lifetime. */
  readonly lifetimeScale?: number;
  /**
   * Per-burst RGBA tint, multiplied over the effect's authored colour.
   *
   * Lets one authored recipe serve a family that differs only in hue — a
   * weapon-tier colour ramp, say — instead of duplicating the effect per
   * variant. Omitted leaves the authored colour untouched.
   */
  readonly color?: Vec4Like;
  /** World-space emitter rotation applied at particle birth. */
  readonly rotation?: Vec4Like;
  /** Hard admission ceiling shared by requests with the same budget key. */
  readonly budget?: ParticleBurstBudget;
}

export interface ParticleAccess {
  /** Resolve a config-authored particle effect by id. */
  effect(id: string): SystemParticleEffectAssetHandle;
  /**
   * Queue a one-frame burst intent. Extraction keeps the transient burst alive
   * until its effect lifetime expires; render owns the live particle buffers.
   */
  emit(
    effect: ParticleEffectDescriptorInput,
    options: ParticleEmitOptions,
  ): boolean;
  /** Mutably scale all active transient bursts; zero freezes them in place. */
  setTimeScale(timeScale: number): void;
  /** Mutably translate all transient bursts through one shared world root. */
  setOrigin(origin: Vec3Like): void;
  summary(): ParticleBurstQueueSummary;
}

export function createParticleAccess(options: {
  readonly world: EcsWorld;
  readonly assets: SystemAssetAccess;
}): ParticleAccess {
  const queue = getOrCreateParticleBurstQueue(options.world);

  return {
    effect(id) {
      return options.assets.particleEffect(id);
    },
    emit(effect, emitOptions) {
      return queue.enqueue({
        ...emitOptions,
        effect: resolveParticleEffectHandle(effect),
      } satisfies ParticleBurstRequest);
    },
    setTimeScale(timeScale) {
      queue.setTimeScale(timeScale);
    },
    setOrigin(origin) {
      queue.setOrigin(origin);
    },
    summary() {
      return queue.summary();
    },
  };
}

function resolveParticleEffectHandle(
  input: ParticleEffectDescriptorInput,
): ParticleEffectHandle {
  if (typeof input === "object" && input !== null && "renderHandle" in input) {
    return (input as SystemParticleEffectAssetHandle).renderHandle;
  }

  return input as ParticleEffectHandle;
}
