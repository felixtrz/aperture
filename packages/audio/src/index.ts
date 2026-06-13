import {
  createWebAudioBackend,
  type AudioBackend,
  type WebAudioBackendOptions,
} from "./audio-backend.js";
import {
  createAudioMixer,
  type AudioAnalyserTarget,
  type AudioBusId,
  type AudioMixer,
  type AudioMixerOptions,
} from "./mixer.js";

export * from "./audio-backend.js";
export * from "./mixer.js";

export interface AudioEngineOptions {
  /** Inject a backend (e.g. the test fake). Defaults to a real Web Audio backend. */
  readonly backend?: AudioBackend;
  /** Options for the default Web Audio backend (ignored when `backend` is set). */
  readonly web?: WebAudioBackendOptions;
  readonly mixer?: AudioMixerOptions;
}

/**
 * The main-thread audio engine: the derived view that realizes simulation
 * intent as sound. This foundation owns the {@link AudioBackend}, the submix
 * {@link AudioMixer}, and the context lifecycle (unlock/suspend/resume).
 * Snapshot consumption and voice management land in later phases (AU-2/AU-4).
 */
export interface AudioEngine {
  readonly backend: AudioBackend;
  readonly mixer: AudioMixer;
  readonly state: AudioContextState;
  /** Resume a context the autoplay policy left suspended (call on first gesture). */
  unlock(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  setMasterGain(value: number, rampSec?: number): void;
  setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
  analyser(target: AudioAnalyserTarget): AnalyserNode;
  dispose(): void;
}

export function createAudioEngine(
  options: AudioEngineOptions = {},
): AudioEngine {
  const backend = options.backend ?? createWebAudioBackend(options.web ?? {});
  const mixer = createAudioMixer(backend, options.mixer ?? {});
  let disposed = false;

  return {
    backend,
    mixer,
    get state(): AudioContextState {
      return backend.state;
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
    analyser(target) {
      return mixer.analyser(target);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      mixer.dispose();
    },
  };
}
