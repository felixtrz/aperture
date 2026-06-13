import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  AudioVoiceKey,
} from "@aperture-engine/render";
import type { AudioBackend } from "./audio-backend.js";
import type { ClipCache } from "./clip-cache.js";
import { AUDIO_BUS_IDS, type AudioBusId, type AudioMixer } from "./mixer.js";

/** Click-free fade/stop time constant, in seconds. */
const FADE_SEC = 0.015;
/** Default cap on one-shot voices fired from a single frame's epoch delta. */
const DEFAULT_MAX_BURST = 8;
/** Default global ceiling on simultaneously-sounding real voices. */
const DEFAULT_MAX_VOICES = 32;
/** Score floor that 2D / non-spatial voices sit above any spatial voice. */
const LOCAL_BASE = 1e6;
/** Doppler model constants (speed of sound m/s; dead-zone + clamp). */
const SPEED_OF_SOUND = 343;
const DOPPLER_DEADZONE = 0.5;
const DOPPLER_MAX_RATE = 2;
const DOPPLER_MIN_RATE = 0.5;

/** Per-bus simultaneous-voice caps so one category can't starve another. */
const DEFAULT_BUS_CAPS: Readonly<Record<AudioBusId, number>> = {
  music: 2,
  sfx: 12,
  ui: Number.POSITIVE_INFINITY,
  ambient: 6,
  voice: 2,
};

export interface VoiceManagerOptions {
  /** Max one-shots fired per emitter per frame (burst overflow is dropped). */
  readonly maxBurstPerFrame?: number;
  /** Global ceiling on simultaneously-sounding real voices. */
  readonly maxVoices?: number;
  /** Override per-bus simultaneous-voice caps. */
  readonly busCaps?: Partial<Record<AudioBusId, number>>;
  /** Auto-Doppler pitch shift from radial velocity (default off). */
  readonly doppler?: boolean;
}

export interface VoiceManager {
  /**
   * Reconcile the live voice graph against this frame's audio intent.
   * `transforms` carries the packed world matrices (emitter + listener poses);
   * `frameDelta` is the clamped main-thread frame interval used for ramps.
   */
  apply(
    emitters: readonly AudioEmitterPacket[],
    transforms: Float32Array,
    listener: AudioListenerPacket | undefined,
    frameDelta: number,
  ): void;
  /** Real (sounding) voices — bounded by maxVoices and the per-bus caps. */
  readonly activeVoiceCount: number;
  /** Live `AudioBufferSourceNode`s across all real voices. */
  readonly activeSourceCount: number;
  /** Live `PannerNode`s (spatial real voices) — diagnostics / budget. */
  readonly activePannerCount: number;
  /** Demoted node-less voices retaining a playhead for mid-loop resume. */
  readonly virtualVoiceCount: number;
  /** Whether any real voice is currently routed to the given bus. */
  busActive(bus: AudioBusId): boolean;
  /** Shift scheduled `start()` times by `seconds` (latency compensation). */
  setAudioOffset(seconds: number): void;
  dispose(): void;
}

interface Voice {
  key: string;
  busId: AudioBusId;
  readonly gain: GainNode;
  /** Spatial voices route source -> panner -> gain; 2D voices skip the panner. */
  readonly panner: PannerNode | null;
  readonly sources: Set<AudioBufferSourceNode>;
  looping: AudioBufferSourceNode | null;
  realizedEpoch: number;
  realizedStopEpoch: number;
  loop: boolean;
  clipId: string;
  clipVersion: number;
  offsetSec: number;
  timeScale: number;
  prevDist: number;
  loopStartedAt: number;
  loopLenSec: number;
  pendingLoop: boolean;
  pendingOneShots: number;
  seen: boolean;
  fadingOut: boolean;
}

interface VirtualVoice {
  key: string;
  busId: AudioBusId;
  realizedEpoch: number;
  realizedStopEpoch: number;
  loop: boolean;
  clipId: string;
  clipVersion: number;
  offsetSec: number;
  loopStartedAt: number;
  loopLenSec: number;
  seen: boolean;
}

interface Candidate {
  key: string;
  packet: AudioEmitterPacket;
  score: number;
}

