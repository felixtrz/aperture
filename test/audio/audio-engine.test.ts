import { describe, expect, it } from "vitest";

import { createAudioEngine } from "@aperture-engine/audio";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

describe("audio engine lifecycle", () => {
  it("unlocks a suspended context by resuming it", async () => {
    const backend = new FakeAudioBackend({ state: "suspended" });
    const engine = createAudioEngine({ backend });

    expect(engine.state).toBe("suspended");
    await engine.unlock();
    expect(engine.state).toBe("running");
  });

  it("is idempotent: unlocking a running context does nothing", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const engine = createAudioEngine({ backend });

    await engine.unlock();
    expect(engine.state).toBe("running");
  });

  it("suspends and resumes around the running state", async () => {
    const backend = new FakeAudioBackend();
    const engine = createAudioEngine({ backend });

    await engine.unlock();
    await engine.suspend();
    expect(engine.state).toBe("suspended");
    await engine.resume();
    expect(engine.state).toBe("running");
  });

  it("delegates gain control to the mixer", () => {
    const backend = new FakeAudioBackend();
    const engine = createAudioEngine({ backend });

    engine.setBusGain("music", 0.3, 0.02);
    expect(engine.mixer.getBusGain("music")).toBeCloseTo(0.3);

    engine.setMasterGain(0.7, 0.02);
    expect(engine.mixer.getMasterGain()).toBeCloseTo(0.7);
  });

  it("exposes FFT taps and disposes idempotently", () => {
    const backend = new FakeAudioBackend();
    const engine = createAudioEngine({ backend });

    expect(engine.analyser("master")).toBeDefined();
    expect(engine.analyser("sfx")).toBeDefined();

    engine.dispose();
    engine.dispose(); // second call is a no-op
  });

  it("honours initial bus and master gains from options", () => {
    const backend = new FakeAudioBackend();
    const engine = createAudioEngine({
      backend,
      mixer: { masterGain: 0.5, busGains: { music: 0.25 } },
    });

    expect(engine.mixer.getMasterGain()).toBeCloseTo(0.5);
    expect(engine.mixer.getBusGain("music")).toBeCloseTo(0.25);
    expect(engine.mixer.getBusGain("sfx")).toBeCloseTo(1);
  });
});
