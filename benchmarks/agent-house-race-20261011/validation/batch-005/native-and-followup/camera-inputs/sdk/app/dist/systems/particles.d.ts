import { type ParticleBurstQueueSummary, type ParticleVec3RangeInput } from "@aperture-engine/render";
import type { EcsWorld, Vec3Like } from "@aperture-engine/simulation";
import type { SystemAssetAccess, SystemParticleEffectAssetHandle } from "./assets.js";
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
    emit(effect: ParticleEffectDescriptorInput, options: ParticleEmitOptions): boolean;
    summary(): ParticleBurstQueueSummary;
}
export declare function createParticleAccess(options: {
    readonly world: EcsWorld;
    readonly assets: SystemAssetAccess;
}): ParticleAccess;
//# sourceMappingURL=particles.d.ts.map