import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createAudioEngine,
  type AudioBusId,
  type ResolvedClip,
  type VoiceManagerOptions,
} from "@aperture-engine/audio";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

interface Spec {
  readonly id: number;
  readonly x: number;
  readonly busId?: AudioBusId;
  readonly loop?: boolean;
  readonly autoplay?: boolean;
  readonly clipId?: string;
  readonly maxDistance?: number;
}

function poseInto(out: Float32Array, offset: number, tx: number): void {
  out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, 0, 0, 1], offset);
}

function emitter(spec: Spec): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: spec.id },
    entity: { index: spec.id, generation: 0 },
    clip: createAudioClipHandle(spec.clipId ?? "c"),
    clipVersion: 1,
    busId: spec.busId ?? "sfx",
    gain: 1,
    loop: spec.loop ?? false,
    autoplay: spec.autoplay ?? false,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "world",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: spec.maxDistance ?? 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: spec.id * 0, // set in worldSnap
    layerMask: 1,
  };
}

function worldSnap(specs: Spec[]): RenderSnapshot {
  const n = specs.length;
  const transforms = new Float32Array((n + 1) * 16);
  const emitters = specs.map((spec, i) => {
    poseInto(transforms, i * 16, spec.x);
    return { ...emitter(spec), worldTransformOffset: i * 16 };
  });
  poseInto(transforms, n * 16, 0); // listener at origin
  return {
    audioEmitters: emitters,
    audioListener: {
      listenerId: 999,
      entity: { index: 999, generation: 0 },
      worldTransformOffset: n * 16,
      masterGain: 1,
    },
    transforms,
  } as unknown as RenderSnapshot;
}

function engine(voice: VoiceManagerOptions) {
  const backend = new FakeAudioBackend({ state: "running" });
  const eng = createAudioEngine({
    backend,
    voice,
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

describe("voice virtualization + stealing + pooling (AU-8/9)", () => {
  it("keeps only the nearest maxVoices emitters real; the rest go virtual", () => {
    const { eng } = engine({ maxVoices: 2 });
    eng.applySnapshot(
      worldSnap([
        { id: 1, x: 1 },
        { id: 2, x: 2 },
        { id: 3, x: 30 },
        { id: 4, x: 40 },
      ]),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(2);
    expect(eng.virtualVoiceCount).toBe(2);
  });

  it("enforces a per-bus cap independent of the global budget", () => {
    const { eng } = engine({ maxVoices: 32, busCaps: { sfx: 1 } });
    eng.applySnapshot(
      worldSnap([
        { id: 1, x: 1, busId: "sfx" },
        { id: 2, x: 2, busId: "sfx" },
      ]),
      0.016,
    );
    expect(eng.activeVoiceCount).toBe(1);
    expect(eng.virtualVoiceCount).toBe(1);
  });

  it("virtualizes a source beyond maxDistance instead of spending a voice", () => {
    const { eng } = engine({ maxVoices: 8 });
    eng.applySnapshot(worldSnap([{ id: 1, x: 100, maxDistance: 10 }]), 0.016);
    expect(eng.activeVoiceCount).toBe(0);
    expect(eng.virtualVoiceCount).toBe(1);
  });

  it("recycles a freed voice's PannerNode subgraph from the pool (AU-8)", () => {
    const { backend, eng } = engine({ maxVoices: 8 });
    eng.applySnapshot(worldSnap([{ id: 1, x: 1 }]), 0.016);
    expect(backend.created.panners.length).toBe(1);
    eng.applySnapshot(worldSnap([]), 0.016); // emitter 1 gone -> recycled
    eng.applySnapshot(worldSnap([{ id: 2, x: 1 }]), 0.016); // new emitter reuses pool
    expect(eng.activeVoiceCount).toBe(1);
    expect(backend.created.panners.length).toBe(1); // no new panner allocated
  });

  it("steals: a nearer emitter promotes and demotes the now-distant one", async () => {
    const { eng } = engine({ maxVoices: 1 });
    // A near, B far -> A real, B virtual.
    eng.applySnapshot(
      worldSnap([
        { id: 1, x: 1, loop: true, autoplay: true, clipId: "a" },
        { id: 2, x: 100, loop: true, autoplay: true, clipId: "b" },
      ]),
      0.016,
    );
    await tick();
    expect(eng.activeVoiceCount).toBe(1);
    expect(eng.virtualVoiceCount).toBe(1);
    expect(eng.clips.decodeCount).toBe(1); // only the real (A) clip decoded

    // Flip: A far, B near -> B promotes (real), A demotes (virtual).
    eng.applySnapshot(
      worldSnap([
        { id: 1, x: 100, loop: true, autoplay: true, clipId: "a" },
        { id: 2, x: 1, loop: true, autoplay: true, clipId: "b" },
      ]),
      0.016,
    );
    await tick();
    expect(eng.activeVoiceCount).toBe(1);
    expect(eng.virtualVoiceCount).toBe(1);
    expect(eng.clips.decodeCount).toBe(2); // B's clip now decoded (promoted + playing)
  });
});
