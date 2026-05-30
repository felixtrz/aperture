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
 * End-to-end (headless) milestone proof for M2-T9: a skinned GLB (2-joint
 * skin) with a CUBICSPLINE rotation clip on a joint, driven entirely through
 * createApertureApp + the public spawn.gltf/spawn.animation API. Asserts the
 * engine-owned animation status and that the CUBICSPLINE clip drives the joint.
 *
 * The live pixel-readback / render-control proof (Playwright) is WebGPU-only
 * and cannot run in this environment (navigator.gpu is unavailable); see the
 * [B1] blocker in docs/SOTA_ROADMAP.md. This headless test is the runnable
 * alternative that exercises import → skeleton → clip → driver → joint pose.
 */
function skinnedCubicGlb(): Uint8Array {
  const buffer = new ArrayBuffer(276);
  const view = new DataView(buffer);
  const f32 = (offset: number, value: number) =>
    view.setFloat32(offset, value, true);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => f32(i * 4, v)); // POSITION 0..36
  [0, 1, 2].forEach((v, i) => view.setUint16(36 + i * 2, v, true)); // indices 36..42
  // inverse-bind: two identity MAT4 (44..172)
  [0, 5, 10, 15].forEach((d) => f32(44 + d * 4, 1));
  [0, 5, 10, 15].forEach((d) => f32(44 + 64 + d * 4, 1));
  [0, 1].forEach((v, i) => f32(172 + i * 4, v)); // times 172..180
  // CUBICSPLINE rotation output (180..276): per keyframe [inTangent, value,
  // outTangent], each a VEC4. kf0 value = identity, kf1 value = 90deg about Z;
  // zero tangents.
  const rot = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0, // kf0: in, value(identity), out
    0,
    0,
    0,
    0,
    0,
    0,
    0.7071,
    0.7071,
    0,
    0,
    0,
    0, // kf1: in, value(90Z), out
  ];
  rot.forEach((v, i) => f32(180 + i * 4, v));

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "SkinnedMesh", mesh: 0, skin: 0 },
      { name: "Joint0" },
      { name: "Joint1" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    skins: [{ joints: [1, 2], inverseBindMatrices: 2 }],
    animations: [
      {
        name: "Bend",
        samplers: [{ input: 3, output: 4, interpolation: "CUBICSPLINE" }],
        channels: [{ sampler: 0, target: { node: 1, path: "rotation" } }],
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      { bufferView: 2, componentType: 5126, type: "MAT4", count: 2 },
      { bufferView: 3, componentType: 5126, type: "SCALAR", count: 2 },
      { bufferView: 4, componentType: 5126, type: "VEC4", count: 6 },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
      { buffer: 0, byteOffset: 44, byteLength: 128 },
      { buffer: 0, byteOffset: 172, byteLength: 8 },
      { buffer: 0, byteOffset: 180, byteLength: 96 },
    ],
    buffers: [{ byteLength: 276 }],
  };

  return createGlb([
    jsonChunk(root),
    bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(new Uint8Array(buffer))),
  ]);
}

function jointRotation(root: Entity, key: string): readonly number[] {
  const state = root.getValue(Animation, "state") as AnimationDriverState;
  const joint = state.targets.get(key);
  if (joint === undefined) {
    throw new Error(`expected a joint entity for ${key}`);
  }
  return Array.from(joint.getVectorView(LocalTransform, "rotation"));
}

describe("skinned + animated GLB pipeline (headless M2-T9 proof)", () => {
  it("imports a skin + CUBICSPLINE clip and drives the joint via the engine API", async () => {
    const dataUrl = `data:model/gltf-binary;base64,${Buffer.from(
      skinnedCubicGlb(),
    ).toString("base64")}`;
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        assets: { model: asset.gltf(dataUrl, { preload: "blocking" }) },
      }),
    });

    const handle = app.context.assets.gltf("model");
    expect(handle.ready.value).toBe(true);

    // Engine-owned skin + clip status surfaced on the loaded scene.
    const scene = handle.scene.value!;
    expect(scene.skin.skins[0]!.jointCount).toBe(2);
    expect(scene.clips.map((clip) => clip.name)).toContain("Bend");
    // The CUBICSPLINE clip imported without an unsupported-interpolation error.
    expect(
      scene.animationReport.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "gltfAnimation.unsupportedInterpolation",
      ),
    ).toBe(false);

    const root = app.context.spawn.gltf(handle);
    const animation = app.context.spawn.animation(root);
    expect(animation.clipIds).toContain("Bend");

    // Joint starts at identity rotation.
    expect(jointRotation(root, "model:node:1")[2]).toBeCloseTo(0, 5);

    animation.playClip("Bend", { loop: "once" });
    app.step(0.5);

    // Engine-owned playback status reflects the active CUBICSPLINE clip.
    expect(animation.activeClipId).toBe("Bend");
    expect(animation.time).toBeCloseTo(0.5, 5);

    // The CUBICSPLINE clip drove the joint rotation off identity (toward the
    // 90deg-about-Z keyframe), proving M2-T1's CUBICSPLINE interpolant
    // end-to-end through the engine animation driver.
    const rotation = jointRotation(root, "model:node:1");
    expect(rotation[2]).toBeGreaterThan(0.1); // z component grew
    expect(rotation[3]).toBeLessThan(1); // w shrank from identity
    // Quaternion stays unit length.
    const length = Math.hypot(
      rotation[0]!,
      rotation[1]!,
      rotation[2]!,
      rotation[3]!,
    );
    expect(length).toBeCloseTo(1, 5);
  });
});
