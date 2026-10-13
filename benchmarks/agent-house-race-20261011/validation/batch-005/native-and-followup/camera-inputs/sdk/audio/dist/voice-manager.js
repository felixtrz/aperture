import { AUDIO_BUS_IDS } from "./mixer.js";
/** Click-free fade/stop time constant, in seconds. */
const FADE_SEC = 0.015;
/** Default cap on one-shot voices fired from a single frame's epoch delta. */
const DEFAULT_MAX_BURST = 8;
/** One-shot overflow beyond the per-frame burst is carried for up to this many
 * frames (× maxBurst) before excess is dropped, so rapid triggers aren't lost. */
const ONESHOT_BACKLOG_FRAMES = 8;
/** Default global ceiling on simultaneously-sounding real voices. */
const DEFAULT_MAX_VOICES = 32;
/** Score floor that 2D / non-spatial voices sit above any spatial voice. */
const LOCAL_BASE = 1e6;
/** Doppler model constants (speed of sound m/s; dead-zone + clamp). */
const SPEED_OF_SOUND = 343;
const DOPPLER_DEADZONE = 0.5;
const DOPPLER_MAX_RATE = 2;
const DOPPLER_MIN_RATE = 0.5;
/** Occlusion lowpass cutoff range (Hz): open at MAX, fully muffled at MIN. */
const OCCLUSION_MAX_HZ = 22000;
const OCCLUSION_MIN_HZ = 350;
const DEFAULT_LOWPASS_Q = 0.7;
/** Per-bus simultaneous-voice caps so one category can't starve another. */
const DEFAULT_BUS_CAPS = {
    music: 2,
    sfx: 12,
    ui: Number.POSITIVE_INFINITY,
    ambient: 6,
    voice: 2,
};
export function createVoiceManager(backend, mixer, clips, options = {}) {
    const real = new Map();
    const virtual = new Map();
    const spatialPool = [];
    const flatPool = [];
    const candidates = [];
    const busCounts = new Map();
    const maxBurst = Math.max(1, options.maxBurstPerFrame ?? DEFAULT_MAX_BURST);
    const maxVoices = Math.max(1, options.maxVoices ?? DEFAULT_MAX_VOICES);
    const doppler = options.doppler ?? false;
    const pitchVariation = clampNum(options.pitchVariation ?? 0, 0, 0.999);
    let audioOffset = 0;
    const busCaps = { ...DEFAULT_BUS_CAPS };
    for (const bus of AUDIO_BUS_IDS) {
        const override = options.busCaps?.[bus];
        if (override !== undefined) {
            busCaps[bus] = override;
        }
    }
    const unsubscribe = clips.onDecoded(() => flushPending());
    let disposed = false;
    let resumedFrame = false;
    let lastListenerMasterGain = Number.NaN;
    let listenerX = 0;
    let listenerY = 0;
    let listenerZ = 0;
    let hasListener = false;
    function apply(emitters, transforms, listener, frameDelta, resumed = false) {
        if (disposed) {
            return;
        }
        resumedFrame = resumed;
        updateListener(listener, transforms, frameDelta);
        // 1. Score every emitter and pick the audible set (top-N within per-bus caps).
        candidates.length = 0;
        for (const packet of emitters) {
            candidates.push({
                key: voiceKeyString(packet.key),
                packet,
                score: score(packet, transforms),
            });
        }
        candidates.sort(byScoreDesc);
        busCounts.clear();
        let realCount = 0;
        for (const voice of real.values()) {
            voice.seen = false;
        }
        for (const v of virtual.values()) {
            v.seen = false;
        }
        for (const candidate of candidates) {
            const bus = toBus(candidate.packet.busId);
            const used = busCounts.get(bus) ?? 0;
            const audible = candidate.score > Number.NEGATIVE_INFINITY &&
                realCount < maxVoices &&
                used < busCaps[bus];
            if (audible) {
                busCounts.set(bus, used + 1);
                realCount += 1;
                reconcileReal(candidate.packet, bus, transforms, frameDelta);
            }
            else {
                reconcileVirtual(candidate.packet, bus);
            }
        }
        // 2. Sweep: emitters that vanished are faded/freed; gone virtuals dropped.
        for (const voice of [...real.values()]) {
            if (!voice.seen) {
                free(voice);
            }
        }
        for (const v of [...virtual.values()]) {
            if (!v.seen) {
                virtual.delete(v.key);
            }
        }
        if (resumedFrame && canStartSources()) {
            flushPending();
        }
    }
    function score(packet, transforms) {
        if (packet.simulationSpace === "local") {
            return LOCAL_BASE + packet.priority + packet.gain;
        }
        if (!hasListener) {
            return LOCAL_BASE / 2 + packet.priority + packet.gain;
        }
        const sp = worldSamplePoint(packet, transforms);
        const dx = sp[0] - listenerX;
        const dy = sp[1] - listenerY;
        const dz = sp[2] - listenerZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > packet.maxDistance) {
            // Inaudible: never consumes a real voice (kept virtual for mid-loop resume).
            return Number.NEGATIVE_INFINITY;
        }
        // Optional tighter virtualization radius: beyond it the voice demotes to
        // virtual (still tracked, re-promotes on approach). 0 ⇒ disabled.
        const audibilityRadius = packet.audibilityRadius ?? 0;
        if (audibilityRadius > 0 && dist > audibilityRadius) {
            return Number.NEGATIVE_INFINITY;
        }
        const att = rolloff(packet.distanceModel, dist, packet.refDistance, packet.maxDistance, packet.rolloffFactor);
        // Directional cone attenuation must inform virtualization too, or a source
        // pointing away could steal a real voice from a louder on-axis source.
        return packet.gain * att * coneGain(packet, transforms) + packet.priority;
    }
    /**
     * PannerNode-equivalent directional cone gain in [coneOuterGain, 1], from the
     * angle between the source's facing (-col2) and the source→listener vector.
     * A fully-open cone (default 360°) attenuates nothing.
     */
    function coneGain(packet, transforms) {
        if (packet.coneInnerAngle >= 360) {
            return 1;
        }
        const o = packet.worldTransformOffset;
        const fx = -m(transforms, o, 8);
        const fy = -m(transforms, o, 9);
        const fz = -m(transforms, o, 10);
        const sp = worldSamplePoint(packet, transforms);
        const tx = listenerX - sp[0];
        const ty = listenerY - sp[1];
        const tz = listenerZ - sp[2];
        const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (fl === 0 || tl === 0) {
            return 1;
        }
        const cos = clampNum((fx * tx + fy * ty + fz * tz) / (fl * tl), -1, 1);
        const angle = (Math.acos(cos) * 180) / Math.PI;
        const inner = packet.coneInnerAngle / 2;
        const outer = packet.coneOuterAngle / 2;
        if (angle <= inner) {
            return 1;
        }
        if (angle >= outer || outer <= inner) {
            return packet.coneOuterGain;
        }
        return 1 + ((angle - inner) / (outer - inner)) * (packet.coneOuterGain - 1);
    }
    function updateListener(listener, transforms, frameDelta) {
        if (listener === undefined) {
            hasListener = false;
            return;
        }
        const o = listener.worldTransformOffset;
        listenerX = m(transforms, o, 12);
        listenerY = m(transforms, o, 13);
        listenerZ = m(transforms, o, 14);
        hasListener = true;
        const at = backend.currentTime + frameDelta;
        const l = backend.listener;
        // WORLD basis (not inverted view): pos=col3, fwd=-col2, up=+col1.
        ramp3(l.positionX, l.positionY, l.positionZ, listenerX, listenerY, listenerZ, at);
        ramp3(l.forwardX, l.forwardY, l.forwardZ, -m(transforms, o, 8), -m(transforms, o, 9), -m(transforms, o, 10), at);
        ramp3(l.upX, l.upY, l.upZ, m(transforms, o, 4), m(transforms, o, 5), m(transforms, o, 6), at);
        if (listener.masterGain !== lastListenerMasterGain) {
            lastListenerMasterGain = listener.masterGain;
            mixer.setMasterGain(listener.masterGain, FADE_SEC);
        }
    }
    function reconcileReal(packet, bus, transforms, frameDelta) {
        const key = voiceKeyString(packet.key);
        const clipId = clipKeyOf(packet);
        let voice = real.get(key);
        const promotion = virtual.get(key);
        const firstSight = voice === undefined;
        if (voice === undefined) {
            voice = acquireVoice(packet.simulationSpace === "world", bus);
            voice.key = key;
            voice.busId = bus;
            voice.clipId = clipId;
            voice.clipVersion = packet.clipVersion;
            voice.offsetSec = packet.offsetSec;
            voice.loop = packet.loop;
            if (promotion !== undefined) {
                // Promote a demoted voice: resume epochs + mid-loop playhead.
                voice.realizedEpoch = promotion.realizedEpoch;
                voice.realizedStopEpoch = promotion.realizedStopEpoch;
                voice.loopStartedAt = promotion.loopStartedAt;
                voice.loopLenSec = promotion.loopLenSec;
                virtual.delete(key);
            }
            else {
                voice.realizedEpoch = packet.playEpoch;
                voice.realizedStopEpoch = packet.stopEpoch;
                voice.loopStartedAt = 0;
                voice.loopLenSec = 0;
            }
            real.set(key, voice);
            voice.gain.gain.cancelScheduledValues(backend.currentTime);
            voice.gain.gain.setValueAtTime(packet.muted ? 0 : packet.gain, backend.currentTime);
        }
        voice.seen = true;
        voice.loop = packet.loop;
        voice.clipId = clipId;
        voice.clipVersion = packet.clipVersion;
        voice.offsetSec = packet.offsetSec;
        voice.loopStart = packet.loopStart;
        voice.loopEnd = packet.loopEnd;
        voice.timeScale = packet.timeScale;
        voice.seedPitch = seedPitchMultiplier(packet.seed ?? 1, pitchVariation);
        // On resume, re-seed epochs so a backlog of triggers accumulated while
        // suspended doesn't blast a burst of stale one-shots; playing loops keep
        // running with the resumed context clock.
        if (resumedFrame) {
            voice.pendingOneShots = 0;
        }
        if (resumedFrame && !firstSight) {
            voice.realizedEpoch = packet.playEpoch;
            voice.realizedStopEpoch = packet.stopEpoch;
        }
        if (!firstSight) {
            voice.gain.gain.setTargetAtTime(packet.muted ? 0 : packet.gain, backend.currentTime, FADE_SEC);
        }
        if (signedDelta(packet.stopEpoch, voice.realizedStopEpoch) > 0) {
            voice.realizedStopEpoch = packet.stopEpoch;
            fadeStopSources(voice);
        }
        const playDelta = signedDelta(packet.playEpoch, voice.realizedEpoch);
        voice.realizedEpoch = packet.playEpoch;
        const streamUrl = clips.streamingUrl(voice.clipId);
        if (streamUrl !== undefined) {
            const shouldStartStream = canStartSources() &&
                ((firstSight && (packet.autoplay || promotion !== undefined)) ||
                    (resumedFrame && packet.autoplay) ||
                    playDelta > 0);
            if (shouldStartStream && voice.stream === null) {
                startStreaming(voice, streamUrl, packet.loop);
            }
        }
        else if (voice.loop) {
            const wantLoop = canStartSources() &&
                ((firstSight && (packet.autoplay || promotion !== undefined)) ||
                    (resumedFrame && packet.autoplay) ||
                    playDelta > 0) &&
                voice.looping === null &&
                !voice.pendingLoop;
            if (wantLoop) {
                startLoop(voice, firstSight && promotion !== undefined);
            }
        }
        else {
            let toFire = playDelta > 0 ? playDelta : 0;
            if (firstSight && packet.autoplay && promotion === undefined) {
                toFire = Math.max(toFire, 1);
            }
            const fired = Math.min(toFire, maxBurst);
            for (let index = 0; index < fired; index += 1) {
                startOneShot(voice);
            }
            // Carry the overflow beyond this frame's burst to subsequent frames
            // instead of dropping it, so a multi-trigger spike is not silently lost.
            // Bounded so a pathological emitter cannot accumulate an unbounded backlog.
            const overflow = Math.min(Math.max(0, toFire - fired), maxBurst * ONESHOT_BACKLOG_FRAMES);
            if (overflow > 0) {
                voice.realizedEpoch = (packet.playEpoch - overflow) | 0;
            }
        }
        if (voice.panner !== null) {
            updatePanner(voice.panner, packet, transforms, frameDelta);
        }
        applyPlaybackRate(voice, packet, transforms, frameDelta);
        const occlusion = Number.isFinite(packet.occlusion) ? packet.occlusion : 0;
        const occlusionCutoff = OCCLUSION_MAX_HZ -
            (OCCLUSION_MAX_HZ - OCCLUSION_MIN_HZ) * clampNum(occlusion, 0, 1);
        const authoredCutoff = Number.isFinite(packet.lowpassFrequency)
            ? clampNum(packet.lowpassFrequency, OCCLUSION_MIN_HZ, OCCLUSION_MAX_HZ)
            : OCCLUSION_MAX_HZ;
        const cutoff = Math.min(authoredCutoff, occlusionCutoff);
        const q = Number.isFinite(packet.lowpassQ)
            ? clampNum(packet.lowpassQ, 0.0001, 1000)
            : DEFAULT_LOWPASS_Q;
        voice.occluder.frequency.linearRampToValueAtTime(cutoff, backend.currentTime + frameDelta);
        voice.occluder.Q.linearRampToValueAtTime(q, backend.currentTime + frameDelta);
    }
    function reconcileVirtual(packet, bus) {
        const key = voiceKeyString(packet.key);
        const demoted = real.get(key);
        let v = virtual.get(key);
        if (demoted !== undefined) {
            // Demote a real voice to node-less, retaining loop playhead.
            v = {
                key,
                busId: bus,
                realizedEpoch: demoted.realizedEpoch,
                realizedStopEpoch: demoted.realizedStopEpoch,
                loop: demoted.loop,
                clipId: demoted.clipId,
                clipVersion: demoted.clipVersion,
                offsetSec: demoted.offsetSec,
                loopStartedAt: demoted.loopStartedAt,
                loopLenSec: demoted.loopLenSec,
                seen: true,
            };
            virtual.set(key, v);
            free(demoted);
            return;
        }
        if (v === undefined) {
            v = {
                key,
                busId: bus,
                realizedEpoch: packet.playEpoch,
                realizedStopEpoch: packet.stopEpoch,
                loop: packet.loop,
                clipId: clipKeyOf(packet),
                clipVersion: packet.clipVersion,
                offsetSec: packet.offsetSec,
                loopStartedAt: backend.currentTime,
                loopLenSec: 0,
                seen: true,
            };
            virtual.set(key, v);
            return;
        }
        // Track epochs while virtual so a promotion doesn't back-fire or miss a stop.
        v.seen = true;
        v.realizedEpoch = packet.playEpoch;
        v.realizedStopEpoch = packet.stopEpoch;
        v.loop = packet.loop;
    }
    function acquireVoice(spatial, bus) {
        const pool = spatial ? spatialPool : flatPool;
        const pooled = pool.pop();
        if (pooled !== undefined) {
            pooled.gain.connect(mixer.busInput(bus));
            pooled.fadingOut = false;
            pooled.pendingLoop = false;
            pooled.pendingOneShots = 0;
            pooled.looping = null;
            pooled.prevDist = Number.NaN;
            return pooled;
        }
        const gain = backend.createGain();
        let panner = null;
        if (spatial) {
            panner = backend.createPanner();
            panner.connect(gain);
        }
        const occluder = backend.createBiquad();
        occluder.type = "lowpass";
        occluder.frequency.value = OCCLUSION_MAX_HZ;
        occluder.connect(panner ?? gain);
        gain.connect(mixer.busInput(bus));
        return {
            key: "",
            busId: bus,
            gain,
            panner,
            occluder,
            stream: null,
            sources: new Set(),
            looping: null,
            realizedEpoch: 0,
            realizedStopEpoch: 0,
            loop: false,
            clipId: "",
            clipVersion: 0,
            offsetSec: 0,
            loopStart: 0,
            loopEnd: 0,
            timeScale: 1,
            seedPitch: 1,
            prevDist: Number.NaN,
            loopStartedAt: 0,
            loopLenSec: 0,
            pendingLoop: false,
            pendingOneShots: 0,
            seen: true,
            fadingOut: false,
        };
    }
    function startLoop(voice, resume) {
        if (!canStartSources()) {
            return;
        }
        const buffer = clips.acquire(voice.clipId, voice.clipVersion);
        if (buffer === undefined) {
            voice.pendingLoop = true;
            return;
        }
        let offset = voice.offsetSec;
        if (resume && voice.loopLenSec > 0) {
            const elapsed = backend.currentTime - voice.loopStartedAt + voice.offsetSec;
            offset =
                ((elapsed % voice.loopLenSec) + voice.loopLenSec) % voice.loopLenSec;
        }
        else {
            voice.loopStartedAt = backend.currentTime - voice.offsetSec;
        }
        voice.loopLenSec = buffer.duration;
        const source = newSource(voice, buffer, true);
        source.start(backend.currentTime + audioOffset, offset);
        voice.sources.add(source);
        voice.looping = source;
    }
    function startStreaming(voice, url, loop) {
        if (!canStartSources()) {
            return;
        }
        const stream = backend.createStreamingSource(url);
        stream.node.connect(voice.occluder);
        stream.setLoop(loop);
        stream.play();
        voice.stream = stream;
    }
    function startOneShot(voice) {
        if (!canStartSources()) {
            return;
        }
        const buffer = clips.acquire(voice.clipId, voice.clipVersion);
        if (buffer === undefined) {
            voice.pendingOneShots = Math.min(voice.pendingOneShots + 1, maxBurst);
            return;
        }
        const source = newSource(voice, buffer, false);
        source.start(backend.currentTime + audioOffset, voice.offsetSec);
        voice.sources.add(source);
    }
    function newSource(voice, buffer, loop) {
        const source = backend.createSource();
        source.buffer = buffer;
        source.loop = loop;
        // Authored loop window (three.js parity): only when a real sub-buffer region
        // was specified (loopEnd > loopStart); otherwise loop the whole buffer.
        if (loop && voice.loopEnd > voice.loopStart) {
            source.loopStart = voice.loopStart;
            source.loopEnd = voice.loopEnd;
        }
        source.playbackRate.value = voice.timeScale * voice.seedPitch;
        source.connect(voice.occluder);
        const clipId = voice.clipId;
        source.onended = () => {
            voice.sources.delete(source);
            if (voice.looping === source) {
                voice.looping = null;
            }
            options.onSourceEnd?.(clipId);
            if (voice.fadingOut && voice.sources.size === 0) {
                recycle(voice);
            }
        };
        options.onSourceStart?.(voice.clipId);
        return source;
    }
    function flushPending() {
        if (disposed || !canStartSources()) {
            return;
        }
        for (const voice of real.values()) {
            if (voice.fadingOut) {
                continue;
            }
            if (voice.pendingLoop && voice.looping === null) {
                voice.pendingLoop = false;
                startLoop(voice, false);
            }
            while (voice.pendingOneShots > 0) {
                const before = voice.sources.size;
                voice.pendingOneShots -= 1;
                startOneShot(voice);
                if (voice.sources.size === before) {
                    voice.pendingOneShots += 1;
                    break;
                }
            }
        }
    }
    function fadeStopSources(voice) {
        if (voice.sources.size === 0 && voice.stream === null) {
            voice.looping = null;
            return;
        }
        const now = backend.currentTime;
        const stopAt = now + FADE_SEC;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, stopAt);
        for (const source of voice.sources) {
            safeStop(source, stopAt);
        }
        if (voice.stream !== null) {
            voice.stream.stop();
            voice.stream.node.disconnect();
            voice.stream = null;
        }
        voice.looping = null;
    }
    function free(voice) {
        real.delete(voice.key);
        voice.fadingOut = true;
        voice.pendingLoop = false;
        voice.pendingOneShots = 0;
        if (voice.sources.size === 0) {
            // No buffer sources to wait on (silent or streaming): stop + recycle now.
            fadeStopSources(voice);
            recycle(voice);
            return;
        }
        fadeStopSources(voice);
    }
    /** Return a freed voice's persistent subgraph to the pool (AU-8). */
    function recycle(voice) {
        if (voice.stream !== null) {
            voice.stream.stop();
            voice.stream.node.disconnect();
            voice.stream = null;
        }
        if (disposed) {
            voice.gain.disconnect();
            voice.panner?.disconnect();
            voice.occluder.disconnect();
            return;
        }
        voice.gain.disconnect();
        voice.sources.clear();
        voice.looping = null;
        (voice.panner !== null ? spatialPool : flatPool).push(voice);
    }
    /**
     * Authored `timeScale` (and, when enabled, auto-Doppler from radial velocity)
     * applied to every live source's `playbackRate`. Doppler has a dead-zone +
     * clamp so a near-stationary source produces no warble; static sources keep
     * `timeScale`. Doppler never feeds the deterministic sim completion timer.
     */
    function applyPlaybackRate(voice, packet, transforms, frameDelta) {
        // Effective base rate = authored timeScale × the deterministic per-seed
        // variation (seedPitch is 1 unless the engine's pitchVariation is enabled).
        const base = voice.timeScale * voice.seedPitch;
        let rate = base;
        if (doppler && voice.panner !== null && hasListener && frameDelta > 0) {
            const sp = worldSamplePoint(packet, transforms);
            const dx = sp[0] - listenerX;
            const dy = sp[1] - listenerY;
            const dz = sp[2] - listenerZ;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (Number.isFinite(voice.prevDist)) {
                let radial = (dist - voice.prevDist) / frameDelta;
                if (Math.abs(radial) < DOPPLER_DEADZONE) {
                    radial = 0;
                }
                radial = clampNum(radial, -SPEED_OF_SOUND * 0.5, SPEED_OF_SOUND * 0.5);
                const shift = SPEED_OF_SOUND / (SPEED_OF_SOUND + radial);
                rate = base * clampNum(shift, DOPPLER_MIN_RATE, DOPPLER_MAX_RATE);
            }
            voice.prevDist = dist;
        }
        const at = backend.currentTime + frameDelta;
        for (const source of voice.sources) {
            source.playbackRate.linearRampToValueAtTime(rate, at);
        }
    }
    /** Per-frame spatial update — zero allocation. */
    function updatePanner(panner, packet, transforms, frameDelta) {
        const o = packet.worldTransformOffset;
        const at = backend.currentTime + frameDelta;
        const sp = worldSamplePoint(packet, transforms);
        ramp3(panner.positionX, panner.positionY, panner.positionZ, sp[0], sp[1], sp[2], at);
        // Source faces world forward = -col2 (same basis as the listener).
        ramp3(panner.orientationX, panner.orientationY, panner.orientationZ, -m(transforms, o, 8), -m(transforms, o, 9), -m(transforms, o, 10), at);
        panner.panningModel = packet.panningModel;
        panner.distanceModel = packet.distanceModel;
        panner.refDistance = packet.refDistance;
        panner.maxDistance = packet.maxDistance;
        panner.rolloffFactor = packet.rolloffFactor;
        panner.coneInnerAngle = packet.coneInnerAngle;
        panner.coneOuterAngle = packet.coneOuterAngle;
        panner.coneOuterGain = packet.coneOuterGain;
    }
    return {
        apply,
        get activeVoiceCount() {
            return real.size;
        },
        get activeSourceCount() {
            let total = 0;
            for (const voice of real.values()) {
                total += voice.sources.size;
            }
            return total;
        },
        get activePannerCount() {
            let total = 0;
            for (const voice of real.values()) {
                if (voice.panner !== null) {
                    total += 1;
                }
            }
            return total;
        },
        get virtualVoiceCount() {
            return virtual.size;
        },
        busActive(bus) {
            for (const voice of real.values()) {
                if (voice.busId === bus &&
                    !voice.fadingOut &&
                    (canStartSources() || voice.sources.size > 0 || voice.stream !== null)) {
                    return true;
                }
            }
            return false;
        },
        setAudioOffset(seconds) {
            audioOffset = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            unsubscribe();
            for (const voice of [...real.values()]) {
                for (const source of voice.sources) {
                    safeStop(source, backend.currentTime);
                }
                voice.stream?.stop();
                voice.stream?.node.disconnect();
                voice.gain.disconnect();
                voice.panner?.disconnect();
                voice.occluder.disconnect();
            }
            real.clear();
            virtual.clear();
            spatialPool.length = 0;
            flatPool.length = 0;
        },
    };
    function canStartSources() {
        return backend.state === "running";
    }
}
function byScoreDesc(a, b) {
    return b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
function voiceKeyString(key) {
    return key.kind === "entity" ? `e:${key.id}` : `o:${key.seq}`;
}
function clipKeyOf(packet) {
    return `${packet.clip.kind}:${packet.clip.id}`;
}
function toBus(busId) {
    return AUDIO_BUS_IDS.includes(busId)
        ? busId
        : "sfx";
}
/** Web Audio distance-model attenuation in [0,1]. */
function rolloff(model, dist, ref, max, factor) {
    const d = Math.max(dist, ref);
    if (model === "linear") {
        const denom = Math.max(1e-6, max - ref);
        return Math.max(0, 1 - (factor * (Math.min(d, max) - ref)) / denom);
    }
    if (model === "exponential") {
        return Math.pow(d / ref, -factor);
    }
    return ref / (ref + factor * (d - ref));
}
/** 32-bit wrapping signed difference, for monotonic Int32 epoch counters. */
function signedDelta(current, realized) {
    return (current - realized) | 0;
}
function clampNum(value, min, max) {
    return value < min ? min : value > max ? max : value;
}
/**
 * Deterministic per-seed pitch multiplier in `[1 − range, 1 + range)`. A Knuth
 * multiplicative hash maps the Int32 seed to `[0, 1)`; `range` 0 returns exactly
 * 1, so the default (variation off) never perturbs playbackRate.
 */
function seedPitchMultiplier(seed, range) {
    if (range <= 0) {
        return 1;
    }
    const normalized = ((Math.trunc(seed) * 2654435761) >>> 0) / 4294967296;
    return 1 + (normalized * 2 - 1) * range;
}
function m(transforms, offset, index) {
    return transforms[offset + index] ?? 0;
}
/** Reused scratch for {@link worldSamplePoint} — single-threaded, read immediately. */
const SAMPLE_SCRATCH = [0, 0, 0];
/**
 * The emitter's world-space audibility/emission point: its world translation
 * plus the authored local `boundsCenter` rotated into world space. Default
 * `boundsCenter` (origin) returns the translation unchanged. Writes and returns
 * a shared scratch array — copy the values out before the next call.
 */
function worldSamplePoint(packet, transforms) {
    const o = packet.worldTransformOffset;
    const bc = packet.boundsCenter;
    const bx = bc?.[0] ?? 0;
    const by = bc?.[1] ?? 0;
    const bz = bc?.[2] ?? 0;
    if (bx === 0 && by === 0 && bz === 0) {
        SAMPLE_SCRATCH[0] = m(transforms, o, 12);
        SAMPLE_SCRATCH[1] = m(transforms, o, 13);
        SAMPLE_SCRATCH[2] = m(transforms, o, 14);
    }
    else {
        SAMPLE_SCRATCH[0] =
            m(transforms, o, 12) +
                bx * m(transforms, o, 0) +
                by * m(transforms, o, 4) +
                bz * m(transforms, o, 8);
        SAMPLE_SCRATCH[1] =
            m(transforms, o, 13) +
                bx * m(transforms, o, 1) +
                by * m(transforms, o, 5) +
                bz * m(transforms, o, 9);
        SAMPLE_SCRATCH[2] =
            m(transforms, o, 14) +
                bx * m(transforms, o, 2) +
                by * m(transforms, o, 6) +
                bz * m(transforms, o, 10);
    }
    return SAMPLE_SCRATCH;
}
function ramp3(x, y, z, vx, vy, vz, at) {
    x.linearRampToValueAtTime(vx, at);
    y.linearRampToValueAtTime(vy, at);
    z.linearRampToValueAtTime(vz, at);
}
function safeStop(source, when) {
    try {
        source.stop(when);
    }
    catch {
        // Already stopped / never started — ignore.
    }
}
//# sourceMappingURL=voice-manager.js.map