export function createVoiceManager(
  backend: AudioBackend,
  mixer: AudioMixer,
  clips: ClipCache,
  options: VoiceManagerOptions = {},
): VoiceManager {
  const real = new Map<string, Voice>();
  const virtual = new Map<string, VirtualVoice>();
  const spatialPool: Voice[] = [];
  const flatPool: Voice[] = [];
  const candidates: Candidate[] = [];
  const busCounts = new Map<AudioBusId, number>();

  const maxBurst = Math.max(1, options.maxBurstPerFrame ?? DEFAULT_MAX_BURST);
  const maxVoices = Math.max(1, options.maxVoices ?? DEFAULT_MAX_VOICES);
  const doppler = options.doppler ?? false;
  let audioOffset = 0;
  const busCaps: Record<AudioBusId, number> = { ...DEFAULT_BUS_CAPS };
  for (const bus of AUDIO_BUS_IDS) {
    const override = options.busCaps?.[bus];
    if (override !== undefined) {
      busCaps[bus] = override;
    }
  }

  const unsubscribe = clips.onDecoded(() => flushPending());
  let disposed = false;
  let lastListenerMasterGain = Number.NaN;
  let listenerX = 0;
  let listenerY = 0;
  let listenerZ = 0;
  let hasListener = false;

  function apply(
    emitters: readonly AudioEmitterPacket[],
    transforms: Float32Array,
    listener: AudioListenerPacket | undefined,
    frameDelta: number,
  ): void {
    if (disposed) {
      return;
    }
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
      const audible =
        candidate.score > Number.NEGATIVE_INFINITY &&
        realCount < maxVoices &&
        used < busCaps[bus];
      if (audible) {
        busCounts.set(bus, used + 1);
        realCount += 1;
        reconcileReal(candidate.packet, bus, transforms, frameDelta);
      } else {
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
  }

  function score(packet: AudioEmitterPacket, transforms: Float32Array): number {
    if (packet.simulationSpace === "local") {
      return LOCAL_BASE + packet.priority + packet.gain;
    }
    if (!hasListener) {
      return LOCAL_BASE / 2 + packet.priority + packet.gain;
    }
    const o = packet.worldTransformOffset;
    const dx = m(transforms, o, 12) - listenerX;
    const dy = m(transforms, o, 13) - listenerY;
    const dz = m(transforms, o, 14) - listenerZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > packet.maxDistance) {
      // Inaudible: never consumes a real voice (kept virtual for mid-loop resume).
      return Number.NEGATIVE_INFINITY;
    }
    const att = rolloff(
      packet.distanceModel,
      dist,
      packet.refDistance,
      packet.maxDistance,
      packet.rolloffFactor,
    );
    return packet.gain * att + packet.priority;
  }

  function updateListener(
    listener: AudioListenerPacket | undefined,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
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
    ramp3(
      l.positionX,
      l.positionY,
      l.positionZ,
      listenerX,
      listenerY,
      listenerZ,
      at,
    );
    ramp3(
      l.forwardX,
      l.forwardY,
      l.forwardZ,
      -m(transforms, o, 8),
      -m(transforms, o, 9),
      -m(transforms, o, 10),
      at,
    );
    ramp3(
      l.upX,
      l.upY,
      l.upZ,
      m(transforms, o, 4),
      m(transforms, o, 5),
      m(transforms, o, 6),
      at,
    );
    if (listener.masterGain !== lastListenerMasterGain) {
      lastListenerMasterGain = listener.masterGain;
      mixer.setMasterGain(listener.masterGain, FADE_SEC);
    }
  }

  function reconcileReal(
    packet: AudioEmitterPacket,
    bus: AudioBusId,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
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
      } else {
        voice.realizedEpoch = packet.playEpoch;
        voice.realizedStopEpoch = packet.stopEpoch;
        voice.loopStartedAt = 0;
        voice.loopLenSec = 0;
      }
      real.set(key, voice);
      voice.gain.gain.cancelScheduledValues(backend.currentTime);
      voice.gain.gain.setValueAtTime(
        packet.muted ? 0 : packet.gain,
        backend.currentTime,
      );
    }

    voice.seen = true;
    voice.loop = packet.loop;
    voice.clipId = clipId;
    voice.clipVersion = packet.clipVersion;
    voice.offsetSec = packet.offsetSec;
    voice.timeScale = packet.timeScale;

    if (!firstSight) {
      voice.gain.gain.setTargetAtTime(
        packet.muted ? 0 : packet.gain,
        backend.currentTime,
        FADE_SEC,
      );
    }

    if (signedDelta(packet.stopEpoch, voice.realizedStopEpoch) > 0) {
      voice.realizedStopEpoch = packet.stopEpoch;
      fadeStopSources(voice);
    }

    const playDelta = signedDelta(packet.playEpoch, voice.realizedEpoch);
    voice.realizedEpoch = packet.playEpoch;

    if (voice.loop) {
      const wantLoop =
        ((firstSight && (packet.autoplay || promotion !== undefined)) ||
          playDelta > 0) &&
        voice.looping === null &&
        !voice.pendingLoop;
      if (wantLoop) {
        startLoop(voice, firstSight && promotion !== undefined);
      }
    } else {
      let toFire = playDelta > 0 ? playDelta : 0;
      if (firstSight && packet.autoplay && promotion === undefined) {
        toFire = Math.max(toFire, 1);
      }
      const fired = Math.min(toFire, maxBurst);
      for (let index = 0; index < fired; index += 1) {
        startOneShot(voice);
      }
    }

    if (voice.panner !== null) {
      updatePanner(voice.panner, packet, transforms, frameDelta);
    }
    applyPlaybackRate(voice, packet, transforms, frameDelta);
  }

  function reconcileVirtual(packet: AudioEmitterPacket, bus: AudioBusId): void {
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

  function acquireVoice(spatial: boolean, bus: AudioBusId): Voice {
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
    let panner: PannerNode | null = null;
    if (spatial) {
      panner = backend.createPanner();
      panner.connect(gain);
    }
    gain.connect(mixer.busInput(bus));
    return {
      key: "",
      busId: bus,
      gain,
      panner,
      sources: new Set(),
      looping: null,
      realizedEpoch: 0,
      realizedStopEpoch: 0,
      loop: false,
      clipId: "",
      clipVersion: 0,
      offsetSec: 0,
      timeScale: 1,
      prevDist: Number.NaN,
      loopStartedAt: 0,
      loopLenSec: 0,
      pendingLoop: false,
      pendingOneShots: 0,
      seen: true,
      fadingOut: false,
    };
  }

  function startLoop(voice: Voice, resume: boolean): void {
    const buffer = clips.acquire(voice.clipId, voice.clipVersion);
    if (buffer === undefined) {
      voice.pendingLoop = true;
      return;
    }
    let offset = voice.offsetSec;
    if (resume && voice.loopLenSec > 0) {
      const elapsed =
        backend.currentTime - voice.loopStartedAt + voice.offsetSec;
      offset =
        ((elapsed % voice.loopLenSec) + voice.loopLenSec) % voice.loopLenSec;
    } else {
      voice.loopStartedAt = backend.currentTime - voice.offsetSec;
    }
    voice.loopLenSec = buffer.duration;
    const source = newSource(voice, buffer, true);
    source.start(backend.currentTime + audioOffset, offset);
    voice.sources.add(source);
    voice.looping = source;
  }

  function startOneShot(voice: Voice): void {
    const buffer = clips.acquire(voice.clipId, voice.clipVersion);
    if (buffer === undefined) {
      voice.pendingOneShots = Math.min(voice.pendingOneShots + 1, maxBurst);
      return;
    }
    const source = newSource(voice, buffer, false);
    source.start(backend.currentTime + audioOffset, voice.offsetSec);
    voice.sources.add(source);
  }

  function newSource(
    voice: Voice,
    buffer: AudioBuffer,
    loop: boolean,
  ): AudioBufferSourceNode {
    const source = backend.createSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = voice.timeScale;
    source.connect(voice.panner ?? voice.gain);
    source.onended = () => {
      voice.sources.delete(source);
      if (voice.looping === source) {
        voice.looping = null;
      }
      if (voice.fadingOut && voice.sources.size === 0) {
        recycle(voice);
      }
    };
    return source;
  }

  function flushPending(): void {
    if (disposed) {
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

  function fadeStopSources(voice: Voice): void {
    if (voice.sources.size === 0) {
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
    voice.looping = null;
  }

  function free(voice: Voice): void {
    real.delete(voice.key);
    voice.fadingOut = true;
    voice.pendingLoop = false;
    voice.pendingOneShots = 0;
    if (voice.sources.size === 0) {
      recycle(voice);
      return;
    }
    fadeStopSources(voice);
  }

  /** Return a freed voice's persistent subgraph to the pool (AU-8). */
  function recycle(voice: Voice): void {
    if (disposed) {
      voice.gain.disconnect();
      voice.panner?.disconnect();
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
  function applyPlaybackRate(
    voice: Voice,
    packet: AudioEmitterPacket,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
    let rate = voice.timeScale;
    if (doppler && voice.panner !== null && hasListener && frameDelta > 0) {
      const o = packet.worldTransformOffset;
      const dx = m(transforms, o, 12) - listenerX;
      const dy = m(transforms, o, 13) - listenerY;
      const dz = m(transforms, o, 14) - listenerZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (Number.isFinite(voice.prevDist)) {
        let radial = (dist - voice.prevDist) / frameDelta;
        if (Math.abs(radial) < DOPPLER_DEADZONE) {
          radial = 0;
        }
        radial = clampNum(radial, -SPEED_OF_SOUND * 0.5, SPEED_OF_SOUND * 0.5);
        const shift = SPEED_OF_SOUND / (SPEED_OF_SOUND + radial);
        rate =
          voice.timeScale * clampNum(shift, DOPPLER_MIN_RATE, DOPPLER_MAX_RATE);
      }
      voice.prevDist = dist;
    }
    const at = backend.currentTime + frameDelta;
    for (const source of voice.sources) {
      source.playbackRate.linearRampToValueAtTime(rate, at);
    }
  }

  /** Per-frame spatial update — zero allocation. */
  function updatePanner(
    panner: PannerNode,
    packet: AudioEmitterPacket,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
    const o = packet.worldTransformOffset;
    const at = backend.currentTime + frameDelta;
    ramp3(
      panner.positionX,
      panner.positionY,
      panner.positionZ,
      m(transforms, o, 12),
      m(transforms, o, 13),
      m(transforms, o, 14),
      at,
    );
    // Source faces world forward = -col2 (same basis as the listener).
    ramp3(
      panner.orientationX,
      panner.orientationY,
      panner.orientationZ,
      -m(transforms, o, 8),
      -m(transforms, o, 9),
      -m(transforms, o, 10),
      at,
    );
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
    get activeVoiceCount(): number {
      return real.size;
    },
    get activeSourceCount(): number {
      let total = 0;
      for (const voice of real.values()) {
        total += voice.sources.size;
      }
      return total;
    },
    get activePannerCount(): number {
      let total = 0;
      for (const voice of real.values()) {
        if (voice.panner !== null) {
          total += 1;
        }
      }
      return total;
    },
    get virtualVoiceCount(): number {
      return virtual.size;
    },
    busActive(bus) {
      for (const voice of real.values()) {
        if (voice.busId === bus && !voice.fadingOut) {
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
        voice.gain.disconnect();
        voice.panner?.disconnect();
      }
      real.clear();
      virtual.clear();
      spatialPool.length = 0;
      flatPool.length = 0;
    },
  };
}

function byScoreDesc(a: Candidate, b: Candidate): number {
  return b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

function voiceKeyString(key: AudioVoiceKey): string {
  return key.kind === "entity" ? `e:${key.id}` : `o:${key.seq}`;
}

function clipKeyOf(packet: AudioEmitterPacket): string {
  return `${packet.clip.kind}:${packet.clip.id}`;
}

function toBus(busId: string): AudioBusId {
  return (AUDIO_BUS_IDS as readonly string[]).includes(busId)
    ? (busId as AudioBusId)
    : "sfx";
}

/** Web Audio distance-model attenuation in [0,1]. */
function rolloff(
  model: "inverse" | "linear" | "exponential",
  dist: number,
  ref: number,
  max: number,
  factor: number,
): number {
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
function signedDelta(current: number, realized: number): number {
  return (current - realized) | 0;
}

function clampNum(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function m(transforms: Float32Array, offset: number, index: number): number {
  return transforms[offset + index] ?? 0;
}

function ramp3(
  x: AudioParam,
  y: AudioParam,
  z: AudioParam,
  vx: number,
  vy: number,
  vz: number,
  at: number,
): void {
  x.linearRampToValueAtTime(vx, at);
  y.linearRampToValueAtTime(vy, at);
  z.linearRampToValueAtTime(vz, at);
}

function safeStop(source: AudioBufferSourceNode, when: number): void {
  try {
    source.stop(when);
  } catch {
    // Already stopped / never started — ignore.
  }
}
