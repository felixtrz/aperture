import { describe, expect, it } from "vitest";

import {
  createGltfMeshPrimitiveMappingReport,
  decodeGltfPrimitiveAccessors,
  validateGltfPrimitiveAccessorReferences,
} from "@aperture-engine/core";

describe("glTF accessor typed-array decoding", () => {
  it("decodes tightly packed float attributes and canonicalizes uint8 indices", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 39 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 3 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5121, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    };
    const bytes = new Uint8Array(39);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    bytes.set([0, 1, 2], 36);

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.primitives[0]?.attributes[0]?.array).toBeInstanceOf(
      Float32Array,
    );
    expect(
      Array.from(report.primitives[0]?.attributes[0]?.array ?? []),
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(report.primitives[0]?.indices?.array).toBeInstanceOf(Uint16Array);
    expect(Array.from(report.primitives[0]?.indices?.array ?? [])).toEqual([
      0, 1, 2,
    ]);
  });

  it("flattens strided bufferView attributes", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 32 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 32, byteStride: 16 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    [1, 2, 3].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    [4, 5, 6].forEach((value, index) =>
      view.setFloat32(16 + index * 4, value, true),
    );

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });

    expect(report.valid).toBe(true);
    expect(
      Array.from(report.primitives[0]?.attributes[0]?.array ?? []),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(report.primitives[0]?.attributes[0]).toMatchObject({
      sourceByteOffset: 0,
      sourceByteLength: 28,
      itemSize: 3,
    });
  });

  it("reports missing source buffers", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 1 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => null,
    });

    expect(report.valid).toBe(false);
    expect(report.primitives).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfDecode.missingBufferBytes",
        severity: "error",
        semantic: "POSITION",
        bufferIndex: 0,
      },
    ]);
  });
});
