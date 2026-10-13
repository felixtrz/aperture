import type { AudioBackend } from "./audio-backend.js";
/**
 * The fixed submix buses. Voices route into a bus by id; the bus sums into the
 * master chain. Mirrors the named-bus model in the audio plan (music/sfx/ui/
 * ambient/voice). User-defined buses are deferred; a dual A/B `music` sub-bus
 * for crossfade lands with the music state machine (AU-11).
 */
export type AudioBusId = "music" | "sfx" | "ui" | "ambient" | "voice";
export declare const AUDIO_BUS_IDS: readonly AudioBusId[];
export type AudioAnalyserTarget = AudioBusId | "master";
/** The two `music` sub-buses used for equal-power track crossfades. */
export type MusicSlot = "a" | "b";
export interface AudioMixerOptions {
    readonly masterGain?: number;
    readonly busGains?: Partial<Record<AudioBusId, number>>;
    readonly analyserFftSize?: number;
}
export interface AudioMixer {
    /** The node a voice connects into to play on the given bus. */
    busInput(bus: AudioBusId): AudioNode;
    /** Set master gain with a click-free ramp (instant when `rampSec <= 0`). */
    setMasterGain(value: number, rampSec?: number): void;
    /** Collapse the master output to mono (accessibility) or restore stereo. */
    setMonoDownmix(mono: boolean): void;
    /** Insert a post-limiter master tail node (e.g. a worklet limiter), or clear. */
    setMasterTail(node: AudioNode | null): void;
    /** Set a bus gain with a click-free ramp (instant when `rampSec <= 0`). */
    setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
    getMasterGain(): number;
    getBusGain(bus: AudioBusId): number;
    /**
     * Apply a ducking multiplier to a bus (composed with its authored gain), e.g.
     * duck `music` to 0.25 while dialogue plays, then `duckBus(bus, 1)` to recover.
     */
    duckBus(bus: AudioBusId, factor: number, rampSec?: number): void;
    /**
     * Independent pause multiplier for a bus (composed with authored gain + duck).
     * Game-pause sets it to 0 on sfx/voice/ambient while music/ui keep playing.
     */
    setBusPause(bus: AudioBusId, factor: number, rampSec?: number): void;
    /** Node a music track routes into to play on the given crossfade sub-bus. */
    musicSubInput(slot: MusicSlot): AudioNode;
    /**
     * Equal-power crossfade between the two music sub-buses. `t=0` is fully A,
     * `t=1` fully B; the summed power stays ~constant across the sweep.
     */
    setMusicCrossfade(t: number, rampSec?: number): void;
    /** FFT tap for a bus or the summed master, for visualizers/diagnostics. */
    analyser(target: AudioAnalyserTarget): AnalyserNode;
    dispose(): void;
}
/**
 * Build the bus graph:
 *
 * ```
 * voice ─► busGain ─► busAnalyser ─┐
 *                                  ├─► masterGain ─► masterAnalyser ─► limiter ─► destination
 * (one branch per bus) ────────────┘
 * ```
 *
 * The trailing `DynamicsCompressorNode` acts as a brick-wall-ish master limiter
 * so summed over-unity content cannot clip the device. The analyser taps pass
 * audio through unchanged and exist only to expose frequency data.
 */
export declare function createAudioMixer(backend: AudioBackend, options?: AudioMixerOptions): AudioMixer;
//# sourceMappingURL=mixer.d.ts.map