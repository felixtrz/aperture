import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { GLB_BINARY_CHUNK_TYPE } from "@aperture-engine/render";
import { Animation, type AnimationDriverState } from "@aperture-engine/runtime";
import { LocalTransform, type Entity } from "@aperture-engine/simulation";

import {
  bytesChunk,
  createGlb,
  jsonChunk,
} from "../assets/glb-buffer-fixture.js";

/**
 * A renderable GLB (POSITION + indices) with a "Joint" node driven by two
 * translation clips: "Walk" moves +Y, "Run" moves +X, so playback and
 * crossfade are distinguishable on the joint's LocalTransform axes.
 */
function animatedGlb(): Uint8Array {
  const buffer = new ArrayBuffer(100);
  const view = new DataView(buffer);
  const f32 = (offset: number, value: number) =>
    view.setFloat32(offset, value, true);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => f32(i * 4, v)); // POSITION 0..36
  [0, 1, 2].forEach((v, i) => view.setUint16(36 + i * 2, v, true)); // indices 36..42
  [0, 1].forEach((v, i) => f32(44 + i * 4, v)); // times 44..52
  [0, 0, 0, 0, 4, 0].forEach((v, i) => f32(52 + i * 4, v)); // Walk +Y 52..76
  [0, 0, 0, 8, 0, 0].forEach((v, i) => f32(76 + i * 4, v)); // Run +X 76..100

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: "Mesh", mesh: 0 }, { name: "Joint" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    animations: [
      {
        name: "Walk",
        samplers: [{ input: 2, output: 3, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
      {
        name: "Run",
        samplers: [{ input: 2, output: 4, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      { bufferView: 2, componentType: 5126, type: "SCALAR", count: 2 },
      { bufferView: 3, componentType: 5126, type: "VEC3", count: 2 },
      { bufferView: 4, componentType: 5126, type: "VEC3", count: 2 },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
      { buffer: 0, byteOffset: 44, byteLength: 8 },
      { buffer: 0, byteOffset: 52, byteLength: 24 },
      { buffer: 0, byteOffset: 76, byteLength: 24 },
    ],
    buffers: [{ byteLength: 100 }],
  };

  return createGlb([
    jsonChunk(root),
    bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(new Uint8Array(buffer))),
  ]);
}

async function spawnAnimatedModel() {
  const dataUrl = `data:model/gltf-binary;base64,${Buffer.from(
    animatedGlb(),
  ).toString("base64")}`;
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      assets: { model: asset.gltf(dataUrl, { preload: "blocking" }) },
    }),
  });
  return app;
}

function jointTranslation(root: Entity): readonly number[] {
  const state = root.getValue(Animation, "state") as AnimationDriverState;
  const joint = state.targets.get("model:node:1");
  if (joint === undefined) {
    throw new Error("expected a joint entity for model:node:1");
  }
  return Array.from(joint.getVectorView(LocalTransform, "translation"));
}

describe("public glTF animation playback API", () => {
  it("playClip drives the targeted joint LocalTransform via the engine API", async () => {
    const app = await spawnAnimatedModel();
    const root = app.context.spawn.gltf(app.context.assets.gltf("model"));
    expect(root.hasComponent(Animation)).toBe(true);

    const animation = app.context.spawn.animation(root);
    expect(animation.clipIds).toContain("Walk");

    animation.playClip("Walk", { loop: "once" });
    app.step(0.5);

    // Walk moves +Y over 1s; at t=0.5 the joint is at (0, 2, 0).
    const t = jointTranslation(root);
    expect(t[0]).toBeCloseTo(0, 4);
    expect(t[1]).toBeCloseTo(2, 4);
  });

  it("crossFade blends to the target clip then settles on it", async () => {
    const app = await spawnAnimatedModel();
    const root = app.context.spawn.gltf(app.context.assets.gltf("model"));
    const animation = app.context.spawn.animation(root);

    animation.playClip("Walk", { loop: "once" });
    app.step(0.5); // Walk: +Y
    expect(jointTranslation(root)[1]).toBeGreaterThan(0.5);

    animation.crossFade("Walk", "Run", 1.0);
    app.step(0.5);
    expect(animation.isCrossFading).toBe(true);

    // Advance well past the crossfade: only Run (+X) contributes.
    app.step(1.0);
    expect(animation.isCrossFading).toBe(false);
    const settled = jointTranslation(root);
    expect(settled[0]).toBeGreaterThan(0.5); // Run moved +X
    expect(animation.activeClipId).toBe("Run");
  });

  it("pause freezes and seek scrubs the animation", async () => {
    const app = await spawnAnimatedModel();
    const root = app.context.spawn.gltf(app.context.assets.gltf("model"));
    const animation = app.context.spawn.animation(root);

    animation.playClip("Walk", { loop: "once" });
    app.step(0.5);
    const pausedY = jointTranslation(root)[1]!;

    animation.pause();
    app.step(1.0);
    app.step(1.0);
    // Frozen: the joint did not advance while paused.
    expect(jointTranslation(root)[1]).toBeCloseTo(pausedY, 5);

    animation.seek(1.0);
    app.step(0);
    // Scrubbed to the end of Walk (0, 4, 0).
    expect(jointTranslation(root)[1]).toBeCloseTo(4, 4);
  });
});
