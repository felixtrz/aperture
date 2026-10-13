/**
 * The Web Audio seam.
 *
 * Everything the audio engine does to make sound flows through an
 * {@link AudioBackend}. In the browser it is backed by a real
 * {@link AudioContext}; in tests it is backed by a deterministic fake
 * (see `./test-support.ts`). This mirrors aperture's render-backend boundary:
 * realization is swappable, the logic above it is not. Keeping the surface
 * this narrow is what lets the voice/mixer logic be unit-tested with zero Web
 * Audio and asserted as PCM only in the browser e2e layer.
 */
export interface AudioBackend {
    /** Monotonic audio clock in seconds (`AudioContext.currentTime`). */
    readonly currentTime: number;
    readonly state: AudioContextState;
    readonly sampleRate: number;
    /** Processing block latency in seconds (`AudioContext.baseLatency`). */
    readonly baseLatency: number;
    /** Estimated output latency in seconds — used for latency compensation. */
    readonly outputLatency: number;
    /** The single Web Audio listener (one per context). */
    readonly listener: AudioListener;
    /** Terminal node the master chain connects into. */
    readonly destination: AudioNode;
    resume(): Promise<void>;
    suspend(): Promise<void>;
    close(): Promise<void>;
    /** Decode encoded bytes (mp3/ogg/wav/…) into a playable buffer. */
    decode(bytes: ArrayBuffer): Promise<AudioBuffer>;
    createGain(): GainNode;
    createSource(): AudioBufferSourceNode;
    createMediaSource(element: HTMLMediaElement): MediaElementAudioSourceNode;
    /** A streamed source (long music) backed by a media element — no decode. */
    createStreamingSource(url: string): StreamingSource;
    createPanner(): PannerNode;
    createBiquad(): BiquadFilterNode;
    createConvolver(): ConvolverNode;
    createAnalyser(): AnalyserNode;
    createCompressor(): DynamicsCompressorNode;
    /**
     * Try to build an AudioWorklet brickwall limiter node; resolves null when the
     * worklet API / cross-origin isolation is unavailable (degrade to compressor).
     */
    createWorkletLimiter(): Promise<AudioNode | null>;
}
/** A streamed media-element source: its graph node plus transport controls. */
export interface StreamingSource {
    readonly node: AudioNode;
    play(): void;
    stop(): void;
    setLoop(loop: boolean): void;
}
export interface WebAudioBackendOptions {
    /** Provide an existing context (e.g. shared with another subsystem). */
    readonly context?: AudioContext;
    readonly latencyHint?: AudioContextLatencyCategory | number;
    readonly sampleRate?: number;
}
/**
 * Wrap a real {@link AudioContext}. Only callable on the main thread of a
 * browser; the worker side of the engine never imports this.
 */
export declare function createWebAudioBackend(options?: WebAudioBackendOptions): AudioBackend;
//# sourceMappingURL=audio-backend.d.ts.map