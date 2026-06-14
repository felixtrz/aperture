import { describe, expect, it } from "vitest";

import { createAudioEngine } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

// master=0, then music,sfx,ui,ambient,voice (AUDIO_BUS_IDS order).
const BUS_GAIN_INDEX = {
  music: 1,
  sfx: 2,
  ambient: 4,
} as const;

describe("game pause + diagnostics (AU-16/19)", () => {
  it("pause silences sfx/ambient but keeps music playing; resume restores", () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({ backend });
    const sfx = backend.created.gains[BUS_GAIN_INDEX.sfx] as FakeGainNode;
    const music = backend.created.gains[BUS_GAIN_INDEX.music] as FakeGainNode;
    const ambient = backend.created.gains[
      BUS_GAIN_INDEX.ambient
    ] as FakeGainNode;

    eng.setPaused(true);
    expect(sfx.gain.lastEvent()?.value).toBeCloseTo(0);
    expect(ambient.gain.lastEvent()?.value).toBeCloseTo(0);
    expect(music.gain.value).toBeCloseTo(1); // music untouched by pause

    eng.setPaused(false);
    expect(sfx.gain.lastEvent()?.value).toBeCloseTo(1);
  });

  it("exposes a diagnostics summary", () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({ backend });

    const diag = eng.diagnostics();
    expect(diag.state).toBe("running");
    expect(diag.activeVoices).toBe(0);
    expect(diag.virtualVoices).toBe(0);
    expect(diag.decodeCount).toBe(0);
    expect(typeof diag.outputLatency).toBe("number");
  });

  it("setAudioOffset shifts a one-shot's scheduled start time", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    backend.advanceTime(1);
    const eng = createAudioEngine({
      backend,
      resolveClip: () => ({
        bytes: new ArrayBuffer(16),
        streaming: false,
        durationHint: 1,
      }),
    });
    eng.setAudioOffset(0.2);
    eng.applySnapshot(
      {
        audioEmitters: [oneShot()],
        transforms: new Float32Array(0),
      } as never,
      0.016,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    // start(when, offset): when = currentTime(1) + audioOffset(0.2).
    expect(backend.created.sources[0]?.startArgs?.[0]).toBeCloseTo(1.2);
  });
});

function oneShot() {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: { kind: "audio-clip", id: "c" },
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: false,
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
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}
