import { createWebAudioBackend, } from "./audio-backend.js";
import { createAudioMixer, } from "./mixer.js";
const DEFAULT_RAMP_SEC = 0.03;
const DEFAULT_STOP_FADE_SEC = 0.015;
const DEFAULT_LOWPASS_Q = 0.7;
const DEFAULT_LOWPASS_FREQUENCY = 22000;
const FIRST_GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"];
export function createAudioSoundBoard(options = {}) {
    let backend;
    const ownsBackend = options.backend === undefined;
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
    const mixer = options.mixer ?? createAudioMixer(backend, options.mixerOptions);
    const closeBackendOnDispose = options.closeBackendOnDispose ?? ownsBackend;
    const clipSources = new Map(Object.entries(options.clips ?? {}));
    const clipCache = new Map();
    const pendingClips = new Map();
    const activeLoops = new Set();
    const fetchSource = options.fetch ?? globalThis.fetch?.bind(globalThis);
    let disposed = false;
    async function loadClip(id) {
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
        }
        finally {
            pendingClips.delete(id);
        }
    }
    async function decodeClip(id) {
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
    async function fetchAndDecode(url) {
        if (fetchSource === undefined) {
            return null;
        }
        try {
            const response = await fetchSource(url);
            if (!response.ok) {
                return null;
            }
            return backend.decode(await response.arrayBuffer());
        }
        catch {
            return null;
        }
    }
    const soundBoard = {
        backend,
        mixer,
        get state() {
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
            const voice = new ManagedLoopVoice(backend, mixer, clipId, buffer, loopOptions, () => activeLoops.delete(voice));
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
export function createAudioSoundBoardOrThrow(options = {}) {
    const result = createAudioSoundBoard(options);
    if (!result.ok) {
        throw new Error(result.message);
    }
    return result.soundBoard;
}
export function createFirstAudioGestureStarter(target, start) {
    let disposed = false;
    let started = false;
    const listener = () => {
        if (disposed || started) {
            return;
        }
        started = true;
        remove();
        void start();
    };
    function remove() {
        for (const event of FIRST_GESTURE_EVENTS) {
            target.removeEventListener(event, listener);
        }
    }
    for (const event of FIRST_GESTURE_EVENTS) {
        target.addEventListener(event, listener, { once: false });
    }
    return {
        get started() {
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
class ManagedLoopVoice {
    backend;
    clipId;
    bus;
    gain;
    source;
    lowpass;
    onDispose;
    stoppedValue = false;
    constructor(backend, mixer, clipId, buffer, options, onDispose) {
        this.backend = backend;
        this.clipId = clipId;
        this.bus = options.bus ?? "sfx";
        this.onDispose = onDispose;
        this.gain = backend.createGain();
        this.gain.gain.value = clampGain(options.gain ?? 0);
        this.source = backend.createSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.source.playbackRate.value = clampPlaybackRate(options.playbackRate ?? 1);
        this.lowpass = createLowpass(backend, options.lowpass);
        if (this.lowpass !== null) {
            this.source.connect(this.lowpass);
            this.lowpass.connect(this.gain);
        }
        else {
            this.source.connect(this.gain);
        }
        this.gain.connect(mixer.busInput(this.bus));
        this.source.onended = () => this.dispose();
        this.source.start();
    }
    get stopped() {
        return this.stoppedValue;
    }
    setGain(value, rampSec = DEFAULT_RAMP_SEC) {
        if (this.stoppedValue) {
            return;
        }
        rampParam(this.gain.gain, this.backend.currentTime, clampGain(value), rampSec);
    }
    setPlaybackRate(value, rampSec = DEFAULT_RAMP_SEC) {
        if (this.stoppedValue) {
            return;
        }
        rampParam(this.source.playbackRate, this.backend.currentTime, clampPlaybackRate(value), rampSec);
    }
    setLowpassFrequency(value, timeConstant = 0.05) {
        if (this.stoppedValue || this.lowpass === null) {
            return;
        }
        this.lowpass.frequency.setTargetAtTime(clampFrequency(value), this.backend.currentTime, Math.max(0, timeConstant));
    }
    stop(fadeSec = DEFAULT_STOP_FADE_SEC) {
        if (this.stoppedValue) {
            return;
        }
        const now = this.backend.currentTime;
        const stopAt = now + Math.max(0, fadeSec);
        rampParam(this.gain.gain, now, 0, fadeSec);
        safeStop(this.source, stopAt);
        this.stoppedValue = true;
    }
    dispose() {
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
function startOneShot(backend, mixer, clipId, buffer, options) {
    const gain = backend.createGain();
    const source = backend.createSource();
    source.buffer = buffer;
    source.playbackRate.value = clampPlaybackRate(options.playbackRate ?? 1);
    gain.gain.value = clampGain(options.gain ?? 1);
    let lowpass = null;
    if (options.lowpassFrequency !== undefined) {
        lowpass = backend.createBiquad();
        lowpass.type = "lowpass";
        lowpass.Q.value = DEFAULT_LOWPASS_Q;
        lowpass.frequency.value = clampFrequency(options.lowpassFrequency);
        source.connect(lowpass);
        lowpass.connect(gain);
    }
    else {
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
function createLowpass(backend, options) {
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
function rampParam(param, now, target, rampSec) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    if (rampSec <= 0) {
        param.setValueAtTime(target, now);
    }
    else {
        param.linearRampToValueAtTime(target, now + rampSec);
    }
}
function safeStop(source, when) {
    try {
        source.stop(when);
    }
    catch {
        // BufferSource.stop throws when called before start or after a previous stop.
    }
}
function clampGain(value) {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.max(0, value);
}
function clampPlaybackRate(value) {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.max(0.0001, value);
}
function clampFrequency(value) {
    if (!Number.isFinite(value)) {
        return DEFAULT_LOWPASS_FREQUENCY;
    }
    return Math.max(10, value);
}
//# sourceMappingURL=sound-board.js.map