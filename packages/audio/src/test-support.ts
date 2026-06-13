/**
 * A deterministic, deviceless {@link AudioBackend} for unit tests.
 *
 * It records node creation, graph connections, and `AudioParam` automation so
 * tests can assert engine/mixer/voice behaviour with zero Web Audio. PCM-level
 * assertions (non-silence, L/R balance, ducking dips, crossfades) belong in the
 * browser e2e layer against a real `OfflineAudioContext`; this fake exercises
 * the control logic, not the DSP.
 */
import type { AudioBackend } from "./audio-backend.js";

export interface ParamEvent {
  readonly method:
    | "setValueAtTime"
    | "linearRampToValueAtTime"
    | "exponentialRampToValueAtTime"
    | "setTargetAtTime"
    | "cancelScheduledValues";
  readonly value?: number;
  readonly time: number;
  readonly timeConstant?: number;
}

export class FakeAudioParam {
  value: number;
  readonly events: ParamEvent[] = [];

  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: "setValueAtTime", value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: "linearRampToValueAtTime", value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: "exponentialRampToValueAtTime", value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.value = value;
    this.events.push({ method: "setTargetAtTime", value, time, timeConstant });
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ method: "cancelScheduledValues", time });
    return this;
  }

  /** The most recent automation event, for terse assertions. */
  lastEvent(): ParamEvent | undefined {
    return this.events.at(-1);
  }
}

export class FakeAudioNode {
  readonly connections: FakeAudioNode[] = [];

  connect<T extends FakeAudioNode>(target: T): T {
    this.connections.push(target);
    return target;
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1);
}

export class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 2048;
  minDecibels = -100;
  maxDecibels = -30;
  smoothingTimeConstant = 0.8;

  get frequencyBinCount(): number {
    return this.fftSize >> 1;
  }

  getByteFrequencyData(array: Uint8Array): void {
    array.fill(0);
  }

  getFloatFrequencyData(array: Float32Array): void {
    array.fill(-Infinity);
  }

  getByteTimeDomainData(array: Uint8Array): void {
    array.fill(128);
  }

  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(0);
  }
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam(-24);
  readonly knee = new FakeAudioParam(30);
  readonly ratio = new FakeAudioParam(12);
  readonly attack = new FakeAudioParam(0.003);
  readonly release = new FakeAudioParam(0.25);
  readonly reduction = 0;
}

export class FakeAudioBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  readonly playbackRate = new FakeAudioParam(1);
  readonly detune = new FakeAudioParam(0);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  startArgs:
    | readonly [number | undefined, number | undefined, number | undefined]
    | null = null;
  stopArg: number | null = null;

  start(when?: number, offset?: number, duration?: number): void {
    this.started = true;
    this.startArgs = [when, offset, duration];
  }

  stop(when?: number): void {
    this.stopped = true;
    this.stopArg = when ?? null;
  }
}

export class FakePannerNode extends FakeAudioNode {
  panningModel: PanningModelType = "equalpower";
  distanceModel: DistanceModelType = "inverse";
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  coneInnerAngle = 360;
  coneOuterAngle = 360;
  coneOuterGain = 0;
  readonly positionX = new FakeAudioParam(0);
  readonly positionY = new FakeAudioParam(0);
  readonly positionZ = new FakeAudioParam(0);
  readonly orientationX = new FakeAudioParam(1);
  readonly orientationY = new FakeAudioParam(0);
  readonly orientationZ = new FakeAudioParam(0);
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new FakeAudioParam(350);
  readonly detune = new FakeAudioParam(0);
  readonly Q = new FakeAudioParam(1);
  readonly gain = new FakeAudioParam(0);
}

export class FakeConvolverNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  normalize = true;
}

export class FakeMediaElementAudioSourceNode extends FakeAudioNode {
  constructor(readonly mediaElement: HTMLMediaElement) {
    super();
  }
}

