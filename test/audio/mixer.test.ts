import { describe, expect, it } from "vitest";

import { AUDIO_BUS_IDS, createAudioMixer } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

describe("audio mixer bus graph", () => {
  it("creates a gain + analyser per bus plus a master chain with a limiter", () => {
    const backend = new FakeAudioBackend();
    createAudioMixer(backend);

    // master gain + one gain per bus + two music crossfade sub-buses.
    expect(backend.created.gains.length).toBe(1 + AUDIO_BUS_IDS.length + 2);
    // master analyser + one tap per bus.
    expect(backend.created.analysers.length).toBe(1 + AUDIO_BUS_IDS.length);
    // exactly one master limiter.
    expect(backend.created.compressors.length).toBe(1);
  });

  it("routes a bus through an analyser into the master, and the limiter into the destination", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);

    const sfx = mixer.busInput("sfx") as unknown as FakeGainNode;
    expect(sfx.connections.length).toBe(1); // -> its analyser

    const limiter = backend.created.compressors[0];
    expect(limiter?.connections).toContain(backend.fakeDestination);
  });

  it("ramps bus gain instead of stepping it (click-free)", () => {
    const backend = new FakeAudioBackend();
    backend.advanceTime(1);
    const mixer = createAudioMixer(backend);

    const sfx = mixer.busInput("sfx") as unknown as FakeGainNode;
    mixer.setBusGain("sfx", 0.25, 0.02);

    const last = sfx.gain.lastEvent();
    expect(last?.method).toBe("linearRampToValueAtTime");
    expect(last?.value).toBeCloseTo(0.25);
    expect(last?.time).toBeCloseTo(1.02);
    expect(mixer.getBusGain("sfx")).toBeCloseTo(0.25);
  });

  it("applies an instantaneous set when rampSec is zero", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);

    mixer.setMasterGain(0.5, 0);

    const masterGain = backend.created.gains[0] as FakeGainNode;
    expect(masterGain.gain.lastEvent()?.method).toBe("setValueAtTime");
    expect(mixer.getMasterGain()).toBeCloseTo(0.5);
  });

  it("clamps negative gain to zero", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);

    mixer.setBusGain("music", -3);
    expect(mixer.getBusGain("music")).toBe(0);
  });

  it("exposes per-bus and master FFT taps", () => {
    const backend = new FakeAudioBackend();
    const mixer = createAudioMixer(backend);

    expect(mixer.analyser("master")).toBeDefined();
    for (const bus of AUDIO_BUS_IDS) {
      expect(mixer.analyser(bus)).toBeDefined();
    }
  });
});
