import {
  createWebAudioBackend,
  type AudioBackend,
  type WebAudioBackendOptions,
} from "./audio-backend.js";
import {
  createAudioMixer,
  type AudioBusId,
  type AudioMixer,
  type AudioMixerOptions,
} from "./mixer.js";

const DEFAULT_RAMP_SEC = 0.03;
const DEFAULT_STOP_FADE_SEC = 0.015;
const DEFAULT_LOWPASS_Q = 0.7;
const DEFAULT_LOWPASS_FREQUENCY = 22000;
const FIRST_GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export type AudioSoundClipSource =
  | string
  | {
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
  readonly lowpass?:
    | boolean
    | {
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
  startLoop(
    clipId: string,
    options?: AudioLoopVoiceOptions,
  ): Promise<AudioLoopVoice | null>;
  playOneShot(clipId: string, options?: AudioOneShotOptions): Promise<boolean>;
  unlock(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  setMasterGain(value: number, rampSec?: number): void;
  setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
  dispose(): void;
}

export type CreateAudioSoundBoardResult =
  | { readonly ok: true; readonly soundBoard: AudioSoundBoard }
  | {
      readonly ok: false;
      readonly reason: "audio-context-unavailable";
      readonly message: string;
    };

export interface FirstAudioGestureTarget {
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface FirstAudioGestureStarter {
  readonly started: boolean;
  dispose(): void;
}

export function createAudioSoundBoard(
  options: AudioSoundBoardOptions = {},
): CreateAudioSoundBoardResult {
  let backend: AudioBackend;
  const ownsBackend = options.backend === undefined;
  try {
    backend = options.backend ?? createWebAudioBackend(options.web ?? {});
  } catch (error) {
    return {
      ok: false,
      reason: "audio-context-unavailable",
      message:
        error instanceof Error
          ? error.message
          : "The Web Audio API is unavailable in this environment.",
    };
  }
  const mixer =
    options.mixer ?? createAudioMixer(backend, options.mixerOptions);
  const closeBackendOnDispose = options.closeBackendOnDispose ?? ownsBackend;
  const clipSources = new Map<string, AudioSoundClipSource>(
    Object.entries(options.clips ?? {}),
  );
  const clipCache = new Map<string, AudioBuffer>();
  const pendingClips = new Map<string, Promise<AudioBuffer | null>>();
  const activeLoops = new Set<ManagedLoopVoice>();
  const fetchSource = options.fetch ?? globalThis.fetch?.bind(globalThis);
  let disposed = false;

  async function loadClip(id: string): Promise<AudioBuffer | null> {
    if (disposed) {
      return null;
    }
    const cached = clipCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const pending = pendingClips.get(id);
    if (pending !== undefined) {
      return pending;
    }
    const promise = decodeClip(id);
    pendingClips.set(id, promise);
    try {
      const buffer = await promise;
      if (buffer !== null) {
        clipCache.set(id, buffer);
      }
      return buffer;
    } finally {
      pendingClips.delete(id);
    }
  }

  async function decodeClip(id: string): Promise<AudioBuffer | null> {
    const source = clipSources.get(id);
    if (source === undefined) {
      return null;
    }
    if (typeof source === "string") {
      return fetchAndDecode(source);
    }
    if (source.buffer !== undefined) {
      return source.buffer;
    }
    if (source.bytes !== undefined) {
      return backend.decode(source.bytes);
    }
    if (source.url !== undefined) {
      return fetchAndDecode(source.url);
    }
    return null;
  }

  async function fetchAndDecode(url: string): Promise<AudioBuffer | null> {
    if (fetchSource === undefined) {
      return null;
    }
    try {
      const response = await fetchSource(url);
      if (!response.ok) {
        return null;
      }
      return backend.decode(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  const soundBoard: AudioSoundBoard = {
    backend,
    mixer,
    get state(): AudioContextState {
      return backend.state;
    },
    setClip(id, source) {
      clipSources.set(id, source);
      clipCache.delete(id);
      pendingClips.delete(id);
    },
    preload(id) {
      return loadClip(id);
    },
    async preloadAll(ids = [...clipSources.keys()]) {
      await Promise.all(ids.map((id) => loadClip(id)));
    },
    async startLoop(clipId, loopOptions = {}) {
      const buffer = await loadClip(clipId);
      if (buffer === null || disposed) {
        return null;
      }
      const voice = new ManagedLoopVoice(
        backend,
        mixer,
        clipId,
        buffer,
        loopOptions,
        () => activeLoops.delete(voice),
      );
      activeLoops.add(voice);
      return voice;
    },
    async playOneShot(clipId, oneShotOptions = {}) {
      const buffer = await loadClip(clipId);
      if (buffer === null || disposed) {
        return false;
      }
      startOneShot(backend, mixer, clipId, buffer, oneShotOptions);
      return true;
    },
    async unlock() {
      if (backend.state !== "running") {
        await backend.resume();
      }
    },
    async suspend() {
      if (backend.state === "running") {
        await backend.suspend();
      }
    },
    async resume() {
      if (backend.state === "suspended") {
        await backend.resume();
      }
    },
    setMasterGain(value, rampSec) {
      mixer.setMasterGain(value, rampSec);
    },
    setBusGain(bus, value, rampSec) {
      mixer.setBusGain(bus, value, rampSec);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const voice of [...activeLoops]) {
        voice.dispose();
      }
      activeLoops.clear();
      clipCache.clear();
      pendingClips.clear();
      if (options.mixer === undefined) {
        mixer.dispose();
      }
      if (closeBackendOnDispose) {
        void backend.close();
      }
    },
  };

  return { ok: true, soundBoard };
}

export function createAudioSoundBoardOrThrow(
  options: AudioSoundBoardOptions = {},
): AudioSoundBoard {
  const result = createAudioSoundBoard(options);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.soundBoard;
}

export function createFirstAudioGestureStarter(
  target: FirstAudioGestureTarget,
  start: () => void | Promise<void>,
): FirstAudioGestureStarter {
  let disposed = false;
  let started = false;

  const listener: EventListener = () => {
    if (disposed || started) {
      return;
    }
    started = true;
    remove();
    void start();
  };

  function remove(): void {
    for (const event of FIRST_GESTURE_EVENTS) {
      target.removeEventListener(event, listener);
    }
  }

  for (const event of FIRST_GESTURE_EVENTS) {
    target.addEventListener(event, listener, { once: false });
  }

  return {
    get started(): boolean {
      return started;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      remove();
    },
  };
}

class ManagedLoopVoice implements AudioLoopVoice {
  readonly bus: AudioBusId;
  readonly gain: GainNode;
  readonly source: AudioBufferSourceNode;
  readonly lowpass: BiquadFilterNode | null;
  private onDispose: (() => void) | null;
  private stoppedValue = false;

  constructor(
    private readonly backend: AudioBackend,
    mixer: AudioMixer,
    readonly clipId: string,
    buffer: AudioBuffer,
    options: AudioLoopVoiceOptions,
    onDispose: () => void,
  ) {
    this.bus = options.bus ?? "sfx";
    this.onDispose = onDispose;
    this.gain = backend.createGain();
    this.gain.gain.value = clampGain(options.gain ?? 0);
    this.source = backend.createSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.playbackRate.value = clampPlaybackRate(
      options.playbackRate ?? 1,
    );

    this.lowpass = createLowpass(backend, options.lowpass);
    if (this.lowpass !== null) {
      this.source.connect(this.lowpass);
      this.lowpass.connect(this.gain);
    } else {
      this.source.connect(this.gain);
    }
    this.gain.connect(mixer.busInput(this.bus));
    this.source.onended = () => this.dispose();
    this.source.start();
  }

  get stopped(): boolean {
    return this.stoppedValue;
  }

  setGain(value: number, rampSec = DEFAULT_RAMP_SEC): void {
    if (this.stoppedValue) {
      return;
    }
    rampParam(
      this.gain.gain,
      this.backend.currentTime,
      clampGain(value),
      rampSec,
    );
  }

  setPlaybackRate(value: number, rampSec = DEFAULT_RAMP_SEC): void {
    if (this.stoppedValue) {
      return;
    }
    rampParam(
      this.source.playbackRate,
      this.backend.currentTime,
      clampPlaybackRate(value),
      rampSec,
    );
  }

  setLowpassFrequency(value: number, timeConstant = 0.05): void {
    if (this.stoppedValue || this.lowpass === null) {
      return;
    }
    this.lowpass.frequency.setTargetAtTime(
      clampFrequency(value),
      this.backend.currentTime,
      Math.max(0, timeConstant),
    );
  }

  stop(fadeSec = DEFAULT_STOP_FADE_SEC): void {
    if (this.stoppedValue) {
      return;
    }
    const now = this.backend.currentTime;
    const stopAt = now + Math.max(0, fadeSec);
    rampParam(this.gain.gain, now, 0, fadeSec);
    safeStop(this.source, stopAt);
    this.stoppedValue = true;
  }

  dispose(): void {
    if (this.onDispose === null) {
      return;
    }
    const notify = this.onDispose;
    this.onDispose = null;
    this.stoppedValue = true;
    safeStop(this.source, this.backend.currentTime);
    this.source.disconnect();
    this.lowpass?.disconnect();
    this.gain.disconnect();
    notify();
  }
}

function startOneShot(
  backend: AudioBackend,
  mixer: AudioMixer,
  clipId: string,
  buffer: AudioBuffer,
  options: AudioOneShotOptions,
): void {
  const gain = backend.createGain();
  const source = backend.createSource();
  source.buffer = buffer;
  source.playbackRate.value = clampPlaybackRate(options.playbackRate ?? 1);
  gain.gain.value = clampGain(options.gain ?? 1);

  let lowpass: BiquadFilterNode | null = null;
  if (options.lowpassFrequency !== undefined) {
    lowpass = backend.createBiquad();
    lowpass.type = "lowpass";
    lowpass.Q.value = DEFAULT_LOWPASS_Q;
    lowpass.frequency.value = clampFrequency(options.lowpassFrequency);
    source.connect(lowpass);
    lowpass.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(mixer.busInput(options.bus ?? "sfx"));
  source.onended = () => {
    source.disconnect();
    lowpass?.disconnect();
    gain.disconnect();
    void clipId;
  };
  source.start();
}

function createLowpass(
  backend: AudioBackend,
  options: AudioLoopVoiceOptions["lowpass"],
): BiquadFilterNode | null {
  if (options === undefined || options === false) {
    return null;
  }
  const lowpass = backend.createBiquad();
  lowpass.type = "lowpass";
  lowpass.Q.value =
    typeof options === "object"
      ? (options.q ?? DEFAULT_LOWPASS_Q)
      : DEFAULT_LOWPASS_Q;
  lowpass.frequency.value =
    typeof options === "object"
      ? clampFrequency(options.frequency ?? DEFAULT_LOWPASS_FREQUENCY)
      : DEFAULT_LOWPASS_FREQUENCY;
  return lowpass;
}

function rampParam(
  param: AudioParam,
  now: number,
  target: number,
  rampSec: number,
): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (rampSec <= 0) {
    param.setValueAtTime(target, now);
  } else {
    param.linearRampToValueAtTime(target, now + rampSec);
  }
}

function safeStop(source: AudioBufferSourceNode, when?: number): void {
  try {
    source.stop(when);
  } catch {
    // BufferSource.stop throws when called before start or after a previous stop.
  }
}

function clampGain(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, value);
}

function clampPlaybackRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.0001, value);
}

function clampFrequency(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LOWPASS_FREQUENCY;
  }
  return Math.max(10, value);
}
