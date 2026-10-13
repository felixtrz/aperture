import { createWebAudioBackend, } from "./audio-backend.js";
import { createAudioMixer, } from "./mixer.js";
import { createClipCache, } from "./clip-cache.js";
import { createVoiceManager, } from "./voice-manager.js";
export * from "./audio-backend.js";
export * from "./mixer.js";
export * from "./clip-cache.js";
export * from "./voice-manager.js";
export * from "./audio-settings.js";
export * from "./sound-board.js";
/** Ramp endpoints track main-thread frame cadence, clamped to this window. */
const MIN_RAMP_SEC = 0.008;
const MAX_RAMP_SEC = 0.05;
const DEFAULT_DUCK = {
    trigger: "voice",
    targets: ["music", "ambient"],
    depth: 0.3,
    rampSec: 0.08,
};
/**
 * Create the main-thread audio engine. Returns a discriminated result instead of
 * throwing, so a missing/blocked `AudioContext` (SSR, unsupported browser) is a
 * graceful `{ ok: false }` rather than a crash. Inject a `backend` (e.g. the
 * test fake) and it never fails. See {@link createAudioEngineOrThrow} for the
 * simple/unwrapped form.
 */
export function createAudioEngine(options = {}) {
    let backend;
    try {
        backend = options.backend ?? createWebAudioBackend(options.web ?? {});
    }
    catch (error) {
        return {
            ok: false,
            reason: "audio-context-unavailable",
            message: error instanceof Error
                ? error.message
                : "The Web Audio API is unavailable in this environment.",
        };
    }
    const resolveClip = options.resolveClip ?? (() => undefined);
    const clipListeners = new Set();
    const mixer = createAudioMixer(backend, options.mixer ?? {});
    const clips = createClipCache(backend, resolveClip);
    const voices = createVoiceManager(backend, mixer, clips, {
        ...(options.voice ?? {}),
        onSourceStart: (clipId) => emitClip("start", clipId),
        onSourceEnd: (clipId) => emitClip("end", clipId),
    });
    function emitClip(type, clipId) {
        // Tearing down the voice graph stops sources, whose `onended` fires `end`
        // events; never deliver those into a disposed engine.
        if (disposed || clipListeners.size === 0) {
            return;
        }
        const captionTrackId = resolveClip(clipId)?.captionTrackId;
        const event = {
            type,
            clipId,
            ...(captionTrackId === undefined ? {} : { captionTrackId }),
        };
        for (const listener of clipListeners) {
            listener(event);
        }
    }
    const duck = options.duck === false
        ? null
        : { ...DEFAULT_DUCK, ...(options.duck ?? {}) };
    let ducked = false;
    let disposed = false;
    let resumePending = false;
    const pausedBuses = options.pausedBuses ?? ["sfx", "voice", "ambient"];
    const engine = {
        backend,
        mixer,
        clips,
        get state() {
            return backend.state;
        },
        async unlock() {
            if (backend.state !== "running") {
                await backend.resume();
                resumePending = true;
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
                resumePending = true;
            }
        },
        applySnapshot(snapshot, frameDelta) {
            voices.apply(snapshot.audioEmitters ?? [], snapshot.transforms, snapshot.audioListener, clampRamp(frameDelta), resumePending);
            resumePending = false;
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
        get activeVoiceCount() {
            return voices.activeVoiceCount;
        },
        get activeSourceCount() {
            return voices.activeSourceCount;
        },
        get activePannerCount() {
            return voices.activePannerCount;
        },
        get virtualVoiceCount() {
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
        setMonoDownmix(mono) {
            mixer.setMonoDownmix(mono);
        },
        async enableWorkletLimiter() {
            const node = await backend.createWorkletLimiter();
            if (node === null) {
                return false;
            }
            mixer.setMasterTail(node);
            return true;
        },
        onClipEvent(listener) {
            clipListeners.add(listener);
            return () => clipListeners.delete(listener);
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
            clipListeners.clear();
            voices.dispose();
            clips.dispose();
            mixer.dispose();
        },
    };
    return { ok: true, engine };
}
/**
 * Unwrapped {@link createAudioEngine}: returns the engine directly and throws if
 * the AudioContext is unavailable. Convenient when a backend is injected (tests)
 * or when a missing context should be fatal.
 */
export function createAudioEngineOrThrow(options = {}) {
    const result = createAudioEngine(options);
    if (!result.ok) {
        throw new Error(result.message);
    }
    return result.engine;
}
function clampRamp(frameDelta) {
    if (!Number.isFinite(frameDelta) || frameDelta <= MIN_RAMP_SEC) {
        return MIN_RAMP_SEC;
    }
    return frameDelta > MAX_RAMP_SEC ? MAX_RAMP_SEC : frameDelta;
}
//# sourceMappingURL=index.js.map