import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createAudioEngineOrThrow,
  type ResolvedClip,
} from "@aperture-engine/audio";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

function emitter(over: Partial<AudioEmitterPacket> = {}): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("c"),
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
    occlusion: 0,
    lowpassFrequency: 22000,
    lowpassQ: 0.7,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
    ...over,
  };
}

function snap(e: AudioEmitterPacket[]): RenderSnapshot {
  return {
    audioEmitters: e,
    transforms: new Float32Array(0),
  } as unknown as RenderSnapshot;
}

function engine() {
  const backend = new FakeAudioBackend({ state: "running" });
  const eng = createAudioEngineOrThrow({
    backend,
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

describe("suspend/resume reconciliation (AU-17)", () => {
  it("drops a one-shot epoch backlog accumulated while suspended", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([emitter({ playEpoch: 0 })]), 0.016); // seed the voice
    await tick();
    expect(backend.created.sources.length).toBe(0);

    await eng.suspend();
    await eng.resume(); // arms resume reconciliation

    // The worker bumped playEpoch by 5 while suspended; on resume they're dropped.
    eng.applySnapshot(snap([emitter({ playEpoch: 5 })]), 0.016);
    await tick();
    expect(backend.created.sources.length).toBe(0);

    // A fresh trigger after resume still fires normally.
    eng.applySnapshot(snap([emitter({ playEpoch: 6 })]), 0.016);
    await tick();
    expect(backend.created.sources.length).toBe(1);
  });

  it("keeps a playing loop alive across resume", async () => {
    const { eng } = engine();
    eng.applySnapshot(snap([emitter({ loop: true, autoplay: true })]), 0.016);
    await tick();
    expect(eng.activeSourceCount).toBe(1);

    await eng.suspend();
    await eng.resume();
    eng.applySnapshot(snap([emitter({ loop: true, autoplay: true })]), 0.016);
    expect(eng.activeSourceCount).toBe(1); // loop not stopped or re-fired
  });
});
