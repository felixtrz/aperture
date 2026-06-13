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
  /**
   * Scripted sidechain ducking: while any real voice plays on `trigger`, the
   * `targets` buses are ducked to `depth`. Set `false` to disable. Default:
   * dialogue on `voice` ducks `music` + `ambient` to 0.3.
   */
  readonly duck?:
    | false
    | {
        readonly trigger?: AudioBusId;
        readonly targets?: readonly AudioBusId[];
        readonly depth?: number;
        readonly rampSec?: number;
      };
  /** Buses silenced by `setPaused(true)` (game pause). Default sfx/voice/ambient. */
  readonly pausedBuses?: readonly AudioBusId[];
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

interface DuckConfig {
  readonly trigger: AudioBusId;
  readonly targets: readonly AudioBusId[];
  readonly depth: number;
  readonly rampSec: number;
}

const DEFAULT_DUCK: DuckConfig = {
  trigger: "voice",
  targets: ["music", "ambient"],
  depth: 0.3,
  rampSec: 0.08,
};

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
  /** Snapshot of engine state for HUDs / diagnostics. */
  diagnostics(): AudioDiagnostics;
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
  const duck: DuckConfig | null =
    options.duck === false
      ? null
      : { ...DEFAULT_DUCK, ...(options.duck ?? {}) };
  let ducked = false;
  let disposed = false;
  const pausedBuses = options.pausedBuses ?? ["sfx", "voice", "ambient"];

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
      if (duck !== null) {
        const active = voices.busActive(duck.trigger);
        if (active !== ducked) {
          ducked = active;
          for (const target of duck.targets) {
            mixer.duckBus(target, active ? duck.depth : 1, duck.rampSec);
          }
        }
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
    setPaused(paused) {
      for (const bus of pausedBuses) {
        mixer.setBusPause(bus, paused ? 0 : 1);
      }
    },
    setAudioOffset(seconds) {
      voices.setAudioOffset(seconds);
    },
    diagnostics() {
      return {
        state: backend.state,
        activeVoices: voices.activeVoiceCount,
        virtualVoices: voices.virtualVoiceCount,
        activeSources: voices.activeSourceCount,
        activePanners: voices.activePannerCount,
        decodeCount: clips.decodeCount,
        outputLatency: backend.outputLatency,
        baseLatency: backend.baseLatency,
      };
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
