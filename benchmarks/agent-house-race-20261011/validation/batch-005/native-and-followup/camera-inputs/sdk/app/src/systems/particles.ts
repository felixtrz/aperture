import {
  getOrCreateParticleBurstQueue,
  type ParticleBurstQueueSummary,
  type ParticleBurstRequest,
  type ParticleVec3RangeInput,
} from "@aperture-engine/render";
import type {
  EcsWorld,
  ParticleEffectHandle,
  Vec3Like,
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
