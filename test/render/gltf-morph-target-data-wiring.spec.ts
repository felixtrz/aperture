import { describe, expect, it } from "vitest";

import { createGltfReportDrivenImportReport } from "@aperture-engine/render";

/**
 * Proves M2-T7 import → mesh wiring: a glTF with >2 morph targets surfaces all
 * of them on the constructed `MeshAsset.morphTargetData` (the storage-buffer
 * render payload), not just two vertex-attribute slots.
 */
function morphMeshFixture(targetCount: number) {
  const vertexCount = 3;
  const stride = vertexCount * 3;
  // Buffer: base POSITION, then one POSITION-delta block per target.
  const floats = new Float32Array((targetCount + 1) * stride);
  // Base positions (a non-degenerate triangle for valid bounds).
  floats.set([0, 0, 0, 1, 0, 0, 0, 1, 0], 0);
  for (let t = 0; t < targetCount; t += 1) {
    for (let v = 0; v < vertexCount; v += 1) {
      // Distinct per-target delta so each target is identifiable.
      floats[(t + 1) * stride + v * 3] = t + 1;
    }
  }

  const bufferViews = [];
  const accessors = [];
  for (let i = 0; i < targetCount + 1; i += 1) {
    bufferViews.push({
      buffer: 0,
      byteOffset: i * stride * 4,
      byteLength: stride * 4,
    });
    accessors.push({
      bufferView: i,
      componentType: 5126,
      type: "VEC3",
      count: vertexCount,
      ...(i === 0 ? { min: [0, 0, 0], max: [1, 1, 0] } : {}),
    });
  }

  return {
    root: {
      asset: { version: "2.0" },
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0 },
              targets: Array.from({ length: targetCount }, (_unused, t) => ({
                POSITION: t + 1,
              })),
            },
          ],
        },
      ],
      accessors,
      bufferViews,
      buffers: [{ byteLength: floats.byteLength }],
    },
    bytes: floats.buffer,
  };
}

describe("glTF morph target data wiring", () => {
  it("attaches all N imported morph targets to MeshAsset.morphTargetData", () => {
    const { root, bytes } = morphMeshFixture(4);
    const report = createGltfReportDrivenImportReport({
      root,
      createMeshAssets: true,
      resolveBufferBytes: () => bytes,
    });

    const mesh = report.meshConstruction?.meshes[0]?.mesh ?? null;
    expect(mesh).not.toBeNull();
    const data = mesh?.morphTargetData;
    expect(data).toBeDefined();
    expect(data?.targetCount).toBe(4);
    expect(data?.vertexCount).toBe(3);
    expect(data?.positionDeltas).toHaveLength(4 * 3 * 3);
    // Target index 2 (the 3rd, beyond the legacy 2-cap) carries its delta.
    expect(data?.positionDeltas[2 * 3 * 3]).toBe(3);
    // Target index 3 (the 4th) too.
    expect(data?.positionDeltas[3 * 3 * 3]).toBe(4);
  });
});
