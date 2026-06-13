import { describe, expect, it } from "vitest";
import { generateMissingNormals } from "../../packages/render/src/assets/gltf-mesh-normals.js";
import type {
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "../../packages/render/src/assets/gltf-accessor-decoding-types.js";

function positionAccessor(values: number[]): GltfDecodedAccessor {
  return {
    semantic: "POSITION",
    accessorIndex: 0,
    bufferIndex: 0,
    sourceByteOffset: 0,
    sourceByteLength: values.length * 4,
    expectedFormat: "float32x3",
    itemSize: 3,
    array: new Float32Array(values),
  };
}

function primitive(
  position: GltfDecodedAccessor,
  indices: GltfDecodedAccessor | null,
  vertexCount: number,
): GltfDecodedPrimitiveAccessors {
  return {
    meshHandleKey: "mesh:test",
    meshIndex: 0,
    primitiveIndex: 0,
    vertexCount,
    attributes: [position],
    indices,
  };
}

describe("generateMissingNormals", () => {
  it("computes the face normal for a single indexed triangle", () => {
    // Triangle in the z=0 plane wound CCW → normal +Z.
    const position = positionAccessor([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices: GltfDecodedAccessor = {
      semantic: "INDICES",
      accessorIndex: 1,
      bufferIndex: 0,
      sourceByteOffset: 0,
      sourceByteLength: 6,
      expectedFormat: "uint16",
      itemSize: 1,
      array: new Uint16Array([0, 1, 2]),
    };

    const normal = generateMissingNormals(
      primitive(position, indices, 3),
      position,
    );
    expect(normal?.semantic).toBe("NORMAL");
    expect(normal?.itemSize).toBe(3);
    const n = normal?.array as Float32Array;
    for (let v = 0; v < 3; v += 1) {
      expect(n[v * 3]).toBeCloseTo(0, 5);
      expect(n[v * 3 + 1]).toBeCloseTo(0, 5);
      expect(n[v * 3 + 2]).toBeCloseTo(1, 5);
    }
  });

  it("supports non-indexed (sequential) triangle lists", () => {
    const position = positionAccessor([0, 0, 0, 0, 1, 0, 0, 0, 1]);
    const normal = generateMissingNormals(
      primitive(position, null, 3),
      position,
    );
    const n = normal?.array as Float32Array;
    // Triangle in the x=0 plane → normal ±X (unit length).
    expect(Math.abs(n[0] ?? 0)).toBeCloseTo(1, 5);
    expect(n[1]).toBeCloseTo(0, 5);
    expect(n[2]).toBeCloseTo(0, 5);
  });

  it("produces unit-length normals", () => {
    const position = positionAccessor([0, 0, 0, 2, 0, 0, 0, 3, 0]);
    const normal = generateMissingNormals(
      primitive(position, null, 3),
      position,
    );
    const n = normal?.array as Float32Array;
    for (let v = 0; v < 3; v += 1) {
      const length = Math.hypot(
        n[v * 3] ?? 0,
        n[v * 3 + 1] ?? 0,
        n[v * 3 + 2] ?? 0,
      );
      expect(length).toBeCloseTo(1, 5);
    }
  });

  it("returns null for non-float positions", () => {
    const position: GltfDecodedAccessor = {
      ...positionAccessor([0, 0, 0]),
      array: new Uint8Array([0, 0, 0]) as unknown as Float32Array,
    };
    expect(
      generateMissingNormals(primitive(position, null, 1), position),
    ).toBeNull();
  });
});
