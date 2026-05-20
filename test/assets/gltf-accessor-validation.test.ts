import { describe, expect, it } from "vitest";

import {
  createGltfMeshPrimitiveMappingReport,
  validateGltfPrimitiveAccessorReferences,
} from "@aperture-engine/core";

describe("glTF accessor and buffer reference validation", () => {
  it("plans byte ranges and expected formats for a valid primitive", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 160 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
        { buffer: 0, byteOffset: 72, byteLength: 24 },
        { buffer: 0, byteOffset: 96, byteLength: 48 },
        { buffer: 0, byteOffset: 144, byteLength: 3 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 2, componentType: 5126, type: "VEC2", count: 3 },
        { bufferView: 3, componentType: 5126, type: "VEC4", count: 3 },
        { bufferView: 4, componentType: 5121, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 0,
                NORMAL: 1,
                TEXCOORD_0: 2,
                TANGENT: 3,
              },
              indices: 4,
            },
          ],
        },
      ],
    };
    const primitiveReport = createGltfMeshPrimitiveMappingReport({ root });
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport,
      binaryChunkByteLength: 160,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.primitives).toMatchObject([
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        vertexCount: 3,
        attributes: [
          {
            semantic: "POSITION",
            accessorIndex: 0,
            bufferViewIndex: 0,
            bufferIndex: 0,
            byteOffset: 0,
            byteLength: 36,
            expectedFormat: "float32x3",
          },
          {
            semantic: "NORMAL",
            accessorIndex: 1,
            byteOffset: 36,
            expectedFormat: "float32x3",
          },
          {
            semantic: "TEXCOORD_0",
            accessorIndex: 2,
            byteOffset: 72,
            expectedFormat: "float32x2",
          },
          {
            semantic: "TANGENT",
            accessorIndex: 3,
            byteOffset: 96,
            expectedFormat: "float32x4",
          },
        ],
        indices: {
          semantic: "INDICES",
          accessorIndex: 4,
          byteOffset: 144,
          byteLength: 3,
          expectedFormat: "uint8-to-uint16",
        },
      },
    ]);
  });

  it("reports buffer range overflows", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 16 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 32 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 1 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const primitiveReport = createGltfMeshPrimitiveMappingReport({ root });
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport,
      binaryChunkByteLength: 16,
    });

    expect(report.valid).toBe(false);
    expect(report.primitives).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.bufferRangeOutOfBounds",
        severity: "error",
        bufferViewIndex: 0,
        bufferIndex: 0,
      },
    ]);
  });

  it("reports unsupported semantic formats and sparse deferral", () => {
    const unsupportedRoot = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 64 }],
      bufferViews: [{ buffer: 0, byteLength: 64 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC2", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const sparseRoot = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 64 }],
      bufferViews: [{ buffer: 0, byteLength: 64 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          type: "VEC3",
          count: 3,
          sparse: { count: 1 },
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };

    const unsupported = validateGltfPrimitiveAccessorReferences({
      root: unsupportedRoot,
      primitiveReport: createGltfMeshPrimitiveMappingReport({
        root: unsupportedRoot,
      }),
    });
    const sparse = validateGltfPrimitiveAccessorReferences({
      root: sparseRoot,
      primitiveReport: createGltfMeshPrimitiveMappingReport({
        root: sparseRoot,
      }),
    });

    expect(unsupported.valid).toBe(false);
    expect(unsupported.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.unsupportedSemanticFormat",
        severity: "error",
        semantic: "POSITION",
      },
    ]);
    expect(sparse.valid).toBe(true);
    expect(sparse.primitives).toEqual([]);
    expect(sparse.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.sparseAccessorDeferred",
        severity: "warning",
        semantic: "POSITION",
      },
    ]);
  });
});
