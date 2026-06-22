import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import {
  createAudioEngineOrThrow,
  createAudioMixer,
} from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

const MUSIC_GAIN_INDEX = 1; // master=0, then music,sfx,ui,ambient,voice

describe("ducking + music crossfade (AU-11)", () => {
  it("equal-power crossfade keeps summed power ~constant at the midpoint", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);

    mixer.setMusicCrossfade(0.5, 0.02);
    const a = mixer.musicSubInput("a") as unknown as FakeGainNode;
    const b = mixer.musicSubInput("b") as unknown as FakeGainNode;

    expect(a.gain.value).toBeCloseTo(Math.SQRT1_2);
    expect(b.gain.value).toBeCloseTo(Math.SQRT1_2);
    expect(a.gain.value ** 2 + b.gain.value ** 2).toBeCloseTo(1);
  });

  it("fully crossfades from A to B", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);
    const a = mixer.musicSubInput("a") as unknown as FakeGainNode;
    const b = mixer.musicSubInput("b") as unknown as FakeGainNode;

    mixer.setMusicCrossfade(1, 0.02);
    expect(a.gain.value).toBeCloseTo(0);
    expect(b.gain.value).toBeCloseTo(1);
  });

  it("ducks a bus (composed with authored gain) and recovers click-free", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);
    const music = backend.created.gains[MUSIC_GAIN_INDEX] as FakeGainNode;

    mixer.setBusGain("music", 0.8, 0);
    mixer.duckBus("music", 0.25, 0.05);
    // effective = authored 0.8 * duck 0.25 = 0.2, via a ramp (not a step).
    expect(music.gain.lastEvent()?.method).toBe("linearRampToValueAtTime");
    expect(music.gain.lastEvent()?.value).toBeCloseTo(0.2);

    mixer.duckBus("music", 1, 0.05); // recover
    expect(music.gain.lastEvent()?.value).toBeCloseTo(0.8);
  });
});

function localVoiceEmitter(): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("dialogue"),
    clipVersion: 1,
    busId: "voice",
    gain: 1,
    loop: true,
    autoplay: true,
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
    lowpassFrequency: 22000,
    lowpassQ: 0.7,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function snap(emitters: AudioEmitterPacket[]): RenderSnapshot {
  return {
    audioEmitters: emitters,
    transforms: new Float32Array(0),
  } as unknown as RenderSnapshot;
}

describe("auto-duck (AU-11)", () => {
  it("ducks music while a dialogue voice plays and recovers when it stops", () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngineOrThrow({
      backend,
      resolveClip: () => ({
        bytes: new ArrayBuffer(16),
        streaming: false,
        durationHint: 1,
      }),
    });
    const music = backend.created.gains[MUSIC_GAIN_INDEX] as FakeGainNode;

    eng.applySnapshot(snap([localVoiceEmitter()]), 0.016);
    expect(music.gain.lastEvent()?.value).toBeCloseTo(0.3); // ducked

    eng.applySnapshot(snap([]), 0.016); // dialogue gone
    expect(music.gain.lastEvent()?.value).toBeCloseTo(1); // recovered
  });
});
