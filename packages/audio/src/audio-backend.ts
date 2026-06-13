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
  createPanner(): PannerNode;
  createBiquad(): BiquadFilterNode;
  createConvolver(): ConvolverNode;
  createAnalyser(): AnalyserNode;
  createCompressor(): DynamicsCompressorNode;
}

export interface WebAudioBackendOptions {
  /** Provide an existing context (e.g. shared with another subsystem). */
  readonly context?: AudioContext;
  readonly latencyHint?: AudioContextLatencyCategory | number;
  readonly sampleRate?: number;
}

interface WebkitAudioWindow {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Wrap a real {@link AudioContext}. Only callable on the main thread of a
 * browser; the worker side of the engine never imports this.
 */
export function createWebAudioBackend(
  options: WebAudioBackendOptions = {},
): AudioBackend {
  const context = options.context ?? createBrowserContext(options);

  return {
    get currentTime(): number {
      return context.currentTime;
    },
    get state(): AudioContextState {
      return context.state;
    },
    get sampleRate(): number {
      return context.sampleRate;
    },
    get baseLatency(): number {
      return context.baseLatency;
    },
    get outputLatency(): number {
      return context.outputLatency;
    },
    get listener(): AudioListener {
      return context.listener;
    },
    get destination(): AudioNode {
      return context.destination;
    },
    resume: () => context.resume(),
    suspend: () => context.suspend(),
    close: () => context.close(),
    // slice(0) so decodeAudioData (which detaches its input) cannot strand the
    // caller's encoded bytes — the same defensive copy three.js's AudioLoader makes.
    decode: (bytes) => context.decodeAudioData(bytes.slice(0)),
    createGain: () => context.createGain(),
    createSource: () => context.createBufferSource(),
    createMediaSource: (element) => context.createMediaElementSource(element),
    createPanner: () => context.createPanner(),
    createBiquad: () => context.createBiquadFilter(),
    createConvolver: () => context.createConvolver(),
    createAnalyser: () => context.createAnalyser(),
    createCompressor: () => context.createDynamicsCompressor(),
  };
}

function createBrowserContext(options: WebAudioBackendOptions): AudioContext {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as WebkitAudioWindow).webkitAudioContext;

  if (Ctor === undefined) {
    throw new Error(
      "Web Audio API is unavailable: no AudioContext in this environment.",
    );
  }

  const contextOptions: AudioContextOptions = {};

  if (options.latencyHint !== undefined) {
    contextOptions.latencyHint = options.latencyHint;
  }
  if (options.sampleRate !== undefined) {
    contextOptions.sampleRate = options.sampleRate;
  }

  return new Ctor(contextOptions);
}