export class FakeAudioListener {
  readonly positionX = new FakeAudioParam(0);
  readonly positionY = new FakeAudioParam(0);
  readonly positionZ = new FakeAudioParam(0);
  readonly forwardX = new FakeAudioParam(0);
  readonly forwardY = new FakeAudioParam(0);
  readonly forwardZ = new FakeAudioParam(-1);
  readonly upX = new FakeAudioParam(0);
  readonly upY = new FakeAudioParam(1);
  readonly upZ = new FakeAudioParam(0);
}

export class FakeAudioBuffer {
  constructor(
    readonly duration: number,
    readonly sampleRate: number,
    readonly numberOfChannels = 2,
  ) {}

  get length(): number {
    return Math.max(0, Math.round(this.duration * this.sampleRate));
  }

  getChannelData(): Float32Array {
    return new Float32Array(this.length);
  }
}

export interface FakeAudioBackendOptions {
  readonly sampleRate?: number;
  readonly state?: AudioContextState;
  /** Duration (seconds) of buffers returned by `decode`. */
  readonly decodeDuration?: number;
}

export class FakeAudioBackend implements AudioBackend {
  currentTime = 0;
  state: AudioContextState;
  readonly sampleRate: number;
  readonly baseLatency = 0.005;
  readonly outputLatency = 0.02;

  readonly fakeListener = new FakeAudioListener();
  readonly fakeDestination = new FakeAudioNode();

  decodeCalls = 0;
  private readonly decodeDuration: number;

  readonly created = {
    gains: [] as FakeGainNode[],
    analysers: [] as FakeAnalyserNode[],
    compressors: [] as FakeDynamicsCompressorNode[],
    sources: [] as FakeAudioBufferSourceNode[],
    panners: [] as FakePannerNode[],
    biquads: [] as FakeBiquadFilterNode[],
    convolvers: [] as FakeConvolverNode[],
    mediaSources: [] as FakeMediaElementAudioSourceNode[],
  };

  constructor(options: FakeAudioBackendOptions = {}) {
    this.sampleRate = options.sampleRate ?? 48000;
    this.state = options.state ?? "suspended";
    this.decodeDuration = options.decodeDuration ?? 1;
  }

  /** Advance the fake audio clock (no real time passes in tests). */
  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  get listener(): AudioListener {
    return this.fakeListener as unknown as AudioListener;
  }

  get destination(): AudioNode {
    return this.fakeDestination as unknown as AudioNode;
  }

  async resume(): Promise<void> {
    if (this.state !== "closed") {
      this.state = "running";
    }
  }

  async suspend(): Promise<void> {
    if (this.state !== "closed") {
      this.state = "suspended";
    }
  }

  async close(): Promise<void> {
    this.state = "closed";
  }

  async decode(): Promise<AudioBuffer> {
    this.decodeCalls += 1;
    return new FakeAudioBuffer(
      this.decodeDuration,
      this.sampleRate,
    ) as unknown as AudioBuffer;
  }

  createGain(): GainNode {
    const node = new FakeGainNode();
    this.created.gains.push(node);
    return node as unknown as GainNode;
  }

  createSource(): AudioBufferSourceNode {
    const node = new FakeAudioBufferSourceNode();
    this.created.sources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }

  createMediaSource(element: HTMLMediaElement): MediaElementAudioSourceNode {
    const node = new FakeMediaElementAudioSourceNode(element);
    this.created.mediaSources.push(node);
    return node as unknown as MediaElementAudioSourceNode;
  }

  createPanner(): PannerNode {
    const node = new FakePannerNode();
    this.created.panners.push(node);
    return node as unknown as PannerNode;
  }

  createBiquad(): BiquadFilterNode {
    const node = new FakeBiquadFilterNode();
    this.created.biquads.push(node);
    return node as unknown as BiquadFilterNode;
  }

  createConvolver(): ConvolverNode {
    const node = new FakeConvolverNode();
    this.created.convolvers.push(node);
    return node as unknown as ConvolverNode;
  }

  createAnalyser(): AnalyserNode {
    const node = new FakeAnalyserNode();
    this.created.analysers.push(node);
    return node as unknown as AnalyserNode;
  }

  createCompressor(): DynamicsCompressorNode {
    const node = new FakeDynamicsCompressorNode();
    this.created.compressors.push(node);
    return node as unknown as DynamicsCompressorNode;
  }
}
