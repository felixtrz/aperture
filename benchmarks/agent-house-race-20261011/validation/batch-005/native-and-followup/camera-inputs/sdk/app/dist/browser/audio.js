import { createAudioEngine, } from "@aperture-engine/audio";
import { createAudioClipHandle, } from "@aperture-engine/simulation";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
const AUDIO_CLIP_PREFIX = "audio-clip:";
/** Gestures that satisfy the browser autoplay policy and unlock the context. */
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"];
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
export function installGeneratedAudio(worker, sourceAssets, options = {}) {
    const { autoUnlock = true, snapshotSource = "worker", resolveClip, ...engineOptions } = options;
    const created = createAudioEngine({
        ...engineOptions,
        resolveClip: resolveClip ??
            ((clipId) => resolveClipFromRegistry(sourceAssets, clipId)),
    });
    if (!created.ok) {
        return null;
    }
    const engine = created.engine;
    let previousTime = monotonicNow();
    let disposed = false;
    const applySnapshot = (snapshot) => {
        if (disposed) {
            return;
        }
        const now = monotonicNow();
        const frameDelta = (now - previousTime) / 1000;
        previousTime = now;
        engine.applySnapshot(snapshot, frameDelta);
    };
    const unsubscribeSnapshot = snapshotSource === "manual"
        ? null
        : worker.onSnapshot((event) => {
            applySnapshot(event.snapshot);
        });
    const unsubscribeAudioSnapshot = snapshotSource === "manual"
        ? null
        : worker.onMessage((message) => {
            const snapshot = readAudioSnapshotMessage(message);
            if (snapshot !== null) {
                applySnapshot(snapshot);
            }
        });
    const detachUnlock = autoUnlock ? installAutoUnlock(engine) : null;
    return {
        engine,
        applySnapshot,
        dispose() {
            disposed = true;
            unsubscribeSnapshot?.();
            unsubscribeAudioSnapshot?.();
            detachUnlock?.();
            engine.dispose();
        },
    };
}
function readAudioSnapshotMessage(message) {
    if (typeof message !== "object" || message === null) {
        return null;
    }
    const record = message;
    return record.type === SIMULATION_WORKER_PROTOCOL.audioSnapshot &&
        isRenderSnapshotLike(record.snapshot)
        ? record.snapshot
        : null;
}
function isRenderSnapshotLike(value) {
    return (typeof value === "object" &&
        value !== null &&
        typeof value.frame === "number");
}
/** Resolve an `audio-clip:<id>` key to its encoded source from the mirror. */
function resolveClipFromRegistry(sourceAssets, clipId) {
    if (!clipId.startsWith(AUDIO_CLIP_PREFIX)) {
        return undefined;
    }
    const handle = createAudioClipHandle(clipId.slice(AUDIO_CLIP_PREFIX.length));
    const entry = sourceAssets.get(handle);
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
function installAutoUnlock(engine) {
    if (typeof window === "undefined" ||
        typeof window.addEventListener !== "function") {
        return null;
    }
    const detach = () => {
        for (const type of UNLOCK_EVENTS) {
            window.removeEventListener(type, onGesture);
        }
    };
    const onGesture = () => {
        detach();
        void engine.unlock();
    };
    for (const type of UNLOCK_EVENTS) {
        window.addEventListener(type, onGesture, { once: true, passive: true });
    }
    return detach;
}
function monotonicNow() {
    return typeof performance !== "undefined" &&
        typeof performance.now === "function"
        ? performance.now()
        : Date.now();
}
//# sourceMappingURL=audio.js.map