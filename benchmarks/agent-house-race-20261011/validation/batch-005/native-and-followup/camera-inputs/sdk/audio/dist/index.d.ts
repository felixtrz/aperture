import type { RenderSnapshot } from "@aperture-engine/render";
import { type AudioBackend, type WebAudioBackendOptions } from "./audio-backend.js";
import { type AudioAnalyserTarget, type AudioBusId, type AudioMixer, type AudioMixerOptions } from "./mixer.js";
import { type ClipCache, type ClipResolver } from "./clip-cache.js";
import { type VoiceManagerOptions } from "./voice-manager.js";
export * from "./audio-backend.js";
export * from "./mixer.js";
export * from "./clip-cache.js";
export * from "./voice-manager.js";
export * from "./audio-settings.js";
export * from "./sound-board.js";
export interface AudioEngineOptions {
    /** Inject a backend (e.g. the test fake). Defaults to a real Web Audio backend. */
    readonly backend?: AudioBackend;
    /** Options for the default Web Audio backend (ignored when `backend` is set). */
    readonly web?: WebAudioBackendOptions;
    readonly mixer?: AudioMixerOptions;
    readonly voice?: VoiceManagerOptions;
    /**
     * Resolve a clip id (`assetHandleKey`, e.g. `"audio-clip:boom"`) to its
     * encoded bytes + metadata, from the main-thread mirror of the source asset
     * registry. Without it, no audio decodes (the engine still mixes silently).
     */
    readonly resolveClip?: ClipResolver;
    /**
     * Scripted sidechain ducking: while any real voice plays on `trigger`, the
     * `targets` buses are ducked to `depth`. Set `false` to disable. Default:
     * dialogue on `voice` ducks `music` + `ambient` to 0.3.
     */
    readonly duck?: false | {
        readonly trigger?: AudioBusId;
        readonly targets?: readonly AudioBusId[];
        readonly depth?: number;
        readonly rampSec?: number;
    };
    /** Buses silenced by `setPaused(true)` (game pause). Default sfx/voice/ambient. */
    readonly pausedBuses?: readonly AudioBusId[];
}
/** Emitted when a voice's source starts or ends; drives caption/a11y UIs. */
export interface AudioClipEvent {
    readonly type: "start" | "end";
    readonly clipId: string;
    readonly captionTrackId?: string;
}
/** Queryable engine state for HUDs / the diagnostics-summary convention. */
export interface AudioDiagnostics {
    readonly state: AudioContextState;
    readonly activeVoices: number;
    readonly virtualVoices: number;
    readonly activeSources: number;
    readonly activePanners: number;
    readonly decodeCount: number;
    readonly outputLatency: number;
    readonly baseLatency: number;
}
/**
 * The main-thread audio engine: the derived view that realizes simulation
 * intent as sound. Owns the {@link AudioBackend}, the submix {@link AudioMixer},
 * the decode-once {@link ClipCache}, the {@link VoiceManager}, and the context
 * lifecycle. `applySnapshot` reconciles the live voice graph each frame.
 */
export interface AudioEngine {
    readonly backend: AudioBackend;
    readonly mixer: AudioMixer;
    readonly clips: ClipCache;
    readonly state: AudioContextState;
    /** Resume a context the autoplay policy left suspended (call on first gesture). */
    unlock(): Promise<void>;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    /**
     * Reconcile the voice graph against a frame's audio intent. `frameDelta` is
     * the measured main-thread frame interval (seconds); it is clamped to a safe
     * ramp window internally.
     */
    applySnapshot(snapshot: RenderSnapshot, frameDelta: number): void;
    setMasterGain(value: number, rampSec?: number): void;
    setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
    analyser(target: AudioAnalyserTarget): AnalyserNode;
    /** Live logical voices (diagnostics). */
    readonly activeVoiceCount: number;
    /** Live source nodes across all voices (diagnostics). */
    readonly activeSourceCount: number;
    /** Live PannerNodes (spatial voices) — diagnostics / budget. */
    readonly activePannerCount: number;
    /** Demoted node-less voices retaining a playhead (virtualization). */
    readonly virtualVoiceCount: number;
    /**
     * Game pause (distinct from tab-hidden `suspend()`): silences the paused
     * buses (sfx/voice/ambient by default) while music/ui keep playing. Playheads
     * keep advancing (gain-to-zero), so loops resume in phase on unpause.
     */
    setPaused(paused: boolean): void;
    /** Latency compensation: shift scheduled `start()` times by `seconds`. */
    setAudioOffset(seconds: number): void;
    /** Collapse the master output to mono (accessibility), or restore stereo. */
    setMonoDownmix(mono: boolean): void;
    /**
     * Upgrade the master limiter to an AudioWorklet brickwall. Resolves true when
     * inserted; false when the worklet/SAB isolation is unavailable (the master
     * `DynamicsCompressor` limiter stays in place — the degraded path).
     */
    enableWorkletLimiter(): Promise<boolean>;
    /** Subscribe to clip start/end events (captions/accessibility). */
    onClipEvent(listener: (event: AudioClipEvent) => void): () => void;
    /** Snapshot of engine state for HUDs / diagnostics. */
    diagnostics(): AudioDiagnostics;
    dispose(): void;
}
/** Discriminated result of {@link createAudioEngine} (mirrors createWebGpuApp). */
export type CreateAudioEngineResult = {
    readonly ok: true;
    readonly engine: AudioEngine;
} | {
    readonly ok: false;
    readonly reason: "audio-context-unavailable";
    readonly message: string;
};
/**
 * Create the main-thread audio engine. Returns a discriminated result instead of
 * throwing, so a missing/blocked `AudioContext` (SSR, unsupported browser) is a
 * graceful `{ ok: false }` rather than a crash. Inject a `backend` (e.g. the
 * test fake) and it never fails. See {@link createAudioEngineOrThrow} for the
 * simple/unwrapped form.
 */
export declare function createAudioEngine(options?: AudioEngineOptions): CreateAudioEngineResult;
/**
 * Unwrapped {@link createAudioEngine}: returns the engine directly and throws if
 * the AudioContext is unavailable. Convenient when a backend is injected (tests)
 * or when a missing context should be fatal.
 */
export declare function createAudioEngineOrThrow(options?: AudioEngineOptions): AudioEngine;
//# sourceMappingURL=index.d.ts.map