import { type AssetRegistry, type EcsWorld, type ParticleEffectHandle, type Vec3Like } from "@aperture-engine/simulation";
import type { RenderDiagnostic } from "./snapshot.js";
export interface ParticleVec3Range {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
}
export interface ParticleVec3RangeInput {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
}
export interface ParticleBurstRequest {
    readonly effect: ParticleEffectHandle;
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
export interface ActiveParticleBurst {
    readonly seq: number;
    readonly request: ParticleBurstRequest;
    readonly effect: ParticleEffectHandle;
    readonly effectVersion: number;
    readonly startFrame: number;
    readonly startTime: number;
    readonly ttlSeconds: number;
}
export interface ParticleBurstQueueOptions {
    readonly maxActive?: number;
    readonly maxPerFrame?: number;
}
export interface ParticleBurstQueueSummary {
    readonly maxActive: number;
    readonly maxPerFrame: number;
    readonly pending: number;
    readonly active: number;
    readonly enqueued: number;
    readonly promoted: number;
    readonly dropped: number;
    readonly rejectedNotReady: number;
    readonly rejectedInvalid: number;
}
export interface ParticleBurstQueue {
    enqueue(request: ParticleBurstRequest): boolean;
    drain(input: {
        readonly frame: number;
        readonly time: number;
        readonly assets: AssetRegistry;
        readonly diagnostics: RenderDiagnostic[];
    }): readonly ActiveParticleBurst[];
    summary(): ParticleBurstQueueSummary;
}
export declare function createParticleBurstQueue(options?: ParticleBurstQueueOptions): ParticleBurstQueue;
export declare function installParticleBurstQueue(world: EcsWorld, queue?: ParticleBurstQueue): ParticleBurstQueue;
export declare function getParticleBurstQueue(world: EcsWorld): ParticleBurstQueue | null;
export declare function getOrCreateParticleBurstQueue(world: EcsWorld): ParticleBurstQueue;
export declare function particleBurstPositionRange(request: ParticleBurstRequest): ParticleVec3Range;
export declare function particleBurstVelocityRange(request: ParticleBurstRequest): ParticleVec3Range;
//# sourceMappingURL=particle-burst-queue.d.ts.map