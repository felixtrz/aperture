import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  AudioVoiceKey,
  RenderSnapshot,
} from "@aperture-engine/render";
import { createAudioEngine, type ResolvedClip } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

const CLIP = createAudioClipHandle("boom");

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
    maxDistance: 10000,
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

function snap(emitters: AudioEmitterPacket[]): RenderSnapshot {
  return { audioEmitters: emitters } as unknown as RenderSnapshot;
}

function resolver(): ResolvedClip {
  return { bytes: new ArrayBuffer(16), streaming: false, durationHint: 1 };
}

/** Flush the async decodeAudioData microtask + its deferred-start flush. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function engine(maxBurstPerFrame?: number) {
  const backend = new FakeAudioBackend({ state: "running" });
  const eng = createAudioEngine({
    backend,
    resolveClip: () => resolver(),
    ...(maxBurstPerFrame === undefined ? {} : { voice: { maxBurstPerFrame } }),
  });
  return { backend, eng };
}

describe("voice manager reconciliation (AU-4)", () => {
  it("does not back-fire on first sight (seeded epoch)", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ playEpoch: 5 })]), 0.016);
    await tick();
    // First sight seeds realizedEpoch to 5, so no past trigger replays.
    expect(eng.activeSourceCount).toBe(0);
    expect(backend.created.sources.length).toBe(0);
  });

  it("starts an autoplay loop once the buffer decodes", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ autoplay: true, loop: true })]), 0.016);
    expect(eng.activeSourceCount).toBe(0); // deferred until decode
    await tick();
    expect(eng.activeSourceCount).toBe(1);
    expect(backend.created.sources[0]?.loop).toBe(true);
    expect(backend.created.sources[0]?.started).toBe(true);
  });

  it("fires one one-shot per positive playEpoch delta", async () => {
    const { eng } = engine();
    eng.applySnapshot(snap([emitter({ playEpoch: 0 })]), 0.016); // seed
    eng.applySnapshot(snap([emitter({ playEpoch: 1 })]), 0.016); // +1
    await tick();
    expect(eng.activeSourceCount).toBe(1);
  });

  it("fires a burst from a multi-count delta, capped by maxBurstPerFrame", async () => {
    const { eng } = engine(8);
    eng.applySnapshot(snap([emitter({ playEpoch: 0 })]), 0.016);
    eng.applySnapshot(snap([emitter({ playEpoch: 5 })]), 0.016); // +5
    await tick();
    expect(eng.activeSourceCount).toBe(5);
  });

  it("decodes a shared clip exactly once across two emitters", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(
      snap([
        emitter({ key: { kind: "entity", id: 1 }, autoplay: true }),
        emitter({ key: { kind: "entity", id: 2 }, autoplay: true }),
      ]),
      0.016,
    );
    await tick();
    expect(eng.activeVoiceCount).toBe(2);
    expect(eng.activeSourceCount).toBe(2);
    expect(eng.clips.decodeCount).toBe(1);
    expect(backend.decodeCalls).toBe(1);
  });

  it("fade-stops a loop on a stopEpoch bump without a hard edge", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ autoplay: true, loop: true })]), 0.016);
    await tick();
    expect(eng.activeSourceCount).toBe(1);

    eng.applySnapshot(
      snap([emitter({ autoplay: true, loop: true, stopEpoch: 1 })]),
      0.016,
    );
    // The voice gain ramps to 0 (no instantaneous step) and the source stops.
    const voiceGain = backend.created.gains.at(-1) as FakeGainNode;
    const last = voiceGain.gain.lastEvent();
    expect(last?.method).toBe("linearRampToValueAtTime");
    expect(last?.value).toBe(0);
    expect(backend.created.sources.some((s) => s.stopped)).toBe(true);
  });

  it("frees a voice when its emitter vanishes (seen-sweep)", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ autoplay: true, loop: true })]), 0.016);
    await tick();
    expect(eng.activeVoiceCount).toBe(1);

    eng.applySnapshot(snap([]), 0.016); // emitter gone
    expect(eng.activeVoiceCount).toBe(0);
    expect(backend.created.sources.some((s) => s.stopped)).toBe(true);
  });

  it("mutes via gain-to-zero while the loop keeps running", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ autoplay: true, loop: true })]), 0.016);
    await tick();
    eng.applySnapshot(
      snap([emitter({ autoplay: true, loop: true, muted: true })]),
      0.016,
    );
    const voiceGain = backend.created.gains.at(-1) as FakeGainNode;
    expect(voiceGain.gain.value).toBe(0); // gain to zero
    expect(eng.activeSourceCount).toBe(1); // source still running (not stopped)
    expect(backend.created.sources.every((s) => !s.stopped)).toBe(true);
  });
});
