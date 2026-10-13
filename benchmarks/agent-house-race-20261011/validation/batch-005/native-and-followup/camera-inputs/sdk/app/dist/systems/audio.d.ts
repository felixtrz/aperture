import { AudioSimulationSpace, type AudioDistanceModel, type AudioPanningModel } from "@aperture-engine/render";
import type { AudioClipHandle, EcsWorld, Entity, Vec3Like } from "@aperture-engine/simulation";
import type { SystemAssetAccess, SystemAudioAssetHandle } from "./assets.js";
import type { SystemTransformInput } from "./spawn/types.js";
export type AudioClipDescriptorInput = AudioClipHandle | SystemAudioAssetHandle;
export interface AudioLowpassOptions {
    /** Cutoff frequency in Hz. Omit for an open filter. */
    readonly frequency?: number;
    /** Resonance/Q. Defaults to the engine's click-free lowpass Q. */
    readonly q?: number;
}
export interface AudioAutomationTarget {
    /** Target value for a click-free frame-to-frame automation update. */
    readonly target: number;
}
export type AudioAutomationNumber = number | AudioAutomationTarget;
export interface AudioLowpassAutomationOptions {
    /** Target cutoff frequency in Hz. */
    readonly frequency?: AudioAutomationNumber;
    /** Target resonance/Q. */
    readonly q?: AudioAutomationNumber;
}
export interface AudioLoopAutomationOptions {
    /** Target gain. The voice manager moves to this value click-free. */
    readonly gain?: AudioAutomationNumber;
    /** Target playback rate multiplier. */
    readonly timeScale?: AudioAutomationNumber;
    /** Mute/unmute via gain-to-zero while keeping loop playback phase alive. */
    readonly muted?: boolean;
    /** Target lowpass filter values, or false to open the authored lowpass. */
    readonly lowpass?: AudioLowpassAutomationOptions | false;
    /** Target lowpass cutoff in Hz. */
    readonly lowpassFrequency?: AudioAutomationNumber;
    /** Target lowpass resonance/Q. */
    readonly lowpassQ?: AudioAutomationNumber;
}
export interface AudioEmitterControlOptions {
    readonly busId?: string;
    readonly gain?: number;
    readonly timeScale?: number;
    readonly muted?: boolean;
    readonly priority?: number;
    readonly seed?: number;
    readonly offsetSec?: number;
    readonly loopStart?: number;
    readonly loopEnd?: number;
    readonly simulationSpace?: AudioSimulationSpace;
    readonly panningModel?: AudioPanningModel;
    readonly distanceModel?: AudioDistanceModel;
    readonly refDistance?: number;
    readonly maxDistance?: number;
    readonly rolloffFactor?: number;
    readonly coneInnerAngle?: number;
    readonly coneOuterAngle?: number;
    readonly coneOuterGain?: number;
    readonly boundsCenter?: Vec3Like;
    readonly audibilityRadius?: number;
    readonly occlusion?: number;
    readonly lowpass?: AudioLowpassOptions | false;
    readonly lowpassFrequency?: number;
    readonly lowpassQ?: number;
    readonly transform?: SystemTransformInput;
}
export interface AudioLoopOptions extends AudioEmitterControlOptions {
    readonly clip: AudioClipDescriptorInput;
    readonly active?: boolean;
}
export interface AudioLoopUpdateOptions extends AudioEmitterControlOptions {
    readonly clip?: AudioClipDescriptorInput;
    readonly active?: boolean;
}
export interface AudioOneShotOptions extends AudioEmitterControlOptions {
    readonly clip: AudioClipDescriptorInput;
}
export interface AudioLoopHandle {
    readonly id: string;
    readonly entity: Entity;
    set(options: AudioLoopUpdateOptions): AudioLoopHandle;
    automate(options: AudioLoopAutomationOptions): AudioLoopHandle;
    /** Silence the loop without tearing down its stable emitter. */
    pause(): AudioLoopHandle;
    /** Make a paused loop audible again. */
    resume(): AudioLoopHandle;
    play(): number;
    stop(): number;
}
export interface AudioAccess {
    /** Resolve a config-authored audio clip by id. */
    clip(id: string): SystemAudioAssetHandle;
    /** Upsert a stable looping emitter owned by ECS. */
    loop(id: string, options: AudioLoopOptions): AudioLoopHandle;
    /** Patch a loop emitter if it exists. Returns null when the id is unknown. */
    set(id: string, options: AudioLoopUpdateOptions): AudioLoopHandle | null;
    /** Patch common loop automation targets if the loop exists. */
    automate(id: string, options: AudioLoopAutomationOptions): AudioLoopHandle | null;
    /**
     * Silence a stable loop while preserving its emitter and loop phase. Returns
     * false when the id is unknown.
     */
    pause(id: string): boolean;
    /** Resume a previously paused stable loop. Returns false when unknown. */
    resume(id: string): boolean;
    /** Request a click-free stop of a stable loop. */
    stop(id: string): boolean;
    /** Fire a stable one-shot emitter by bumping its play epoch. */
    playOneShot(id: string, options: AudioOneShotOptions): Entity;
}
export declare function createAudioAccess(options: {
    readonly world: EcsWorld;
    readonly assets: SystemAssetAccess;
}): AudioAccess;
//# sourceMappingURL=audio.d.ts.map