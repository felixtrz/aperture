import type {
  AudioEmitterPacket,
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
   * Reconcile the live voice graph against this frame's emitter intent.
   * `frameDelta` is the (clamped) main-thread frame interval used for ramps.
   */
  apply(emitters: readonly AudioEmitterPacket[], frameDelta: number): void;
  /** Logical voices currently tracked (one per live emitter key). */
  readonly activeVoiceCount: number;
  /** Live `AudioBufferSourceNode`s across all voices. */
  readonly activeSourceCount: number;
  dispose(): void;
}

interface Voice {
  readonly key: string;
  busId: AudioBusId;
  readonly gain: GainNode;
  readonly sources: Set<AudioBufferSourceNode>;
  looping: AudioBufferSourceNode | null;
  realizedEpoch: number;
  realizedStopEpoch: number;
  loop: boolean;
  clipId: string;
  clipVersion: number;
  offsetSec: number;
  /** Deferred starts awaiting a decode: a loop and/or N one-shots. */
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

  function apply(
    emitters: readonly AudioEmitterPacket[],
    frameDelta: number,
  ): void {
    if (disposed) {
      return;
    }
    for (const voice of voices.values()) {
      voice.seen = false;
    }

    for (const packet of emitters) {
      reconcile(packet, frameDelta);
    }

    // Seen-sweep: an emitter that vanished (despawn / active:false / hard cull)
    // is faded out and freed. A reused key reappears as a fresh voice.
    for (const voice of [...voices.values()]) {
      if (!voice.seen) {
        free(voice);
      }
    }
  }

  function reconcile(packet: AudioEmitterPacket, frameDelta: number): void {
    const key = voiceKeyString(packet.key);
    const clipId = clipKeyOf(packet);
    const bus = toBus(packet.busId);
    let voice = voices.get(key);
    const firstSight = voice === undefined;

    if (voice === undefined) {
      const gain = backend.createGain();
      gain.connect(mixer.busInput(bus));
      voice = {
        key,
        busId: bus,
        gain,
        sources: new Set(),
        looping: null,
        // Seed to the packet's current counters so past triggers (or a reused
        // entity id) never back-fire on first sight.
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

    // Click-free gain follow (mute = gain-to-zero, playhead keeps running).
    const targetGain = packet.muted ? 0 : packet.gain;
    if (!firstSight) {
      voice.gain.gain.setTargetAtTime(
        targetGain,
        backend.currentTime,
        FADE_SEC,
      );
    }

    // Stop counter: a positive signed delta requests a click-free fade-stop.
    if (signedDelta(packet.stopEpoch, voice.realizedStopEpoch) > 0) {
      voice.realizedStopEpoch = packet.stopEpoch;
      fadeStopSources(voice);
    }

    // Play counter: fire the signed delta as voices. First sight is seeded, so a
    // loop/one-shot starts only via autoplay or a real bump.
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

    void frameDelta; // spatial param ramps consume this in AU-6.
  }

  function startSource(voice: Voice, loop: boolean): void {
    const buffer = clips.acquire(voice.clipId, voice.clipVersion);
    if (buffer === undefined) {
      // Buffer not decoded yet — defer until onDecoded fires.
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
    source.connect(voice.gain);
    source.onended = () => {
      voice.sources.delete(source);
      if (voice.looping === source) {
        voice.looping = null;
      }
      if (voice.fadingOut && voice.sources.size === 0) {
        voice.gain.disconnect();
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
        // startSource re-defers if still not ready.
        if (voice.sources.size === before && voice.looping === null) {
          voice.pendingLoop = true;
        }
      }
      while (voice.pendingOneShots > 0) {
        const before = voice.sources.size;
        voice.pendingOneShots -= 1;
        startSource(voice, false);
        if (voice.sources.size === before) {
          // Still not ready — restore and stop trying this round.
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

  return {
    apply,
    get activeVoiceCount(): number {
      return voices.size;
    },
    get activeSourceCount(): number {
      return countSources();
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

function safeStop(source: AudioBufferSourceNode, when: number): void {
  try {
    source.stop(when);
  } catch {
    // Already stopped / never started — ignore.
  }
}
