import { describe, expect, it } from "vitest";

import { importGltfMorphTargets } from "@aperture-engine/render";

/**
 * Build a binary holding `targetCount` morph POSITION deltas, each for
 * `vertexCount` vertices (VEC3). Target t, vertex v -> delta (t+1, 0, 0) so
 * each target is distinguishable.
 */
function morphBinary(targetCount: number, vertexCount: number): ArrayBuffer {
  const floats = new Float32Array(targetCount * vertexCount * 3);
  for (let t = 0; t < targetCount; t += 1) {
    for (let v = 0; v < vertexCount; v += 1) {
      floats[(t * vertexCount + v) * 3] = t + 1;
    }
  }
  return floats.buffer;
}

function morphRoot(targetCount: number, vertexCount: number) {
  const accessors = [];
  const bufferViews = [];
  for (let t = 0; t < targetCount; t += 1) {
    bufferViews.push({
      buffer: 0,
      byteOffset: t * vertexCount * 3 * 4,
      byteLength: vertexCount * 3 * 4,
    });
    accessors.push({
      bufferView: t,
      componentType: 5126,
      type: "VEC3",
      count: vertexCount,
    });
  }
  return {
    asset: { version: "2.0" },
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            targets: accessors.map((_, t) => ({ POSITION: t })),
          },
        ],
      },
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: targetCount * vertexCount * 3 * 4 }],
  };
}

describe("glTF morph target import", () => {
  it("imports 4 morph targets (not just 2) without dropping any", () => {
    const vertexCount = 3;
    const binary = morphBinary(4, vertexCount);
    const report = importGltfMorphTargets({
      root: morphRoot(4, vertexCount),
      resolveBufferBytes: () => binary,
    });

    expect(report.valid).toBe(true);
    expect(report.primitives).toHaveLength(1);
    const primitive = report.primitives[0]!;
    expect(primitive.targetCount).toBe(4);
    expect(primitive.vertexCount).toBe(vertexCount);
    expect(primitive.positionDeltas).toHaveLength(4 * vertexCount * 3);
    // Target 2 and 3 (beyond the old 2-cap) carry their distinct deltas.
    expect(primitive.positionDeltas[2 * vertexCount * 3]).toBe(3); // target 2 -> 3
    expect(primitive.positionDeltas[3 * vertexCount * 3]).toBe(4); // target 3 -> 4
  });

  it("represents the 52 ARKit blendshape case without dropping targets", () => {
    const vertexCount = 2;
    const binary = morphBinary(52, vertexCount);
    const report = importGltfMorphTargets({
      root: morphRoot(52, vertexCount),
      resolveBufferBytes: () => binary,
    });

    expect(report.valid).toBe(true);
    const primitive = report.primitives[0]!;
    expect(primitive.targetCount).toBe(52);
    expect(primitive.positionDeltas).toHaveLength(52 * vertexCount * 3);
    // The 52nd target (index 51) is present, not truncated.
    expect(primitive.positionDeltas[51 * vertexCount * 3]).toBe(52);
  });

  it("returns no morph primitives for a mesh without targets", () => {
    const report = importGltfMorphTargets({
      root: {
        asset: { version: "2.0" },
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      },
      resolveBufferBytes: () => null,
    });
    expect(report.valid).toBe(true);
    expect(report.primitives).toHaveLength(0);
  });
});
