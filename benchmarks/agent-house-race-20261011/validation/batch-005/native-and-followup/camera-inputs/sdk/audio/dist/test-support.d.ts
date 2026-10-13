/**
 * A deterministic, deviceless {@link AudioBackend} for unit tests.
 *
 * It records node creation, graph connections, and `AudioParam` automation so
 * tests can assert engine/mixer/voice behaviour with zero Web Audio. PCM-level
 * assertions (non-silence, L/R balance, ducking dips, crossfades) belong in the
 * browser e2e layer against a real `OfflineAudioContext`; this fake exercises
 * the control logic, not the DSP.
 */
import type { AudioBackend, StreamingSource } from "./audio-backend.js";
export interface ParamEvent {
    readonly method: "setValueAtTime" | "linearRampToValueAtTime" | "exponentialRampToValueAtTime" | "setTargetAtTime" | "cancelScheduledValues";
    readonly value?: number;
    readonly time: number;
    readonly timeConstant?: number;
}
export declare class FakeAudioParam {
    value: number;
    readonly events: ParamEvent[];
    constructor(value?: number);
    setValueAtTime(value: number, time: number): this;
    linearRampToValueAtTime(value: number, time: number): this;
    exponentialRampToValueAtTime(value: number, time: number): this;
    setTargetAtTime(value: number, time: number, timeConstant: number): this;
    cancelScheduledValues(time: number): this;
    /** The most recent automation event, for terse assertions. */
    lastEvent(): ParamEvent | undefined;
}
export declare class FakeAudioNode {
    readonly connections: FakeAudioNode[];
    connect<T extends FakeAudioNode>(target: T): T;
    disconnect(): void;
}
export declare class FakeGainNode extends FakeAudioNode {
    readonly gain: FakeAudioParam;
    channelCount: number;
    channelCountMode: ChannelCountMode;
    channelInterpretation: ChannelInterpretation;
}
export declare class FakeAnalyserNode extends FakeAudioNode {
    fftSize: number;
    minDecibels: number;
    maxDecibels: number;
    smoothingTimeConstant: number;
    get frequencyBinCount(): number;
    getByteFrequencyData(array: Uint8Array): void;
    getFloatFrequencyData(array: Float32Array): void;
    getByteTimeDomainData(array: Uint8Array): void;
    getFloatTimeDomainData(array: Float32Array): void;
}
export declare class FakeDynamicsCompressorNode extends FakeAudioNode {
    readonly threshold: FakeAudioParam;
    readonly knee: FakeAudioParam;
    readonly ratio: FakeAudioParam;
    readonly attack: FakeAudioParam;
    readonly release: FakeAudioParam;
    readonly reduction = 0;
}
export declare class FakeAudioBufferSourceNode extends FakeAudioNode {
    buffer: AudioBuffer | null;
    readonly playbackRate: FakeAudioParam;
    readonly detune: FakeAudioParam;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    onended: (() => void) | null;
    started: boolean;
    stopped: boolean;
    startArgs: readonly [number | undefined, number | undefined, number | undefined] | null;
    stopArg: number | null;
    start(when?: number, offset?: number, duration?: number): void;
    stop(when?: number): void;
}
export declare class FakePannerNode extends FakeAudioNode {
    panningModel: PanningModelType;
    distanceModel: DistanceModelType;
    refDistance: number;
    maxDistance: number;
    rolloffFactor: number;
    coneInnerAngle: number;
    coneOuterAngle: number;
    coneOuterGain: number;
    readonly positionX: FakeAudioParam;
    readonly positionY: FakeAudioParam;
    readonly positionZ: FakeAudioParam;
    readonly orientationX: FakeAudioParam;
    readonly orientationY: FakeAudioParam;
    readonly orientationZ: FakeAudioParam;
}
export declare class FakeBiquadFilterNode extends FakeAudioNode {
    type: BiquadFilterType;
    readonly frequency: FakeAudioParam;
    readonly detune: FakeAudioParam;
    readonly Q: FakeAudioParam;
    readonly gain: FakeAudioParam;
}
export declare class FakeConvolverNode extends FakeAudioNode {
    buffer: AudioBuffer | null;
    normalize: boolean;
}
export declare class FakeMediaElementAudioSourceNode extends FakeAudioNode {
    readonly mediaElement: HTMLMediaElement;
    constructor(mediaElement: HTMLMediaElement);
}
export declare class FakeStreamingSource {
    readonly url: string;
    readonly node: FakeAudioNode;
    played: boolean;
    stopped: boolean;
    loop: boolean;
    constructor(url: string);
    play(): void;
    stop(): void;
    setLoop(loop: boolean): void;
}
export declare class FakeAudioListener {
    readonly positionX: FakeAudioParam;
    readonly positionY: FakeAudioParam;
    readonly positionZ: FakeAudioParam;
    readonly forwardX: FakeAudioParam;
    readonly forwardY: FakeAudioParam;
    readonly forwardZ: FakeAudioParam;
    readonly upX: FakeAudioParam;
    readonly upY: FakeAudioParam;
    readonly upZ: FakeAudioParam;
}
export declare class FakeAudioBuffer {
    readonly duration: number;
    readonly sampleRate: number;
    readonly numberOfChannels: number;
    constructor(duration: number, sampleRate: number, numberOfChannels?: number);
    get length(): number;
    getChannelData(): Float32Array;
}
export interface FakeAudioBackendOptions {
    readonly sampleRate?: number;
    readonly state?: AudioContextState;
    /** Duration (seconds) of buffers returned by `decode`. */
    readonly decodeDuration?: number;
}
export declare class FakeAudioBackend implements AudioBackend {
    currentTime: number;
    state: AudioContextState;
    readonly sampleRate: number;
    readonly baseLatency = 0.005;
    readonly outputLatency = 0.02;
    readonly fakeListener: FakeAudioListener;
    readonly fakeDestination: FakeAudioNode;
    decodeCalls: number;
    private readonly decodeDuration;
    readonly created: {
        gains: FakeGainNode[];
        analysers: FakeAnalyserNode[];
        compressors: FakeDynamicsCompressorNode[];
        sources: FakeAudioBufferSourceNode[];
        panners: FakePannerNode[];
        biquads: FakeBiquadFilterNode[];
        convolvers: FakeConvolverNode[];
        mediaSources: FakeMediaElementAudioSourceNode[];
        streams: FakeStreamingSource[];
    };
    constructor(options?: FakeAudioBackendOptions);
    /** Advance the fake audio clock (no real time passes in tests). */
    advanceTime(seconds: number): void;
    get listener(): AudioListener;
    get destination(): AudioNode;
    resume(): Promise<void>;
    suspend(): Promise<void>;
    close(): Promise<void>;
    decode(): Promise<AudioBuffer>;
    createGain(): GainNode;
    createSource(): AudioBufferSourceNode;
    createMediaSource(element: HTMLMediaElement): MediaElementAudioSourceNode;
    createStreamingSource(url: string): StreamingSource;
    createPanner(): PannerNode;
    createBiquad(): BiquadFilterNode;
    createConvolver(): ConvolverNode;
    createAnalyser(): AnalyserNode;
    createCompressor(): DynamicsCompressorNode;
    createWorkletLimiter(): Promise<AudioNode | null>;
}
//# sourceMappingURL=test-support.d.ts.map