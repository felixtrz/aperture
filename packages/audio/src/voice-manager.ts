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

export interface VoiceManagerOptions {
  /** Max one-shots fired per emitter per frame (burst overflow is dropped). */
  readonly maxBurstPerFrame?: number;
}

export interface VoiceManager {
  /**
   * Reconcile the live voice graph against this frame's audio intent.
   * `transforms` is the snapshot's packed world matrices (emitter + listener
   * poses ride it); `frameDelta` is the clamped main-thread frame interval used
   * for click-free AudioParam ramps.
   */
  apply(
    emitters: readonly AudioEmitterPacket[],
    transforms: Float32Array,
    listener: AudioListenerPacket | undefined,
    frameDelta: number,
  ): void;
  /** Logical voices currently tracked (one per live emitter key). */
  readonly activeVoiceCount: number;
  /** Live `AudioBufferSourceNode`s across all voices. */
  readonly activeSourceCount: number;
  /** Live `PannerNode`s (spatial voices) — diagnostics / budget. */
  readonly activePannerCount: number;
  dispose(): void;
}

interface Voice {
  readonly key: string;
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
  pendingLoop: boolean;
  pendingOneShots: number;
  seen: boolean;
  fadingOut: boolean;
}

export function createVoiceManager(
  backend: AudioBackend,
  mixer: AudioMixer,
  clips: ClipCache,
  options: VoiceManagerOptions = {},
): VoiceManager {
  const voices = new Map<string, Voice>();
  const maxBurst = Math.max(1, options.maxBurstPerFrame ?? DEFAULT_MAX_BURST);
  const unsubscribe = clips.onDecoded(() => flushPending());
  let disposed = false;
  let lastListenerMasterGain = Number.NaN;

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

    for (const voice of voices.values()) {
      voice.seen = false;
    }
    for (const packet of emitters) {
      reconcile(packet, transforms, frameDelta);
    }
    // Seen-sweep: a vanished emitter (despawn / active:false / hard cull) is
    // faded out and freed; a reused key reappears as a fresh voice.
    for (const voice of [...voices.values()]) {
      if (!voice.seen) {
        free(voice);
      }
    }
  }

  function updateListener(
    listener: AudioListenerPacket | undefined,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
    if (listener === undefined) {
      return;
    }
    const o = listener.worldTransformOffset;
    const at = backend.currentTime + frameDelta;
    const l = backend.listener;
    // WORLD-matrix basis (not the inverted view): pos=col3, fwd=-col2, up=+col1.
    ramp3(
      l.positionX,
      l.positionY,
      l.positionZ,
      m(transforms, o, 12),
      m(transforms, o, 13),
      m(transforms, o, 14),
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

  function reconcile(
    packet: AudioEmitterPacket,
    transforms: Float32Array,
    frameDelta: number,
  ): void {
    const key = voiceKeyString(packet.key);
    const clipId = clipKeyOf(packet);
    const bus = toBus(packet.busId);
    let voice = voices.get(key);
    const firstSight = voice === undefined;

    if (voice === undefined) {
      const gain = backend.createGain();
      gain.connect(mixer.busInput(bus));
      let panner: PannerNode | null = null;
      if (packet.simulationSpace === "world") {
        panner = backend.createPanner();
        panner.connect(gain);
      }
      voice = {
        key,
        busId: bus,
        gain,
        panner,
        sources: new Set(),
        looping: null,
        realizedEpoch: packet.playEpoch,
        realizedStopEpoch: packet.stopEpoch,
        loop: packet.loop,
        clipId,
        clipVersion: packet.clipVersion,
        offsetSec: packet.offsetSec,
        pendingLoop: false,
        pendingOneShots: 0,
        seen: true,
        fadingOut: false,
      };
      voices.set(key, voice);
      gain.gain.value = packet.muted ? 0 : packet.gain;
    }

    voice.seen = true;
    voice.loop = packet.loop;
    voice.clipId = clipId;
    voice.clipVersion = packet.clipVersion;
    voice.offsetSec = packet.offsetSec;

    const targetGain = packet.muted ? 0 : packet.gain;
    if (!firstSight) {
      voice.gain.gain.setTargetAtTime(
        targetGain,
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
      const wantLoop = (firstSight && packet.autoplay) || playDelta > 0;
      if (wantLoop && voice.looping === null && !voice.pendingLoop) {
        startSource(voice, true);
      }
    } else {
      let toFire = playDelta > 0 ? playDelta : 0;
      if (firstSight && packet.autoplay) {
        toFire = Math.max(toFire, 1);
      }
      if (toFire > 0) {
        const fired = Math.min(toFire, maxBurst);
        for (let index = 0; index < fired; index += 1) {
          startSource(voice, false);
        }
      }
    }

    if (voice.panner !== null) {
      updatePanner(voice.panner, packet, transforms, frameDelta);
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
    // Source faces its world forward = -col2 (same basis convention as the listener).
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

  function startSource(voice: Voice, loop: boolean): void {
    const buffer = clips.acquire(voice.clipId, voice.clipVersion);
    if (buffer === undefined) {
      if (loop) {
        voice.pendingLoop = true;
      } else {
        voice.pendingOneShots = Math.min(voice.pendingOneShots + 1, maxBurst);
      }
      return;
    }

    const source = backend.createSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(voice.panner ?? voice.gain);
    source.onended = () => {
      voice.sources.delete(source);
      if (voice.looping === source) {
        voice.looping = null;
      }
      if (voice.fadingOut && voice.sources.size === 0) {
        voice.gain.disconnect();
        voice.panner?.disconnect();
      }
    };
    source.start(backend.currentTime, voice.offsetSec);
    voice.sources.add(source);
    if (loop) {
      voice.looping = source;
    }
  }

  function flushPending(): void {
    if (disposed) {
      return;
    }
    for (const voice of voices.values()) {
      if (voice.fadingOut) {
        continue;
      }
      if (voice.pendingLoop && voice.looping === null) {
        const before = voice.sources.size;
        voice.pendingLoop = false;
        startSource(voice, true);
        if (voice.sources.size === before && voice.looping === null) {
          voice.pendingLoop = true;
        }
      }
      while (voice.pendingOneShots > 0) {
        const before = voice.sources.size;
        voice.pendingOneShots -= 1;
        startSource(voice, false);
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
    voices.delete(voice.key);
    voice.fadingOut = true;
    voice.pendingLoop = false;
    voice.pendingOneShots = 0;
    if (voice.sources.size === 0) {
      voice.gain.disconnect();
      voice.panner?.disconnect();
      return;
    }
    fadeStopSources(voice);
  }

  function countSources(): number {
    let total = 0;
    for (const voice of voices.values()) {
      total += voice.sources.size;
    }
    return total;
  }

  function countPanners(): number {
    let total = 0;
    for (const voice of voices.values()) {
      if (voice.panner !== null) {
        total += 1;
      }
    }
    return total;
  }

  return {
    apply,
    get activeVoiceCount(): number {
      return voices.size;
    },
    get activeSourceCount(): number {
      return countSources();
    },
    get activePannerCount(): number {
      return countPanners();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      unsubscribe();
      for (const voice of [...voices.values()]) {
        for (const source of voice.sources) {
          safeStop(source, backend.currentTime);
        }
        voice.gain.disconnect();
        voice.panner?.disconnect();
      }
      voices.clear();
    },
  };
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

/** 32-bit wrapping signed difference, for monotonic Int32 epoch counters. */
function signedDelta(current: number, realized: number): number {
  return (current - realized) | 0;
}

/** Read a column-major matrix element from the packed transforms array. */
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
