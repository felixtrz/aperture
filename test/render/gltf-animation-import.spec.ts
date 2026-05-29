import { describe, expect, it } from "vitest";

import { createWorld } from "@aperture-engine/simulation";
import {
  GLB_BINARY_CHUNK_TYPE,
  createGltfEcsAuthoringCommandPlan,
  createGltfReportDrivenImportReportFromGlb,
  createGltfSceneTraversalReport,
  importGltfAnimations,
  replayGltfEcsAuthoringCommands,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
} from "@aperture-engine/render";

import {
  bytesChunk,
  createGlb,
  jsonChunk,
} from "../assets/glb-buffer-fixture.js";

/**
 * Binary layout (all float32, 4-byte aligned):
 *   [0]   times              2  -> [0, 1]
 *   [8]   LINEAR translation 2 VEC3 -> [0,0,0, 2,4,6]
 *   [32]  CUBICSPLINE trans  6 VEC3 (2kf x [in,val,out])
 *   [104] LINEAR weights     4 SCALAR (2kf x 2 morph) -> [0,0, 0.5,0.25]
 */
function animationBinary(): ArrayBuffer {
  const floats = new Float32Array(30);
  floats.set([0, 1], 0); // times
  floats.set([0, 0, 0, 2, 4, 6], 2); // LINEAR translation
  // CUBICSPLINE translation: kf0[in(0), val(0), out(1,0,0)], kf1[in(1,0,0), val(3,0,0), out(0)]
  floats.set([0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 0], 8);
  floats.set([0, 0, 0.5, 0.25], 26); // LINEAR weights (2 morph targets)
  return floats.buffer;
}

function animatedRoot() {
  return {
    asset: { version: "2.0" },
    nodes: [{ name: "Root" }, { name: "Bone" }],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "SCALAR", count: 2 },
      { bufferView: 1, componentType: 5126, type: "VEC3", count: 2 },
      { bufferView: 2, componentType: 5126, type: "VEC3", count: 6 },
      { bufferView: 3, componentType: 5126, type: "SCALAR", count: 4 },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 24 },
      { buffer: 0, byteOffset: 32, byteLength: 72 },
      { buffer: 0, byteOffset: 104, byteLength: 16 },
    ],
    buffers: [{ byteLength: 120 }],
    animations: [
      {
        name: "Move",
        samplers: [{ input: 0, output: 1, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
      {
        name: "Spline",
        samplers: [{ input: 0, output: 2, interpolation: "CUBICSPLINE" }],
        channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
      },
      {
        name: "Morph",
        samplers: [{ input: 0, output: 3, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 1, path: "weights" } }],
      },
    ],
  };
}

describe("glTF animation import", () => {
  it("parses clip name, duration, and per-channel times/values/interpolation", () => {
    const binary = animationBinary();
    const result = importGltfAnimations({
      root: animatedRoot(),
      resolveBufferBytes: () => binary,
    });

    expect(result.report.valid).toBe(true);
    expect(result.clips).toHaveLength(3);

    const move = result.clips.find((c) => c.clip.name === "Move")!.clip;
    expect(move.duration).toBeCloseTo(1, 6);
    expect(move.channels).toHaveLength(1);
    const channel = move.channels[0]!;
    expect(channel.targetId).toBe("gltf:node:1");
    expect(channel.path).toBe("translation");
    expect(channel.interpolation).toBe("LINEAR");
    expect(channel.componentCount).toBe(3);
    expect(Array.from(channel.times)).toEqual([0, 1]);
    expect(Array.from(channel.values)).toEqual([0, 0, 0, 2, 4, 6]);
  });

  it("imports a CUBICSPLINE channel without an unsupported diagnostic and preserves the 3x stride", () => {
    const binary = animationBinary();
    const result = importGltfAnimations({
      root: animatedRoot(),
      resolveBufferBytes: () => binary,
    });

    expect(
      result.report.diagnostics.some(
        (d) => d.code === "gltfAnimation.unsupportedInterpolation",
      ),
    ).toBe(false);

    const spline = result.clips.find((c) => c.clip.name === "Spline")!.clip;
    const channel = spline.channels[0]!;
    expect(channel.interpolation).toBe("CUBICSPLINE");
    expect(channel.componentCount).toBe(3);
    // 2 keyframes * 3 components * 3 (in/value/out) = 18 values.
    expect(channel.values.length).toBe(18);
    // value tuple of keyframe 1 is at offset 1*3*3 + 3 = 12 -> [3,0,0].
    expect(channel.values[12]).toBe(3);
  });

  it("imports a morph 'weights' channel with a dynamic component count", () => {
    const binary = animationBinary();
    const result = importGltfAnimations({
      root: animatedRoot(),
      resolveBufferBytes: () => binary,
    });

    const morph = result.clips.find((c) => c.clip.name === "Morph")!.clip;
    const channel = morph.channels[0]!;
    expect(channel.path).toBe("weights");
    expect(channel.componentCount).toBe(2); // 4 scalars / 2 keyframes
    expect(Array.from(channel.values)).toEqual([0, 0, 0.5, 0.25]);
  });

  it("produces channel targetIds that resolve to scene command-plan entities", () => {
    const root = {
      ...animatedRoot(),
      scene: 0,
      scenes: [{ nodes: [0, 1] }],
    };
    const binary = animationBinary();
    const result = importGltfAnimations({
      root,
      resolveBufferBytes: () => binary,
    });
    const targetId = result.clips[0]!.clip.channels[0]!.targetId;

    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport: createGltfSceneTraversalReport({ root }),
      meshRegistrationReport: emptyMeshRegistration(),
      primitiveMaterialReport: emptyPrimitiveMaterials(),
    });
    const world = createWorld();
    const replay = replayGltfEcsAuthoringCommands({ world, plan });

    expect(replay.entitiesByKey.has(targetId)).toBe(true);
  });

  it("surfaces parsed clips and skins on the report-driven GLB import report", () => {
    const root = {
      ...animatedRoot(),
      skins: [{ joints: [1] }],
    };
    const glb = createGlb([
      jsonChunk(root),
      bytesChunk(
        GLB_BINARY_CHUNK_TYPE,
        Array.from(new Uint8Array(animationBinary())),
      ),
    ]);

    const report = createGltfReportDrivenImportReportFromGlb({ source: glb });
    expect(report.importReport).not.toBeNull();
    expect(report.importReport!.animation.clips).toHaveLength(3);
    expect(report.importReport!.skinImport.skins).toHaveLength(1);
    expect(report.importReport!.skinImport.skins[0]!.jointCount).toBe(1);
  });
});

function emptyMeshRegistration(): GltfMeshSourceAssetRegistrationReport {
  return { valid: true, written: [], skipped: [], diagnostics: [] };
}

function emptyPrimitiveMaterials(): GltfPrimitiveMaterialResolutionReport {
  return { valid: true, resolved: [], unresolved: [], diagnostics: [] };
}
