import { type AudioEngine, type AudioEngineOptions } from "@aperture-engine/audio";
import type { RenderSnapshot } from "@aperture-engine/render";
import { type AssetRegistry } from "@aperture-engine/simulation";
import type { SimulationWorker } from "@aperture-engine/runtime";
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
    /**
     * `worker` preserves the legacy direct worker subscriptions. `manual` lets a
     * presentation loop feed the exact snapshot it sampled from SAB/transferable
     * transport, avoiding a separate per-frame audio sideband message.
     */
    readonly snapshotSource?: "worker" | "manual";
}
/** The wired audio engine plus its teardown. */
export interface GeneratedAudio {
    readonly engine: AudioEngine;
    applySnapshot(snapshot: RenderSnapshot): void;
    dispose(): void;
}
/**
 * Wire a main-thread {@link AudioEngine} into the browser run loop: it consumes
 * the SAME per-frame `RenderSnapshot` the renderer does (audio is a sibling
 * derived view, not a child of the renderer), reconciling its `audioEmitters` /
 * `audioListener` into a live voice graph each frame. `frameDelta` is the
 * measured, monotonic main-thread interval; the engine clamps it to a safe ramp
 * window. Clips resolve from the mirrored source-asset registry. Returns `null`
 * when the AudioContext is unavailable (SSR / unsupported browser) — audio is an
 * optional layer, so a missing context degrades gracefully instead of throwing.
 */
export declare function installGeneratedAudio(worker: SimulationWorker, sourceAssets: AssetRegistry, options?: GeneratedAudioOptions): GeneratedAudio | null;
//# sourceMappingURL=audio.d.ts.map