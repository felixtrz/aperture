export const AUDIO_BUS_IDS = [
    "music",
    "sfx",
    "ui",
    "ambient",
    "voice",
];
/** Default click-free ramp, in seconds, for gain changes. */
const DEFAULT_RAMP_SEC = 0.015;
/**
 * Build the bus graph:
 *
 * ```
 * voice ─► busGain ─► busAnalyser ─┐
 *                                  ├─► masterGain ─► masterAnalyser ─► limiter ─► destination
 * (one branch per bus) ────────────┘
 * ```
 *
 * The trailing `DynamicsCompressorNode` acts as a brick-wall-ish master limiter
 * so summed over-unity content cannot clip the device. The analyser taps pass
 * audio through unchanged and exist only to expose frequency data.
 */
export function createAudioMixer(backend, options = {}) {
    const fftSize = options.analyserFftSize ?? 2048;
    const masterGainNode = backend.createGain();
    const masterAnalyser = backend.createAnalyser();
    masterAnalyser.fftSize = fftSize;
    const limiter = backend.createCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    masterGainNode.connect(masterAnalyser);
    masterAnalyser.connect(limiter);
    limiter.connect(backend.destination);
    const busGainNodes = new Map();
    const busAnalysers = new Map();
    const busTargets = new Map();
    for (const bus of AUDIO_BUS_IDS) {
        const gain = backend.createGain();
        const analyser = backend.createAnalyser();
        analyser.fftSize = fftSize;
        gain.connect(analyser);
        analyser.connect(masterGainNode);
        const initial = clampGain(options.busGains?.[bus] ?? 1);
        gain.gain.value = initial;
        busGainNodes.set(bus, gain);
        busAnalysers.set(bus, analyser);
        busTargets.set(bus, initial);
    }
    // Ducking multiplier per bus, composed with the authored gain so dialogue
    // sidechain ducking and authored volume don't clobber each other.
    const duckFactors = new Map();
    const pauseFactors = new Map();
    for (const bus of AUDIO_BUS_IDS) {
        duckFactors.set(bus, 1);
        pauseFactors.set(bus, 1);
    }
    // Dual `music` sub-buses for equal-power track crossfades; both sum into the
    // single `music` bus gain. Start fully on A.
    const musicBusGain = busGainNodes.get("music");
    const musicA = backend.createGain();
    const musicB = backend.createGain();
    musicA.connect(musicBusGain);
    musicB.connect(musicBusGain);
    musicA.gain.value = 1;
    musicB.gain.value = 0;
    let masterTarget = clampGain(options.masterGain ?? 1);
    masterGainNode.gain.value = masterTarget;
    let masterTail = null;
    let disposed = false;
    function requireBusGain(bus) {
        const node = busGainNodes.get(bus);
        if (node === undefined) {
            throw new RangeError(`Unknown audio bus '${bus}'.`);
        }
        return node;
    }
    function busEffective(bus) {
        return ((busTargets.get(bus) ?? 0) *
            (duckFactors.get(bus) ?? 1) *
            (pauseFactors.get(bus) ?? 1));
    }
    return {
        busInput(bus) {
            return requireBusGain(bus);
        },
        setMasterGain(value, rampSec = DEFAULT_RAMP_SEC) {
            masterTarget = clampGain(value);
            rampParam(masterGainNode.gain, backend.currentTime, masterTarget, rampSec);
        },
        setBusGain(bus, value, rampSec = DEFAULT_RAMP_SEC) {
            busTargets.set(bus, clampGain(value));
            rampParam(requireBusGain(bus).gain, backend.currentTime, busEffective(bus), rampSec);
        },
        setMonoDownmix(mono) {
            masterGainNode.channelCount = mono ? 1 : 2;
            masterGainNode.channelCountMode = mono ? "explicit" : "max";
        },
        setMasterTail(node) {
            limiter.disconnect();
            masterTail?.disconnect();
            masterTail = node;
            if (node !== null) {
                limiter.connect(node);
                node.connect(backend.destination);
            }
            else {
                limiter.connect(backend.destination);
            }
        },
        getMasterGain() {
            return masterTarget;
        },
        getBusGain(bus) {
            return busTargets.get(bus) ?? 0;
        },
        duckBus(bus, factor, rampSec = DEFAULT_RAMP_SEC) {
            duckFactors.set(bus, clampGain(factor));
            rampParam(requireBusGain(bus).gain, backend.currentTime, busEffective(bus), rampSec);
        },
        setBusPause(bus, factor, rampSec = DEFAULT_RAMP_SEC) {
            pauseFactors.set(bus, clampGain(factor));
            rampParam(requireBusGain(bus).gain, backend.currentTime, busEffective(bus), rampSec);
        },
        musicSubInput(slot) {
            return slot === "b" ? musicB : musicA;
        },
        setMusicCrossfade(t, rampSec = DEFAULT_RAMP_SEC) {
            const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
            const now = backend.currentTime;
            // Equal-power: |A|^2 + |B|^2 = 1 across the sweep.
            rampParam(musicA.gain, now, Math.cos((clamped * Math.PI) / 2), rampSec);
            rampParam(musicB.gain, now, Math.sin((clamped * Math.PI) / 2), rampSec);
        },
        analyser(target) {
            if (target === "master") {
                return masterAnalyser;
            }
            const node = busAnalysers.get(target);
            if (node === undefined) {
                throw new RangeError(`Unknown audio bus '${target}'.`);
            }
            return node;
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            musicA.disconnect();
            musicB.disconnect();
            for (const gain of busGainNodes.values()) {
                gain.disconnect();
            }
            for (const analyser of busAnalysers.values()) {
                analyser.disconnect();
            }
            masterGainNode.disconnect();
            masterAnalyser.disconnect();
            limiter.disconnect();
            masterTail?.disconnect();
        },
    };
}
/**
 * Click-free parameter move: pin the current value at `now`, then ramp to the
 * target. A non-positive `rampSec` is an explicit instantaneous set.
 */
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
function clampGain(value) {
    if (value < 0) {
        return 0;
    }
    // Coerce NaN / +Infinity to unity gain rather than poisoning the graph.
    return Number.isFinite(value) ? value : 1;
}
//# sourceMappingURL=mixer.js.map