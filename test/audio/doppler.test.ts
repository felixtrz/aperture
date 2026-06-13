import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { createAudioEngine, type ResolvedClip } from "@aperture-engine/audio";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

function poseInto(out: Float32Array, offset: number, tx: number): void {
  out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, 0, 0, 1], offset);
}

function worldEmitter(x: number, timeScale = 1): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("c"),
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: true,
    autoplay: true,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "world",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 100000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function snap(x: number, timeScale = 1): RenderSnapshot {
  const transforms = new Float32Array(32);
  poseInto(transforms, 0, x); // emitter
  poseInto(transforms, 16, 0); // listener at origin
  return {
    audioEmitters: [worldEmitter(x, timeScale)],
    audioListener: {
      listenerId: 9,
      entity: { index: 9, generation: 0 },
      worldTransformOffset: 16,
      masterGain: 1,
    },
    transforms,
  } as unknown as RenderSnapshot;
}

function engine(doppler: boolean) {
  const backend = new FakeAudioBackend({ state: "running" });
  const eng = createAudioEngine({
    backend,
    voice: { doppler },
    resolveClip: (): ResolvedClip => ({
      bytes: new ArrayBuffer(16),
      streaming: false,
      durationHint: 1,
    }),
  });
  return { backend, eng };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("playbackRate + Doppler (AU-14)", () => {
  it("applies authored timeScale to the source playbackRate", async () => {
    const { backend, eng } = engine(false);
    eng.applySnapshot(snap(5, 1.5), 0.016);
    await tick();
    expect(backend.created.sources[0]?.playbackRate.value).toBeCloseTo(1.5);
  });

  it("lowers pitch for a receding source when Doppler is on", async () => {
    const { backend, eng } = engine(true);
    eng.applySnapshot(snap(10), 0.016); // seed prevDist
    await tick();
    eng.applySnapshot(snap(40), 0.016); // moved away
    expect(backend.created.sources[0]?.playbackRate.value).toBeLessThan(1);
  });

  it("raises pitch for an approaching source when Doppler is on", async () => {
    const { backend, eng } = engine(true);
    eng.applySnapshot(snap(40), 0.016);
    await tick();
    eng.applySnapshot(snap(10), 0.016); // moved closer
    expect(backend.created.sources[0]?.playbackRate.value).toBeGreaterThan(1);
  });

  it("produces no warble (dead-zone) for a near-stationary source", async () => {
    const { backend, eng } = engine(true);
    eng.applySnapshot(snap(10), 0.016);
    await tick();
    eng.applySnapshot(snap(10), 0.016); // unmoved
    expect(backend.created.sources[0]?.playbackRate.value).toBeCloseTo(1);
  });
});
