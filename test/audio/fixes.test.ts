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
  type FakeAudioBufferSourceNode,
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
  return { bytes: new ArrayBuffer(16), streaming: false, durationHint: 2 };
}

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("audio fixes", () => {
  it("applies the authored loop window (loopStart/loopEnd) to the looping source", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({ backend, resolveClip: () => resolver() });

    eng.applySnapshot(
      snap([
        emitter({ loop: true, autoplay: true, loopStart: 0.5, loopEnd: 1.5 }),
      ]),
      0.016,
    );
    await tick();

    const source = backend.created.sources.at(-1) as
      | FakeAudioBufferSourceNode
      | undefined;
    expect(source?.loop).toBe(true);
    expect(source?.loopStart).toBe(0.5);
    expect(source?.loopEnd).toBe(1.5);
  });

  it("does NOT set a loop window when loopEnd <= loopStart (loops whole buffer)", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({ backend, resolveClip: () => resolver() });

    eng.applySnapshot(
      snap([emitter({ loop: true, autoplay: true, loopStart: 0, loopEnd: 0 })]),
      0.016,
    );
    await tick();

    const source = backend.created.sources.at(-1) as
      | FakeAudioBufferSourceNode
      | undefined;
    expect(source?.loop).toBe(true);
    expect(source?.loopStart).toBe(0);
    expect(source?.loopEnd).toBe(0);
  });

  it("defers one-shot burst overflow across frames instead of dropping triggers", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({
      backend,
      resolveClip: () => resolver(),
      voice: { maxBurstPerFrame: 4 },
    });

    // Seed at epoch 0 (no fire), then jump +10 in one frame: 4 fire now, 6 carry.
    eng.applySnapshot(snap([emitter({ playEpoch: 0 })]), 0.016);
    await tick();
    expect(backend.created.sources.length).toBe(0);

    for (let frame = 0; frame < 3; frame += 1) {
      eng.applySnapshot(snap([emitter({ playEpoch: 10 })]), 0.016);
      await tick();
    }

    // 4 + 4 + 2 = all 10 triggers eventually fired — none silently dropped.
    expect(backend.created.sources.length).toBe(10);
  });
});
