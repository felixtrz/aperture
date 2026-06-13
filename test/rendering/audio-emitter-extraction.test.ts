import { describe, expect, it } from "vitest";
import { createAudioClipHandle } from "@aperture-engine/simulation";
import {
  createExtractionApp,
  withAudioEmitter,
  withAudioListener,
  withTransform,
} from "@aperture-engine/runtime";
import {
  AudioDistanceModel,
  AudioSimulationSpace,
  createAudioClipAsset,
  createAudioEmitter,
  validateAudioEmitterInput,
} from "@aperture-engine/render";

function readyClip(app: ReturnType<typeof createExtractionApp>, id: string) {
  const clip = createAudioClipHandle(id);
  app.assets.register(clip);
  app.assets.markReady(
    clip,
    createAudioClipAsset({ url: `${id}.mp3`, durationHint: 1 }),
  );
  return clip;
}

describe("audio emitter extraction (AU-2)", () => {
  it("extracts an intent-only emitter packet with a WORLD transform offset", () => {
    const app = createExtractionApp();
    const clip = readyClip(app, "boom");
    const emitter = app.spawn(
      withTransform({ translation: [3, 0, 0] }),
      withAudioEmitter({
        clip,
        busId: "sfx",
        gain: 0.8,
        loop: true,
        playEpoch: 2,
        simulationSpace: AudioSimulationSpace.World,
        distanceModel: AudioDistanceModel.Inverse,
        refDistance: 2,
        maxDistance: 50,
      }),
    );

    const snapshot = app.extract(1);
    const packet = snapshot.audioEmitters?.[0];

    expect(snapshot.report.audioEmitters).toBe(1);
    expect(packet).toMatchObject({
      key: { kind: "entity" },
      entity: { index: emitter.index, generation: emitter.generation },
      clip,
      clipVersion: 1,
      busId: "sfx",
      loop: true,
      playEpoch: 2,
      simulationSpace: "world",
      distanceModel: "inverse",
      refDistance: 2,
      maxDistance: 50,
      audibility: "audible",
      muted: false,
      layerMask: 1,
    });
    expect(packet?.gain).toBeCloseTo(0.8);
    expect(packet?.worldTransformOffset).toBeGreaterThanOrEqual(0);
    // The emitter's WORLD position rides snapshot.transforms at col3.
    const offset = packet?.worldTransformOffset ?? 0;
    expect(
      Array.from(snapshot.transforms.slice(offset + 12, offset + 15)),
    ).toEqual([3, 0, 0]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("extracts a single active listener pose", () => {
    const app = createExtractionApp();
    const listener = app.spawn(
      withTransform({ translation: [0, 1, 2] }),
      withAudioListener({ masterGain: 0.5 }),
    );

    const snapshot = app.extract(1);

    expect(snapshot.audioListener).toMatchObject({
      entity: { index: listener.index, generation: listener.generation },
      masterGain: 0.5,
    });
    const offset = snapshot.audioListener?.worldTransformOffset ?? 0;
    expect(
      Array.from(snapshot.transforms.slice(offset + 12, offset + 15)),
    ).toEqual([0, 1, 2]);
  });

  it("diagnoses a second active listener and honors the first", () => {
    const app = createExtractionApp();
    app.spawn(withTransform({ translation: [0, 0, 0] }), withAudioListener());
    app.spawn(withTransform({ translation: [9, 9, 9] }), withAudioListener());

    const snapshot = app.extract(1);

    expect(snapshot.audioListener).toBeDefined();
    expect(snapshot.diagnostics.map((d) => d.code)).toContain(
      "render.audio.multipleListeners",
    );
  });

  it("skips an inactive emitter with a diagnostic (silent, not dropped state)", () => {
    const app = createExtractionApp();
    const clip = readyClip(app, "boom");
    app.spawn(withTransform(), withAudioEmitter({ clip, active: false }));

    const snapshot = app.extract(1);

    expect(snapshot.audioEmitters ?? []).toEqual([]);
    expect(snapshot.diagnostics.map((d) => d.code)).toContain(
      "render.audio.inactive",
    );
  });

  it("skips an emitter whose clip is not ready, with a diagnostic", () => {
    const app = createExtractionApp();
    const clip = createAudioClipHandle("pending");
    app.assets.register(clip); // registered, never markReady
    app.spawn(withTransform(), withAudioEmitter({ clip }));

    const snapshot = app.extract(1);

    expect(snapshot.audioEmitters ?? []).toEqual([]);
    expect(
      snapshot.diagnostics.some((d) => d.code.startsWith("render.audio.clip")),
    ).toBe(true);
  });

  it("emits no audio fields when there are no emitters or listeners", () => {
    const app = createExtractionApp();
    const snapshot = app.extract(1);

    expect("audioEmitters" in snapshot).toBe(false);
    expect("audioListener" in snapshot).toBe(false);
  });
});

describe("audio authoring helpers (AU-2)", () => {
  it("createAudioEmitter fills defaults", () => {
    const data = createAudioEmitter({ clip: createAudioClipHandle("c") });

    expect(data.clipId).toBe("audio-clip:c");
    expect(data.busId).toBe("sfx");
    expect(data.gain).toBe(1);
    expect(data.simulationSpace).toBe("world");
    expect(data.panningModel).toBe("equalpower");
    expect(data.distanceModel).toBe("inverse");
    expect(data.active).toBe(true);
  });

  it("validateAudioEmitterInput accepts a sane emitter and flags bad ranges", () => {
    const ok = validateAudioEmitterInput({
      clip: createAudioClipHandle("c"),
      gain: 1,
      refDistance: 1,
      maxDistance: 100,
    });
    expect(ok.valid).toBe(true);

    const bad = validateAudioEmitterInput({
      clip: createAudioClipHandle("c"),
      gain: -1,
      refDistance: 100,
      maxDistance: 1, // max < ref
      coneOuterGain: 5, // > 1
    });
    const codes = bad.diagnostics.map((d) => d.code);
    expect(bad.valid).toBe(false);
    expect(codes).toContain("audio.invalidGain");
    expect(codes).toContain("audio.invalidDistance");
    expect(codes).toContain("audio.invalidCone");
  });
});
