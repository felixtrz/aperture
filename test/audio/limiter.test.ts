import { describe, expect, it } from "vitest";

import { createAudioEngine } from "@aperture-engine/audio";
import { FakeAudioBackend } from "@aperture-engine/audio/test-support";

describe("master limiter (AU-13)", () => {
  it("degrades to the DynamicsCompressor limiter when no worklet is available", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngine({ backend });

    // The fake has no AudioWorklet, so the upgrade declines and the shipped
    // master DynamicsCompressor limiter stays in place (the degraded path).
    expect(await eng.enableWorkletLimiter()).toBe(false);
    expect(backend.created.compressors.length).toBe(1);
  });
});
