import { EcsType, type EcsWorld, type Entity } from "@aperture-engine/simulation";
import { AnimationMixer, type AnimationPlayOptions } from "./animation-mixer.js";
import type { AnimationClip } from "./animation-clip.js";
/**
 * Engine ECS animation driver: per animated root it owns an {@link
 * AnimationMixer} and, each step, advances it by delta and writes the blended
 * per-target TRS samples into the bound joint/node `LocalTransform`s (and morph
 * weights into `MorphTargetWeights`). This replaces the hand-rolled glb-viewer
 * control loop (applyAnimationAtTime, examples/glb-viewer.worker.js:5311) with
 * an engine system.
 *
 * It is invoked imperatively from the runtime `step()` AFTER `world.update`
 * (user systems) and BEFORE `resolveWorldTransforms` + the joint-palette
 * compute (M2-T6), so the animated pose is same-frame.
 */
/** A clip the mixer can play, keyed by a stable id (e.g. its name). */
export interface AnimationClipBinding {
    readonly id: string;
    readonly clip: AnimationClip;
}
/** Per-entity driver state held on the {@link Animation} component. */
export interface AnimationDriverState {
    readonly mixer: AnimationMixer;
    /** Clip target id (entity key) -> live target entity. */
    readonly targets: ReadonlyMap<string, Entity>;
}
export declare const Animation: import("elics").Component<{
    state: {
        type: EcsType.Object;
        default: null;
    };
}>;
/** Build driver state from clip bindings + a target-key → entity map. */
export declare function createAnimationDriverState(input: {
    readonly clips: Iterable<AnimationClipBinding>;
    readonly targets: ReadonlyMap<string, Entity>;
}): AnimationDriverState;
/**
 * Public, engine-owned controls for an entity's animation. Delegates to the
 * entity's {@link AnimationMixer}; no hand-rolled sampling.
 */
export interface AnimationAccess {
    readonly clipIds: readonly string[];
    playClip(clipId: string, options?: AnimationPlayOptions): void;
    /** Crossfade from `fromClipId` to `toClipId` over `durationSeconds`. */
    crossFade(fromClipId: string, toClipId: string, durationSeconds: number): void;
    pause(): void;
    resume(): void;
    seek(time: number): void;
    readonly activeClipId: string | null;
    readonly time: number;
    readonly isCrossFading: boolean;
}
/** Engine-owned animation controls for `entity`; no-op when it has no driver. */
export declare function createAnimationAccess(entity: Entity): AnimationAccess;
/**
 * Advance every animation driver in `world` by `deltaSeconds`, writing blended
 * TRS samples into target `LocalTransform`s and morph weights into target
 * `MorphTargetWeights`. Returns the number of drivers advanced.
 */
export declare function updateAnimationDrivers(world: EcsWorld, deltaSeconds: number): number;
//# sourceMappingURL=animation-driver-system.d.ts.map