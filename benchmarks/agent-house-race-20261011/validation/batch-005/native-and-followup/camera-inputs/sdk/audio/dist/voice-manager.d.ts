import type { AudioEmitterPacket, AudioListenerPacket } from "@aperture-engine/render";
import type { AudioBackend } from "./audio-backend.js";
import type { ClipCache } from "./clip-cache.js";
import { type AudioBusId, type AudioMixer } from "./mixer.js";
export interface VoiceManagerOptions {
    /** Max one-shots fired per emitter per frame (burst overflow is dropped). */
    readonly maxBurstPerFrame?: number;
    /** Global ceiling on simultaneously-sounding real voices. */
    readonly maxVoices?: number;
    /** Override per-bus simultaneous-voice caps. */
    readonly busCaps?: Partial<Record<AudioBusId, number>>;
    /** Auto-Doppler pitch shift from radial velocity (default off). */
    readonly doppler?: boolean;
    /**
     * Deterministic per-emitter pitch variation range as a ratio (e.g. 0.06 =
     * ±6%), derived from each emitter's `seed`. Default 0 (no variation), so
     * repeated SFX can be de-cloned without touching gameplay. Clamped to [0, 1).
     */
    readonly pitchVariation?: number;
    /** Fired when a source starts playing (for caption / accessibility hooks). */
    readonly onSourceStart?: (clipId: string) => void;
    /** Fired when a source ends (natural end, stop, or steal). */
    readonly onSourceEnd?: (clipId: string) => void;
}
export interface VoiceManager {
    /**
     * Reconcile the live voice graph against this frame's audio intent.
     * `transforms` carries the packed world matrices (emitter + listener poses);
     * `frameDelta` is the clamped main-thread frame interval used for ramps.
     */
    apply(emitters: readonly AudioEmitterPacket[], transforms: Float32Array, listener: AudioListenerPacket | undefined, frameDelta: number, resumed?: boolean): void;
    /** Real (sounding) voices — bounded by maxVoices and the per-bus caps. */
    readonly activeVoiceCount: number;
    /** Live `AudioBufferSourceNode`s across all real voices. */
    readonly activeSourceCount: number;
    /** Live `PannerNode`s (spatial real voices) — diagnostics / budget. */
    readonly activePannerCount: number;
    /** Demoted node-less voices retaining a playhead for mid-loop resume. */
    readonly virtualVoiceCount: number;
    /** Whether any real voice is currently routed to the given bus. */
    busActive(bus: AudioBusId): boolean;
    /** Shift scheduled `start()` times by `seconds` (latency compensation). */
    setAudioOffset(seconds: number): void;
    dispose(): void;
}
export declare function createVoiceManager(backend: AudioBackend, mixer: AudioMixer, clips: ClipCache, options?: VoiceManagerOptions): VoiceManager;
//# sourceMappingURL=voice-manager.d.ts.map