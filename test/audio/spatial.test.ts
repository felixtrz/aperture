import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { createAudioEngine, type ResolvedClip } from "@aperture-engine/audio";
import {
  FakeAudioBackend,
  type FakePannerNode,
} from "@aperture-engine/audio/test-support";

const CLIP = createAudioClipHandle("fire");

function worldEmitter(
  over: Partial<AudioEmitterPacket> = {},
): AudioEmitterPacket {
  return {
    key: { kind: "entity", id: 1 },
    entity: { index: 1, generation: 0 },
    clip: CLIP,
    clipVersion: 1,
    busId: "sfx",
    gain: 1,
    loop: true,
    autoplay: true,
    playEpoch: 0,
    stopEpoch: 0,
    timeScale: 1,
    priority: 0,
    panningModel: "equalpower",
    simulationSpace: "world",
    distanceModel: "inverse",
    refDistance: 2,
    maxDistance: 50,
    rolloffFactor: 1,
    coneInnerAngle: 90,
    coneOuterAngle: 180,
    coneOuterGain: 0.1,
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

/** identity at `offset`, translated to (tx,ty,tz). Column-major, 16 floats. */
function poseInto(
  out: Float32Array,
  offset: number,
  tx: number,
  ty: number,
  tz: number,
): void {
  out.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1], offset);
}

function snapshot(
  emitters: AudioEmitterPacket[],
  listener: AudioListenerPacket | undefined,
  transforms: Float32Array,
): RenderSnapshot {
  return {
    audioEmitters: emitters,
    audioListener: listener,
    transforms,
  } as unknown as RenderSnapshot;
}

function resolver(): ResolvedClip {
  return { bytes: new ArrayBuffer(16), streaming: false, durationHint: 1 };
}

function engine() {
  const backend = new FakeAudioBackend({ state: "running" });
  const eng = createAudioEngine({ backend, resolveClip: () => resolver() });
  return { backend, eng };
}

describe("spatial audio (AU-5/6/7)", () => {
  it("creates a PannerNode for a world emitter and ramps its world position", () => {
    const { backend, eng } = engine();
    const transforms = new Float32Array(16);
    poseInto(transforms, 0, 5, 0, 0); // emitter at x=5

    eng.applySnapshot(snapshot([worldEmitter()], undefined, transforms), 0.016);

    expect(eng.activePannerCount).toBe(1);
    const panner = backend.created.panners[0] as FakePannerNode;
    expect(panner.positionX.lastEvent()?.method).toBe(
      "linearRampToValueAtTime",
    );
    expect(panner.positionX.value).toBe(5);
    expect(panner.positionY.value).toBe(0);
    // Source faces world forward = -col2 = (0,0,-1) for an identity basis.
    expect(panner.orientationZ.value).toBe(-1);
  });

  it("applies distance + cone params and defaults to equalpower", () => {
    const { backend, eng } = engine();
    const transforms = new Float32Array(16);
    poseInto(transforms, 0, 0, 0, 0);

    eng.applySnapshot(snapshot([worldEmitter()], undefined, transforms), 0.016);

    const panner = backend.created.panners[0] as FakePannerNode;
    expect(panner.panningModel).toBe("equalpower");
    expect(panner.distanceModel).toBe("inverse");
    expect(panner.refDistance).toBe(2);
    expect(panner.maxDistance).toBe(50);
    expect(panner.coneInnerAngle).toBe(90);
    expect(panner.coneOuterAngle).toBe(180);
    expect(panner.coneOuterGain).toBeCloseTo(0.1);
  });

  it("does NOT create a PannerNode for a 2D (local) emitter", () => {
    const { backend, eng } = engine();
    eng.applySnapshot(
      snapshot(
        [worldEmitter({ simulationSpace: "local" })],
        undefined,
        new Float32Array(16),
      ),
      0.016,
    );
    expect(eng.activePannerCount).toBe(0);
    expect(backend.created.panners.length).toBe(0);
  });

  it("drives the Web Audio listener pose and master gain from the listener packet", () => {
    const { backend, eng } = engine();
    const transforms = new Float32Array(32);
    poseInto(transforms, 0, 5, 0, 0); // emitter
    poseInto(transforms, 16, 0, 1, 2); // listener at (0,1,2)
    const listener: AudioListenerPacket = {
      listenerId: 7,
      entity: { index: 2, generation: 0 },
      worldTransformOffset: 16,
      masterGain: 0.5,
    };

    eng.applySnapshot(snapshot([worldEmitter()], listener, transforms), 0.016);

    const l = backend.fakeListener;
    expect(l.positionX.value).toBe(0);
    expect(l.positionY.value).toBe(1);
    expect(l.positionZ.value).toBe(2);
    expect(l.forwardZ.value).toBe(-1); // forward = -col2
    expect(l.upY.value).toBe(1); // up = +col1
    expect(eng.mixer.getMasterGain()).toBeCloseTo(0.5);
  });

  it("moving an emitter left→right ramps positionX across frames", () => {
    const { backend, eng } = engine();
    const left = new Float32Array(16);
    poseInto(left, 0, -10, 0, 0);
    eng.applySnapshot(snapshot([worldEmitter()], undefined, left), 0.016);
    const panner = backend.created.panners[0] as FakePannerNode;
    expect(panner.positionX.value).toBe(-10);

    const right = new Float32Array(16);
    poseInto(right, 0, 10, 0, 0);
    eng.applySnapshot(snapshot([worldEmitter()], undefined, right), 0.016);
    expect(panner.positionX.value).toBe(10);
    // Same panner reused (no realloc on move).
    expect(backend.created.panners.length).toBe(1);
  });
});
