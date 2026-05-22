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
    expect(report.primitives[0]?.attributes[0]?.array.buffer).not.toBe(
      bytes.buffer,
    );
    expect(
      Array.from(report.primitives[0]?.attributes[0]?.array ?? []),
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(report.primitives[0]?.indices?.array).toBeInstanceOf(Uint16Array);
    expect(Array.from(report.primitives[0]?.indices?.array ?? [])).toEqual([
      0, 1, 2,
    ]);
  });

  it("can expose tightly packed source views for zero-copy callers", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 46 }],
      bufferViews: [
        { buffer: 0, byteOffset: 4, byteLength: 36 },
        { buffer: 0, byteOffset: 40, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    };
    const bytes = new Uint8Array(46);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(4 + index * 4, value, true),
    );
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(40 + index * 2, value, true),
    );

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const position = report.primitives[0]?.attributes[0]?.array;
    const indices = report.primitives[0]?.indices?.array;

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(position).toBeInstanceOf(Float32Array);
    expect(position?.buffer).toBe(bytes.buffer);
    expect(position?.byteOffset).toBe(4);
    expect(indices).toBeInstanceOf(Uint16Array);
    expect(indices?.buffer).toBe(bytes.buffer);
    expect(indices?.byteOffset).toBe(40);
  });

  it("falls back to decoded copies when source-view accessors are unaligned", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 14 }],
      bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 12 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 1 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const bytes = new Uint8Array(14);
    const view = new DataView(bytes.buffer);
    [1, 2, 3].forEach((value, index) =>
      view.setFloat32(2 + index * 4, value, true),
    );

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const position = report.primitives[0]?.attributes[0]?.array;

    expect(report.valid).toBe(true);
    expect(position).toBeInstanceOf(Float32Array);
    expect(position?.buffer).not.toBe(bytes.buffer);
    expect(Array.from(position ?? [])).toEqual([1, 2, 3]);
  });

  it("decodes normalized byte COLOR_0 accessors as GPU-normalized byte streams", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 30 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 24 },
        { buffer: 0, byteOffset: 24, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
        {
          bufferView: 1,
          componentType: 5121,
          type: "VEC3",
          count: 2,
          normalized: true,
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }] }],
    };
    const bytes = new Uint8Array(30);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    bytes.set([255, 0, 0, 0, 128, 255], 24);

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });
    const color = report.primitives[0]?.attributes.find(
      (attribute) => attribute.semantic === "COLOR_0",
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(color).toMatchObject({
      expectedFormat: "unorm8x4",
      itemSize: 4,
      sourceByteOffset: 24,
      sourceByteLength: 6,
    });
    expect(color?.array).toBeInstanceOf(Uint8Array);
    expect(Array.from(color?.array ?? [])).toEqual([
      255, 0, 0, 255, 0, 128, 255, 255,
    ]);
  });

  it("can expose tightly packed normalized byte COLOR_0 source views", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 32 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 24 },
        { buffer: 0, byteOffset: 24, byteLength: 8 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
        {
          bufferView: 1,
          componentType: 5121,
          type: "VEC4",
          count: 2,
          normalized: true,
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }] }],
    };
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    bytes.set([255, 0, 0, 255, 0, 128, 255, 255], 24);

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const color = report.primitives[0]?.attributes.find(
      (attribute) => attribute.semantic === "COLOR_0",
    );

    expect(report.valid).toBe(true);
    expect(color?.array).toBeInstanceOf(Uint8Array);
    expect(color?.array.buffer).toBe(bytes.buffer);
    expect(color?.array.byteOffset).toBe(24);
    expect(Array.from(color?.array ?? [])).toEqual([
      255, 0, 0, 255, 0, 128, 255, 255,
    ]);
  });

  it("can expose tightly packed compact skinning source views", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 60 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 24 },
        { buffer: 0, byteOffset: 24, byteLength: 8 },
        { buffer: 0, byteOffset: 32, byteLength: 16 },
        { buffer: 0, byteOffset: 48, byteLength: 12 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
        { bufferView: 1, componentType: 5121, type: "VEC4", count: 2 },
        {
          bufferView: 2,
          componentType: 5123,
          type: "VEC4",
          count: 2,
          normalized: true,
        },
        { bufferView: 3, componentType: 5121, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 },
              indices: 3,
            },
          ],
        },
      ],
    };
    const bytes = new Uint8Array(60);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7], 24);
    [65535, 0, 0, 0, 32768, 32767, 0, 0].forEach((value, index) =>
      view.setUint16(32 + index * 2, value, true),
    );
    bytes.set([0, 1, 1], 48);

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
      storageMode: "source-view",
    });
    const joints = report.primitives[0]?.attributes.find(
      (attribute) => attribute.semantic === "JOINTS_0",
    );
    const weights = report.primitives[0]?.attributes.find(
      (attribute) => attribute.semantic === "WEIGHTS_0",
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(joints).toMatchObject({
      expectedFormat: "uint8x4",
      itemSize: 4,
      sourceByteOffset: 24,
      sourceByteLength: 8,
    });
    expect(joints?.array).toBeInstanceOf(Uint8Array);
    expect(joints?.array.buffer).toBe(bytes.buffer);
    expect(Array.from(joints?.array ?? [])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(weights).toMatchObject({
      expectedFormat: "unorm16x4",
      itemSize: 4,
      sourceByteOffset: 32,
      sourceByteLength: 16,
    });
    expect(weights?.array).toBeInstanceOf(Uint16Array);
    expect(weights?.array.buffer).toBe(bytes.buffer);
    expect(Array.from(weights?.array ?? [])).toEqual([
      65535, 0, 0, 0, 32768, 32767, 0, 0,
    ]);
    expect(report.primitives[0]?.indices?.array).toBeInstanceOf(Uint16Array);
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

  it("decodes accessors with nonzero offsets inside a shared strided bufferView", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 88 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 40, byteLength: 48, byteStride: 16 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          type: "VEC3",
          count: 3,
        },
        {
          bufferView: 1,
          byteOffset: 8,
          componentType: 5126,
          type: "VEC2",
          count: 3,
        },
      ],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 } }] },
      ],
    };
    const bytes = new Uint8Array(88);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    const uvValues: readonly (readonly [number, number])[] = [
      [48, 0.1],
      [52, 0.2],
      [64, 0.3],
      [68, 0.4],
      [80, 0.5],
      [84, 0.6],
    ];

    uvValues.forEach(([byteOffset, value]) =>
      view.setFloat32(byteOffset, value, true),
    );

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(
      Array.from(report.primitives[0]?.attributes[1]?.array ?? []).map(
        (value) => Number(value.toFixed(1)),
      ),
    ).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(report.primitives[0]?.attributes[1]).toMatchObject({
      sourceByteOffset: 48,
      sourceByteLength: 40,
      itemSize: 2,
    });
  });

  it("decodes skin joint and weight attributes as VEC4 streams", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 64 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 24 },
        { buffer: 0, byteOffset: 24, byteLength: 8 },
        { buffer: 0, byteOffset: 32, byteLength: 32 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
        { bufferView: 1, componentType: 5121, type: "VEC4", count: 2 },
        { bufferView: 2, componentType: 5126, type: "VEC4", count: 2 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 0,
                JOINTS_0: 1,
                WEIGHTS_0: 2,
              },
            },
          ],
        },
      ],
    };
    const bytes = new Uint8Array(64);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 0, 1, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    bytes.set([0, 0, 0, 0, 1, 0, 0, 0], 24);
    [1, 0, 0, 0, 0.75, 0.25, 0, 0].forEach((value, index) =>
      view.setFloat32(32 + index * 4, value, true),
    );

    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.primitives[0]?.attributes[1]).toMatchObject({
      semantic: "JOINTS_0",
      expectedFormat: "uint8x4",
      itemSize: 4,
    });
    expect(report.primitives[0]?.attributes[1]?.array).toBeInstanceOf(
      Uint8Array,
    );
    expect(
      Array.from(report.primitives[0]?.attributes[1]?.array ?? []),
    ).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(report.primitives[0]?.attributes[2]).toMatchObject({
      semantic: "WEIGHTS_0",
      expectedFormat: "float32x4",
      itemSize: 4,
    });
    expect(
      Array.from(report.primitives[0]?.attributes[2]?.array ?? []),
    ).toEqual([1, 0, 0, 0, 0.75, 0.25, 0, 0]);
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
