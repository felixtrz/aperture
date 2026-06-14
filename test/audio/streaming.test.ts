import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { createAudioEngine, type ResolvedClip } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakeStreamingSource,
} from "@aperture-engine/audio/test-support";

function musicEmitter(
  over: Partial<AudioEmitterPacket> = {},
): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("theme"),
    clipVersion: 1,
    busId: "music",
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
    occlusion: 0,
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
  const eng = createAudioEngine({
    backend,
    resolveClip: (): ResolvedClip => ({
      url: "https://example/theme.ogg",
      streaming: true,
      durationHint: -1,
    }),
  });
  return { backend, eng };
}

describe("streaming music (AU-10)", () => {
  it("plays a streaming clip via a media-element source with NO decode", async () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([musicEmitter()]), 0.016);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(backend.created.streams.length).toBe(1);
    const stream = backend.created.streams[0] as FakeStreamingSource;
    expect(stream.url).toBe("https://example/theme.ogg");
    expect(stream.played).toBe(true);
    expect(stream.loop).toBe(true);
    // Memory stays flat: no AudioBuffer is decoded for a streamed track.
    expect(eng.clips.decodeCount).toBe(0);
    expect(backend.decodeCalls).toBe(0);
    // No throwaway AudioBufferSourceNode for a streamed voice.
    expect(backend.created.sources.length).toBe(0);
  });

  it("stops the media element when the emitter vanishes", () => {
    const { backend, eng } = engine();
    eng.applySnapshot(snap([musicEmitter()]), 0.016);
    const stream = backend.created.streams[0] as FakeStreamingSource;

    eng.applySnapshot(snap([]), 0.016); // track removed
    expect(stream.stopped).toBe(true);
    expect(eng.activeVoiceCount).toBe(0);
  });
});
