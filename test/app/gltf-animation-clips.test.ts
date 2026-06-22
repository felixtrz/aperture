import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { GLB_BINARY_CHUNK_TYPE } from "@aperture-engine/render";
import type { AnimationClip } from "@aperture-engine/simulation";

import {
  bytesChunk,
  createGlb,
  jsonChunk,
} from "../assets/glb-buffer-fixture.js";

/**
 * A minimal renderable GLB (POSITION + indices) extended with a one-joint skin
 * and a LINEAR translation clip on the joint node, so loadSystemGltfAsset
 * exercises clip registration + skeleton import end to end.
 */
function skinnedAnimatedGlb(): Uint8Array {
  const buffer = new ArrayBuffer(140);
  const view = new DataView(buffer);
  const f32 = (offset: number, value: number) =>
    view.setFloat32(offset, value, true);

  // POSITION: 3 vertices (offset 0..36).
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => f32(i * 4, v));
  // indices: u16 0,1,2 (offset 36..42).
  [0, 1, 2].forEach((v, i) => view.setUint16(36 + i * 2, v, true));
  // inverseBindMatrices: identity MAT4 (offset 44..108).
  [0, 5, 10, 15].forEach((diag) => f32(44 + diag * 4, 1));
  // animation times (offset 108..116).
  [0, 1].forEach((v, i) => f32(108 + i * 4, v));
  // animation translation output: (0,0,0), (0,2,0) (offset 116..140).
  [0, 0, 0, 0, 2, 0].forEach((v, i) => f32(116 + i * 4, v));

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: "Indexed", mesh: 0, skin: 0 }, { name: "Joint" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    skins: [{ joints: [1], inverseBindMatrices: 2 }],
    animations: [
      {
        name: "Wiggle",
        samplers: [{ input: 3, output: 4, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      { bufferView: 2, componentType: 5126, type: "MAT4", count: 1 },
      { bufferView: 3, componentType: 5126, type: "SCALAR", count: 2 },
      { bufferView: 4, componentType: 5126, type: "VEC3", count: 2 },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
      { buffer: 0, byteOffset: 44, byteLength: 64 },
      { buffer: 0, byteOffset: 108, byteLength: 8 },
      { buffer: 0, byteOffset: 116, byteLength: 24 },
    ],
    buffers: [{ byteLength: 140 }],
  };

  return createGlb([
    jsonChunk(root),
    bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(new Uint8Array(buffer))),
  ]);
}

describe("app glTF animation clip + skeleton registration", () => {
  it("registers imported clips as 'animation-clip' assets and surfaces skeletons on the loaded scene", async () => {
    const glb = skinnedAnimatedGlb();
    const dataUrl = `data:model/gltf-binary;base64,${Buffer.from(glb).toString(
      "base64",
    )}`;
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        assets: {
          model: asset.gltf(dataUrl, { preload: "blocking" }),
        },
      }),
    });

    const model = app.context.assets.gltf("model");
    expect(model.ready.value).toBe(true);

    const scene = model.scene.value;
    expect(scene).not.toBeNull();

    // Clips are registered under AnimationClipHandles and surfaced.
    expect(scene!.clips).toHaveLength(1);
    const clip = scene!.clips[0]!;
    expect(clip.name).toBe("Wiggle");
    expect(clip.handle.kind).toBe("animation-clip");
    expect(clip.clip.duration).toBeCloseTo(1, 6);
    expect(clip.clip.channels[0]!.targetId).toBe("model:node:1");

    // The clip is present in the AssetRegistry as an 'animation-clip' asset.
    const registered = app.context.assetsRegistry.get<
      "animation-clip",
      AnimationClip
    >(clip.handle);
    expect(registered?.status).toBe("ready");
    expect(registered?.asset?.name).toBe("Wiggle");

    // The skeleton was imported from gltf.skins.
    expect(scene!.skin.skins).toHaveLength(1);
    expect(scene!.skin.skins[0]!.jointCount).toBe(1);
    expect(scene!.skin.skins[0]!.jointNodeIndices).toEqual([1]);
  });
});
