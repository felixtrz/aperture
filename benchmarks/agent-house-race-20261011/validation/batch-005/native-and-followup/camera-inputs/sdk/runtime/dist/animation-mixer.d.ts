/**
 * Headless, ECS-free animation time driver. Owns playback state for one active
 * clip plus a single crossfade lane, and on each `update(delta)` produces pure
 * per-target blended TRS samples (plus blended morph-weight channels). It never
 * touches entities — the ECS driver system (M2-T8) consumes its output — so it
 * is reusable by both unit tests and the worker simulation thread.
 *
 * Extracted from the hand-rolled glb-viewer worker control loop
 * (updateActiveAnimation / applyAnimationAtTime / animationClipLocalTime /
 * wrapTime / startActiveAnimationCrossFade / updateAnimationCrossFadeWeights,
 * examples/glb-viewer.worker.js:5280-5491) with standard playback-action loop and
 * crossFade semantics (a weight that ramps linearly from the outgoing to the
 * incoming clip over the fade duration). Unlike the worker it uses an internal
 * time accumulator (no playbackOffset recompute) and adds a `pingpong` loop mode.
 */
import { type BlendedAnimationChannel } from "./animation-blending.js";
import { type AnimationClip } from "./animation-clip.js";
/** Loop behaviour for a playing clip. */
export type AnimationLoopMode = "once" | "repeat" | "pingpong";
/** Options for {@link AnimationMixer.play}. */
export interface AnimationPlayOptions {
    readonly loop?: AnimationLoopMode;
    /** Signed playback rate; negative plays backward. Defaults to 1. */
    readonly speed?: number;
    /** Initial local clip time in seconds. Defaults to 0. */
    readonly startTime?: number;
}
/** A blended morph-target weights channel for a target. */
export interface BlendedWeightChannel {
    readonly targetId: string;
    readonly path: "weights";
    readonly value: readonly number[];
    readonly weight: number;
}
/** Snapshot of the mixer's current playback state (JSON-safe). */
export interface AnimationMixerState {
    readonly activeClipId: string | null;
    readonly time: number;
    readonly speed: number;
    readonly loop: AnimationLoopMode;
    readonly paused: boolean;
    readonly clamped: boolean;
    readonly crossFading: boolean;
}
export declare class AnimationMixer {
    private readonly clips;
    private current;
    private previous;
    private crossFade;
    private paused;
    private lastWeightChannels;
    constructor(clips?: Iterable<readonly [string, AnimationClip]>);
    /** Register (or replace) a clip the mixer can play by id. */
    addClip(id: string, clip: AnimationClip): void;
    hasClip(id: string): boolean;
    /** Ids of all registered clips. */
    get clipIds(): readonly string[];
    /** Begin playing `clipId` from `startTime`, replacing any current playback. */
    play(clipId: string, options?: AnimationPlayOptions): void;
    /** Crossfade from the current clip to `clipId` over `durationSeconds`. */
    crossFadeTo(clipId: string, durationSeconds: number): void;
    pause(): void;
    resume(): void;
    /** Scrub the active clip to `time` seconds (clamped to the clip duration). */
    seek(time: number): void;
    get state(): AnimationMixerState;
    get activeClipId(): string | null;
    get time(): number;
    get clamped(): boolean;
    get isCrossFading(): boolean;
    /** Blended morph-target weight channels produced by the last `update()`. */
    get weightChannels(): readonly BlendedWeightChannel[];
    /**
     * Advance playback by `deltaSeconds` and return the blended per-target TRS
     * channels. Morph-weight channels are available via {@link weightChannels}.
     * When paused, time does not advance but the current pose is still returned.
     */
    update(deltaSeconds: number): BlendedAnimationChannel[];
    private makeLane;
    private advanceLane;
    private collectLane;
}
//# sourceMappingURL=animation-mixer.d.ts.map