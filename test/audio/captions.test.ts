import { describe, expect, it } from "vitest";

import type { AudioClipEvent, ResolvedClip } from "@aperture-engine/audio";
import { createAudioEngineOrThrow } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeGainNode,
} from "@aperture-engine/audio/test-support";

function oneShotSnapshot() {
  return {
    audioEmitters: [
      {
        key: { kind: "entity", id: 1 },
        entity: { index: 1, generation: 0 },
        clip: { kind: "audio-clip", id: "line1" },
        clipVersion: 1,
        busId: "voice",
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
        occlusion: 0,
        offsetSec: 0,
        loopStart: 0,
        loopEnd: 0,
        audibility: "audible",
        muted: false,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    transforms: new Float32Array(0),
  } as never;
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("caption hook + mono downmix (AU-18)", () => {
  it("emits a clip start event carrying the captionTrackId", async () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const events: AudioClipEvent[] = [];
    const eng = createAudioEngineOrThrow({
      backend,
      resolveClip: (clipId): ResolvedClip => ({
        bytes: new ArrayBuffer(16),
        streaming: false,
        durationHint: 1,
        captionTrackId: `caption:${clipId}`,
      }),
    });
    eng.onClipEvent((event) => events.push(event));

    eng.applySnapshot(oneShotSnapshot(), 0.016);
    await tick();

    const start = events.find((e) => e.type === "start");
    expect(start).toBeDefined();
    expect(start?.clipId).toBe("audio-clip:line1");
    expect(start?.captionTrackId).toBe("caption:audio-clip:line1");
  });

  it("collapses the master to mono and restores stereo", () => {
    const backend = new FakeAudioBackend({ state: "running" });
    const eng = createAudioEngineOrThrow({ backend });
    const master = backend.created.gains[0] as FakeGainNode;

    eng.setMonoDownmix(true);
    expect(master.channelCount).toBe(1);
    expect(master.channelCountMode).toBe("explicit");

    eng.setMonoDownmix(false);
    expect(master.channelCount).toBe(2);
  });
});
