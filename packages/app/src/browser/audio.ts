import {
  createAudioEngine,
  type AudioEngine,
  type AudioEngineOptions,
  type ResolvedClip,
} from "@aperture-engine/audio";
import type { AudioClipAsset } from "@aperture-engine/render";
import {
  createAudioClipHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  SimulationWorker,
  SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";

const AUDIO_CLIP_PREFIX = "audio-clip:";
/** Gestures that satisfy the browser autoplay policy and unlock the context. */
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

/**
 * Options for the generated browser app's audio realization. Everything an
 * {@link AudioEngine} accepts, plus the ability to inject a backend (tests).
 * `resolveClip` defaults to the main-thread mirror of the source asset registry.
 */
export interface GeneratedAudioOptions extends AudioEngineOptions {
  /**
   * Auto-unlock the AudioContext on the first user gesture (the autoplay
   * policy). Default true; set false to drive {@link AudioEngine.unlock}
   * manually. (`resolveClip`, inherited from {@link AudioEngineOptions},
   * defaults to the mirrored source-asset registry when omitted.)
   */
  readonly autoUnlock?: boolean;
}

/** The wired audio engine plus its teardown. */
export interface GeneratedAudio {
  readonly engine: AudioEngine;
  dispose(): void;
}

/**
 * Wire a main-thread {@link AudioEngine} into the browser run loop: it consumes
 * the SAME per-frame `RenderSnapshot` the renderer does (audio is a sibling
 * derived view, not a child of the renderer), reconciling its `audioEmitters` /
 * `audioListener` into a live voice graph each frame. `frameDelta` is the
 * measured, monotonic main-thread interval; the engine clamps it to a safe ramp
 * window. Clips resolve from the mirrored source-asset registry.
 */
export function installGeneratedAudio(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  options: GeneratedAudioOptions = {},
): GeneratedAudio {
  const { autoUnlock = true, resolveClip, ...engineOptions } = options;
  const engine = createAudioEngine({
    ...engineOptions,
    resolveClip:
      resolveClip ??
      ((clipId) => resolveClipFromRegistry(sourceAssets, clipId)),
  });

  let previousTime = monotonicNow();
  const unsubscribe = worker.onSnapshot(
    (event: SimulationWorkerSnapshotEvent) => {
      const now = monotonicNow();
      const frameDelta = (now - previousTime) / 1000;
      previousTime = now;
      engine.applySnapshot(event.snapshot, frameDelta);
    },
  );

  const detachUnlock = autoUnlock ? installAutoUnlock(engine) : null;

  return {
    engine,
    dispose() {
      unsubscribe();
      detachUnlock?.();
      engine.dispose();
    },
  };
}

/** Resolve an `audio-clip:<id>` key to its encoded source from the mirror. */
function resolveClipFromRegistry(
  sourceAssets: AssetRegistry,
  clipId: string,
): ResolvedClip | undefined {
  if (!clipId.startsWith(AUDIO_CLIP_PREFIX)) {
    return undefined;
  }
  const handle = createAudioClipHandle(clipId.slice(AUDIO_CLIP_PREFIX.length));
  const entry = sourceAssets.get<"audio-clip", AudioClipAsset>(handle);
  if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
    return undefined;
  }
  const asset = entry.asset;
  return {
    streaming: asset.streaming,
    durationHint: asset.durationHint,
    ...(asset.bytes === undefined ? {} : { bytes: asset.bytes }),
    ...(asset.url === undefined ? {} : { url: asset.url }),
    ...(asset.captionTrackId === undefined
      ? {}
      : { captionTrackId: asset.captionTrackId }),
  };
}

/** Resume the context on the first user gesture; detaches after firing once. */
function installAutoUnlock(engine: AudioEngine): (() => void) | null {
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return null;
  }
  const detach = (): void => {
    for (const type of UNLOCK_EVENTS) {
      window.removeEventListener(type, onGesture);
    }
  };
  const onGesture = (): void => {
    detach();
    void engine.unlock();
  };
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, onGesture, { once: true, passive: true });
  }
  return detach;
}

function monotonicNow(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
