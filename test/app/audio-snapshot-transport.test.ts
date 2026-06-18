import { describe, expect, it } from "vitest";

import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  FogPacket,
  ParticleEmitterPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { FogMode } from "@aperture-engine/render";
import {
  createAudioClipHandle,
  createParticleEffectHandle,
} from "@aperture-engine/simulation";
import {
  createSharedSnapshotPlaceholder,
  hasUnsupportedSharedSnapshotPayload,
} from "../../packages/app/src/worker/snapshot.js";

function baseSnapshot(extra: Partial<RenderSnapshot> = {}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
    ...extra,
  };
}

describe("shared snapshot transport eligibility", () => {
  it("keeps a pure mesh+light frame eligible for the SharedArrayBuffer path", () => {
    expect(hasUnsupportedSharedSnapshotPayload(baseSnapshot())).toBe(false);
  });

  it("keeps fogged mesh frames eligible for the SharedArrayBuffer path", () => {
    const snapshot = baseSnapshot({
      fogs: [
        {
          fogId: 1,
          entity: { index: 1, generation: 1 },
          mode: FogMode.Linear,
          color: [0.5, 0.6, 0.7, 1],
          density: 0,
          start: 10,
          end: 50,
          layerMask: 1,
        } satisfies FogPacket,
      ],
    });

    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(false);
  });

  it("keeps particle emitter frames eligible for the SharedArrayBuffer path", () => {
    const snapshot = baseSnapshot({
      particleEmitters: [
        {
          emitterId: 1,
          entity: { index: -1, generation: 0 },
          effect: createParticleEffectHandle("smoke"),
          effectVersion: 1,
          capacity: 8,
          seed: 1,
          resetEpoch: 0,
          timeScale: 1,
          simulationSpace: "world",
          worldTransformOffset: 0,
          boundsIndex: 0,
          layerMask: 1,
          sortKey: {
            queue: "transparent",
            viewId: 0,
            layer: 0,
            order: 0,
            pipelineKey: "gpu-particles",
            materialKey: "particle-effect:smoke",
            meshKey: "particle-quad",
            depth: 0,
            stableId: 1,
          },
        } satisfies ParticleEmitterPacket,
      ],
    });

    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(false);
  });

  it("keeps audio emitter frames eligible for the SharedArrayBuffer path", () => {
    const snapshot = baseSnapshot({
      audioEmitters: [audioEmitter({ worldTransformOffset: 0 })],
    });

    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(false);
  });

  it("keeps audio listener frames eligible for the SharedArrayBuffer path", () => {
    const snapshot = baseSnapshot({
      audioListener: audioListener({ worldTransformOffset: 0 }),
    });

    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(false);
  });

  it("copies only audio matrices into the shared placeholder snapshot", () => {
    const transforms = new Float32Array(48);
    for (let index = 0; index < transforms.length; index += 1) {
      transforms[index] = index + 1;
    }

    const snapshot = baseSnapshot({
      transforms,
      audioEmitters: [
        audioEmitter({ worldTransformOffset: 32 }),
        audioEmitter({ worldTransformOffset: 0 }),
      ],
      audioListener: audioListener({ worldTransformOffset: 32 }),
    });

    const placeholder = createSharedSnapshotPlaceholder(snapshot);

    expect(placeholder.views).toEqual([]);
    expect(placeholder.meshDraws).toEqual([]);
    expect(placeholder.transforms).toEqual(
      new Float32Array([
        ...transforms.slice(32, 48),
        ...transforms.slice(0, 16),
      ]),
    );
    expect(
      placeholder.audioEmitters?.map((packet) => packet.worldTransformOffset),
    ).toEqual([0, 16]);
    expect(placeholder.audioListener?.worldTransformOffset).toBe(0);
    expect(placeholder.report.audioEmitters).toBe(2);
  });
});

function audioEmitter(
  input: Partial<AudioEmitterPacket> = {},
): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: createAudioClipHandle("engine"),
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: true,
    autoplay: true,
    playEpoch: 1,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "world",
    distanceModel: "inverse",
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    occlusion: 0,
    lowpassFrequency: 22050,
    lowpassQ: 0.7,
    offsetSec: 0,
    loopStart: 0,
    loopEnd: 0,
    audibility: "audible",
    muted: false,
    worldTransformOffset: 0,
    layerMask: 1,
    ...input,
  };
}

function audioListener(
  input: Partial<AudioListenerPacket> = {},
): AudioListenerPacket {
  return {
    listenerId: 1,
    entity: { index: 2, generation: 0 },
    worldTransformOffset: 0,
    masterGain: 1,
    ...input,
  };
}
