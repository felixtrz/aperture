import type { AudioBackend } from "./audio-backend.js";

/**
 * The fixed submix buses. Voices route into a bus by id; the bus sums into the
 * master chain. Mirrors the named-bus model in the audio plan (music/sfx/ui/
 * ambient/voice). User-defined buses are deferred; a dual A/B `music` sub-bus
 * for crossfade lands with the music state machine (AU-11).
 */
export type AudioBusId = "music" | "sfx" | "ui" | "ambient" | "voice";

export const AUDIO_BUS_IDS: readonly AudioBusId[] = [
  "music",
  "sfx",
  "ui",
  "ambient",
  "voice",
];

export type AudioAnalyserTarget = AudioBusId | "master";

/** The two `music` sub-buses used for equal-power track crossfades. */
export type MusicSlot = "a" | "b";

/** Default click-free ramp, in seconds, for gain changes. */
const DEFAULT_RAMP_SEC = 0.015;

export interface AudioMixerOptions {
  readonly masterGain?: number;
  readonly busGains?: Partial<Record<AudioBusId, number>>;
  readonly analyserFftSize?: number;
}

export interface AudioMixer {
  /** The node a voice connects into to play on the given bus. */
  busInput(bus: AudioBusId): AudioNode;
  /** Set master gain with a click-free ramp (instant when `rampSec <= 0`). */
  setMasterGain(value: number, rampSec?: number): void;
  /** Collapse the master output to mono (accessibility) or restore stereo. */
  setMonoDownmix(mono: boolean): void;
  /** Set a bus gain with a click-free ramp (instant when `rampSec <= 0`). */
  setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
  getMasterGain(): number;
  getBusGain(bus: AudioBusId): number;
  /**
   * Apply a ducking multiplier to a bus (composed with its authored gain), e.g.
   * duck `music` to 0.25 while dialogue plays, then `duckBus(bus, 1)` to recover.
   */
  duckBus(bus: AudioBusId, factor: number, rampSec?: number): void;
  /**
   * Independent pause multiplier for a bus (composed with authored gain + duck).
   * Game-pause sets it to 0 on sfx/voice/ambient while music/ui keep playing.
   */
  setBusPause(bus: AudioBusId, factor: number, rampSec?: number): void;
  /** Node a music track routes into to play on the given crossfade sub-bus. */
  musicSubInput(slot: MusicSlot): AudioNode;
  /**
   * Equal-power crossfade between the two music sub-buses. `t=0` is fully A,
   * `t=1` fully B; the summed power stays ~constant across the sweep.
   */
  setMusicCrossfade(t: number, rampSec?: number): void;
  /** FFT tap for a bus or the summed master, for visualizers/diagnostics. */
  analyser(target: AudioAnalyserTarget): AnalyserNode;
  dispose(): void;
}

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
export function createAudioMixer(
  backend: AudioBackend,
  options: AudioMixerOptions = {},
): AudioMixer {
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

  const busGainNodes = new Map<AudioBusId, GainNode>();
  const busAnalysers = new Map<AudioBusId, AnalyserNode>();
  const busTargets = new Map<AudioBusId, number>();

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
  const duckFactors = new Map<AudioBusId, number>();
  const pauseFactors = new Map<AudioBusId, number>();
  for (const bus of AUDIO_BUS_IDS) {
    duckFactors.set(bus, 1);
    pauseFactors.set(bus, 1);
  }

  // Dual `music` sub-buses for equal-power track crossfades; both sum into the
  // single `music` bus gain. Start fully on A.
  const musicBusGain = busGainNodes.get("music") as GainNode;
  const musicA = backend.createGain();
  const musicB = backend.createGain();
  musicA.connect(musicBusGain);
  musicB.connect(musicBusGain);
  musicA.gain.value = 1;
  musicB.gain.value = 0;

  let masterTarget = clampGain(options.masterGain ?? 1);
  masterGainNode.gain.value = masterTarget;

  let disposed = false;

  function requireBusGain(bus: AudioBusId): GainNode {
    const node = busGainNodes.get(bus);
    if (node === undefined) {
      throw new RangeError(`Unknown audio bus '${bus}'.`);
    }
    return node;
  }

  function busEffective(bus: AudioBusId): number {
    return (
      (busTargets.get(bus) ?? 0) *
      (duckFactors.get(bus) ?? 1) *
      (pauseFactors.get(bus) ?? 1)
    );
  }

  return {
    busInput(bus) {
      return requireBusGain(bus);
    },
    setMasterGain(value, rampSec = DEFAULT_RAMP_SEC) {
      masterTarget = clampGain(value);
      rampParam(
        masterGainNode.gain,
        backend.currentTime,
        masterTarget,
        rampSec,
      );
    },
    setBusGain(bus, value, rampSec = DEFAULT_RAMP_SEC) {
      busTargets.set(bus, clampGain(value));
      rampParam(
        requireBusGain(bus).gain,
        backend.currentTime,
        busEffective(bus),
        rampSec,
      );
    },
    setMonoDownmix(mono) {
      masterGainNode.channelCount = mono ? 1 : 2;
      masterGainNode.channelCountMode = mono ? "explicit" : "max";
    },
    getMasterGain() {
      return masterTarget;
    },
    getBusGain(bus) {
      return busTargets.get(bus) ?? 0;
    },
    duckBus(bus, factor, rampSec = DEFAULT_RAMP_SEC) {
      duckFactors.set(bus, clampGain(factor));
      rampParam(
        requireBusGain(bus).gain,
        backend.currentTime,
        busEffective(bus),
        rampSec,
      );
    },
    setBusPause(bus, factor, rampSec = DEFAULT_RAMP_SEC) {
      pauseFactors.set(bus, clampGain(factor));
      rampParam(
        requireBusGain(bus).gain,
        backend.currentTime,
        busEffective(bus),
        rampSec,
      );
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
    },
  };
}

/**
 * Click-free parameter move: pin the current value at `now`, then ramp to the
 * target. A non-positive `rampSec` is an explicit instantaneous set.
 */
function rampParam(
  param: AudioParam,
  now: number,
  target: number,
  rampSec: number,
): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (rampSec <= 0) {
    param.setValueAtTime(target, now);
  } else {
    param.linearRampToValueAtTime(target, now + rampSec);
  }
}

function clampGain(value: number): number {
  if (value < 0) {
    return 0;
  }
  // Coerce NaN / +Infinity to unity gain rather than poisoning the graph.
  return Number.isFinite(value) ? value : 1;
}
