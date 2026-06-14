import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  AudioVoiceKey,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createAudioEngine,
  createAudioEngineOrThrow,
  type ResolvedClip,
} from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeAudioBufferSourceNode,
} from "@aperture-engine/audio/test-support";

const CLIP = createAudioClipHandle("boom");
const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

function emitter(over: Partial<AudioEmitterPacket> = {}): AudioEmitterPacket {
  const key: AudioVoiceKey = over.key ?? { kind: "entity", id: 1 };
  return {
    key,
    entity: { index: 1, generation: 0 },
    clip: CLIP,
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: false,
    autoplay: false,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "local",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    occlusion: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
    ...over,
  };
}

/** Column-major 4x4 identity with a translation. */
function identityAt(tx: number, ty: number, tz: number): number[] {
  // prettier-ignore
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

function localSnap(emitters: AudioEmitterPacket[]): RenderSnapshot {
  return { audioEmitters: emitters } as unknown as RenderSnapshot;
}

/** A single spatial emitter at `ePos` with a listener at `lPos`. */
function spatialSnap(
  ePos: readonly [number, number, number],
  lPos: readonly [number, number, number],
  over: Partial<AudioEmitterPacket> = {},
): RenderSnapshot {
  const transforms = new Float32Array([
    ...identityAt(ePos[0], ePos[1], ePos[2]),
    ...identityAt(lPos[0], lPos[1], lPos[2]),
  ]);
  const listener: AudioListenerPacket = {
    listenerId: 1,
    entity: { index: 0, generation: 0 },
    worldTransformOffset: 16,
    masterGain: 1,
  };
  const e = emitter({
    simulationSpace: "world",
    worldTransformOffset: 0,
    loop: true,
    autoplay: true,
    ...over,
  });
  return {
    audioEmitters: [e],
    audioListener: listener,
    transforms,
  } as unknown as RenderSnapshot;
}

const resolver = (): ResolvedClip => ({
  bytes: new ArrayBuffer(16),
  streaming: false,
  durationHint: 2,
});

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("audio edge cases", () => {
  it("returns ok:false (not a throw) when no AudioContext and no backend", () => {
    // The vitest/node env has no global AudioContext.
    const result = createAudioEngine({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("audio-context-unavailable");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("demotes a voice beyond audibilityRadius to virtual (still tracked)", () => {
    const eng = createAudioEngineOrThrow({
      backend: new FakeAudioBackend({ state: "running" }),
      resolveClip: resolver,
    });

    // dist 5, within maxDistance 100 but beyond audibilityRadius 2 → virtual.
    eng.applySnapshot(
      spatialSnap([5, 0, 0], [0, 0, 0], { audibilityRadius: 2 }),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(0);
    expect(eng.virtualVoiceCount).toBe(1);

    // audibilityRadius 0 (disabled) → the same emitter is a real voice.
    eng.applySnapshot(
      spatialSnap([5, 0, 0], [0, 0, 0], { audibilityRadius: 0 }),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(1);
    expect(eng.virtualVoiceCount).toBe(0);
  });

  it("shifts the audibility sample point by boundsCenter (world-rotated)", () => {
    const eng = createAudioEngineOrThrow({
      backend: new FakeAudioBackend({ state: "running" }),
      resolveClip: resolver,
    });

    // Emitter at origin, listener at origin: distance 0 → real even with a tight
    // radius. boundsCenter pushes the audibility point to (5,0,0) → beyond it.
    eng.applySnapshot(
      spatialSnap([0, 0, 0], [0, 0, 0], {
        audibilityRadius: 2,
        boundsCenter: [5, 0, 0],
      }),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(0);
    expect(eng.virtualVoiceCount).toBe(1);

    eng.applySnapshot(
      spatialSnap([0, 0, 0], [0, 0, 0], {
        audibilityRadius: 2,
        boundsCenter: [0, 0, 0],
      }),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(1);
  });

  it("applies deterministic seed pitch variation only when enabled", async () => {
    const make = (pitchVariation: number, seed: number) => {
      const backend = new FakeAudioBackend({ state: "running" });
      const eng = createAudioEngineOrThrow({
        backend,
        resolveClip: resolver,
        voice: { pitchVariation },
      });
      eng.applySnapshot(localSnap([emitter({ autoplay: true, seed })]), 0.016);
      return backend;
    };

    const off = make(0, 12345);
    await tick();
    const offRate = (off.created.sources.at(-1) as FakeAudioBufferSourceNode)
      .playbackRate.value;
    expect(offRate).toBe(1); // variation off → exactly timeScale

    const a = make(0.1, 12345);
    const b = make(0.1, 12345);
    await tick();
    const ra = (a.created.sources.at(-1) as FakeAudioBufferSourceNode)
      .playbackRate.value;
    const rb = (b.created.sources.at(-1) as FakeAudioBufferSourceNode)
      .playbackRate.value;
    expect(ra).not.toBe(1); // varied
    expect(ra).toBe(rb); // deterministic for the same seed
    expect(Math.abs(ra - 1)).toBeLessThanOrEqual(0.1); // within range
  });

  it("fires exactly one one-shot across an Int32 playEpoch wrap", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngineOrThrow({ backend, resolveClip: resolver });

    eng.applySnapshot(localSnap([emitter({ playEpoch: INT32_MAX })]), 0.016); // seed
    await tick();
    expect(backend.created.sources.length).toBe(0);

    // +1 wraps to INT32_MIN; the wrapping signed-delta must read it as 1, not -2^32.
    eng.applySnapshot(localSnap([emitter({ playEpoch: INT32_MIN })]), 0.016);
    await tick();
    expect(backend.created.sources.length).toBe(1);
  });

  it("does not crash on NaN/Inf emitter inputs", () => {
    const eng = createAudioEngineOrThrow({
      backend: new FakeAudioBackend({ state: "running" }),
      resolveClip: resolver,
    });
    expect(() => {
      eng.applySnapshot(
        spatialSnap([Number.NaN, 0, Number.POSITIVE_INFINITY], [0, 0, 0], {
          gain: Number.NaN,
          maxDistance: Number.POSITIVE_INFINITY,
        }),
        Number.NaN,
      );
    }).not.toThrow();
    // A non-finite score must not consume a real voice.
    expect(eng.activeVoiceCount).toBe(0);
  });

  it("caps real voices under a flood and virtualizes the rest", () => {
    const eng = createAudioEngineOrThrow({
      backend: new FakeAudioBackend({ state: "running" }),
      resolveClip: resolver,
      voice: { maxVoices: 2 },
    });

    const flood = Array.from({ length: 5 }, (_, i) =>
      emitter({
        key: { kind: "entity", id: i + 1 },
        autoplay: true,
        loop: true,
      }),
    );
    eng.applySnapshot(localSnap(flood), 0.016);

    expect(eng.activeVoiceCount).toBe(2);
    expect(eng.virtualVoiceCount).toBe(3);
  });
});
