import { type AudioBackend, type WebAudioBackendOptions } from "./audio-backend.js";
import { type AudioBusId, type AudioMixer, type AudioMixerOptions } from "./mixer.js";
export type AudioSoundClipSource = string | {
    readonly url?: string;
    readonly bytes?: ArrayBuffer;
    readonly buffer?: AudioBuffer;
};
export interface AudioSoundBoardOptions {
    /** Inject a backend for tests or shared-context apps. */
    readonly backend?: AudioBackend;
    /** Options for the default Web Audio backend. Ignored when `backend` is set. */
    readonly web?: WebAudioBackendOptions;
    /** Inject a mixer for shared submix graphs. Defaults to `createAudioMixer`. */
    readonly mixer?: AudioMixer;
    /** Options for the default mixer. Ignored when `mixer` is set. */
    readonly mixerOptions?: AudioMixerOptions;
    /** Named clip sources. String values are treated as URLs. */
    readonly clips?: Readonly<Record<string, AudioSoundClipSource>>;
    /** Fetch seam for tests and non-window hosts. Defaults to global `fetch`. */
    readonly fetch?: (url: string) => Promise<Response>;
    /**
     * Close the backend on dispose. Defaults to true only when the board created
     * its own backend.
     */
    readonly closeBackendOnDispose?: boolean;
}
export interface AudioLoopVoiceOptions {
    readonly bus?: AudioBusId;
    readonly gain?: number;
    readonly playbackRate?: number;
    readonly lowpass?: boolean | {
        readonly frequency?: number;
        readonly q?: number;
    };
}
export interface AudioOneShotOptions {
    readonly bus?: AudioBusId;
    readonly gain?: number;
    readonly playbackRate?: number;
    readonly lowpassFrequency?: number;
}
export interface AudioLoopVoice {
    readonly clipId: string;
    readonly bus: AudioBusId;
    readonly stopped: boolean;
    setGain(value: number, rampSec?: number): void;
    setPlaybackRate(value: number, rampSec?: number): void;
    setLowpassFrequency(value: number, timeConstant?: number): void;
    stop(fadeSec?: number): void;
    dispose(): void;
}
export interface AudioSoundBoard {
    readonly backend: AudioBackend;
    readonly mixer: AudioMixer;
    readonly state: AudioContextState;
    setClip(id: string, source: AudioSoundClipSource): void;
    preload(id: string): Promise<AudioBuffer | null>;
    preloadAll(ids?: readonly string[]): Promise<void>;
    startLoop(clipId: string, options?: AudioLoopVoiceOptions): Promise<AudioLoopVoice | null>;
    playOneShot(clipId: string, options?: AudioOneShotOptions): Promise<boolean>;
    unlock(): Promise<void>;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    setMasterGain(value: number, rampSec?: number): void;
    setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
    dispose(): void;
}
export type CreateAudioSoundBoardResult = {
    readonly ok: true;
    readonly soundBoard: AudioSoundBoard;
} | {
    readonly ok: false;
    readonly reason: "audio-context-unavailable";
    readonly message: string;
};
export interface FirstAudioGestureTarget {
    addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListener, options?: boolean | EventListenerOptions): void;
}
export interface FirstAudioGestureStarter {
    readonly started: boolean;
    dispose(): void;
}
export declare function createAudioSoundBoard(options?: AudioSoundBoardOptions): CreateAudioSoundBoardResult;
export declare function createAudioSoundBoardOrThrow(options?: AudioSoundBoardOptions): AudioSoundBoard;
export declare function createFirstAudioGestureStarter(target: FirstAudioGestureTarget, start: () => void | Promise<void>): FirstAudioGestureStarter;
//# sourceMappingURL=sound-board.d.ts.map