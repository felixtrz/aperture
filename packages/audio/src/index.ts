import type { RenderSnapshot } from "@aperture-engine/render";
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
import {
  createClipCache,
  type ClipCache,
  type ClipResolver,
} from "./clip-cache.js";
import {
  createVoiceManager,
  type VoiceManagerOptions,
} from "./voice-manager.js";

export * from "./audio-backend.js";
export * from "./mixer.js";
export * from "./clip-cache.js";
export * from "./voice-manager.js";

/** Ramp endpoints track main-thread frame cadence, clamped to this window. */
const MIN_RAMP_SEC = 0.008;
const MAX_RAMP_SEC = 0.05;

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
  dispose(): void;
}

export function createAudioEngine(
  options: AudioEngineOptions = {},
): AudioEngine {
  const backend = options.backend ?? createWebAudioBackend(options.web ?? {});
  const mixer = createAudioMixer(backend, options.mixer ?? {});
  const clips = createClipCache(
    backend,
    options.resolveClip ?? (() => undefined),
  );
  const voices = createVoiceManager(backend, mixer, clips, options.voice ?? {});
  let disposed = false;

  return {
    backend,
    mixer,
    clips,
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
    applySnapshot(snapshot, frameDelta) {
      voices.apply(
        snapshot.audioEmitters ?? [],
        snapshot.transforms,
        snapshot.audioListener,
        clampRamp(frameDelta),
      );
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
    get activeVoiceCount(): number {
      return voices.activeVoiceCount;
    },
    get activeSourceCount(): number {
      return voices.activeSourceCount;
    },
    get activePannerCount(): number {
      return voices.activePannerCount;
    },
    get virtualVoiceCount(): number {
      return voices.virtualVoiceCount;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      voices.dispose();
      clips.dispose();
      mixer.dispose();
    },
  };
}

function clampRamp(frameDelta: number): number {
  if (!Number.isFinite(frameDelta) || frameDelta <= MIN_RAMP_SEC) {
    return MIN_RAMP_SEC;
  }
  return frameDelta > MAX_RAMP_SEC ? MAX_RAMP_SEC : frameDelta;
}
