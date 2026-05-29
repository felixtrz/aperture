import { describe, expect, it } from "vitest";
import {
  createGltfMeshPrimitiveMappingReport,
  validateGltfPrimitiveAccessorReferences,
} from "@aperture-engine/render";

describe("glTF accessor and buffer reference validation", () => {
  it("plans byte ranges and expected formats for a valid primitive", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 207 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
        { buffer: 0, byteOffset: 72, byteLength: 24 },
        { buffer: 0, byteOffset: 96, byteLength: 12 },
        { buffer: 0, byteOffset: 108, byteLength: 48 },
        { buffer: 0, byteOffset: 156, byteLength: 48 },
        { buffer: 0, byteOffset: 204, byteLength: 3 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 2, componentType: 5126, type: "VEC2", count: 3 },
        { bufferView: 3, componentType: 5121, type: "VEC4", count: 3 },
        { bufferView: 4, componentType: 5126, type: "VEC4", count: 3 },
        { bufferView: 5, componentType: 5126, type: "VEC4", count: 3 },
        { bufferView: 6, componentType: 5121, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 0,
                NORMAL: 1,
                TEXCOORD_0: 2,
                JOINTS_0: 3,
                WEIGHTS_0: 4,
                TANGENT: 5,
              },
              indices: 6,
            },
          ],
        },
      ],
    };
    const primitiveReport = createGltfMeshPrimitiveMappingReport({ root });
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport,
      binaryChunkByteLength: 207,
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
            semantic: "JOINTS_0",
            accessorIndex: 3,
            byteOffset: 96,
            expectedFormat: "uint8x4",
          },
          {
            semantic: "WEIGHTS_0",
            accessorIndex: 4,
            byteOffset: 108,
            expectedFormat: "float32x4",
          },
          {
            semantic: "TANGENT",
            accessorIndex: 5,
            byteOffset: 156,
            expectedFormat: "float32x4",
          },
        ],
        indices: {
          semantic: "INDICES",
          accessorIndex: 6,
          byteOffset: 204,
          byteLength: 3,
          expectedFormat: "uint8-to-uint16",
        },
      },
    ]);
  });

  it("accepts compact COLOR_0 accessors without float expansion", () => {
    const cases = [
      {
        accessorType: "VEC3",
        componentType: 5126,
        colorByteLength: 36,
        expectedFormat: "float32x3",
        normalized: false,
      },
      {
        accessorType: "VEC3",
        componentType: 5121,
        colorByteLength: 9,
        expectedFormat: "unorm8x4",
        normalized: true,
      },
      {
        accessorType: "VEC4",
        componentType: 5121,
        colorByteLength: 12,
        expectedFormat: "unorm8x4",
        normalized: true,
      },
      {
        accessorType: "VEC3",
        componentType: 5123,
        colorByteLength: 18,
        expectedFormat: "unorm16x4",
        normalized: true,
      },
      {
        accessorType: "VEC4",
        componentType: 5123,
        colorByteLength: 24,
        expectedFormat: "unorm16x4",
        normalized: true,
      },
    ] as const;

    for (const testCase of cases) {
      const root = {
        asset: { version: "2.0" },
        buffers: [{ byteLength: 36 + testCase.colorByteLength }],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 36 },
          {
            buffer: 0,
            byteOffset: 36,
            byteLength: testCase.colorByteLength,
          },
        ],
        accessors: [
          { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
          {
            bufferView: 1,
            componentType: testCase.componentType,
            type: testCase.accessorType,
            count: 3,
            ...(testCase.normalized ? { normalized: true } : {}),
          },
        ],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }],
          },
        ],
      };
      const report = validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      });

      expect(report.valid).toBe(true);
      expect(report.diagnostics).toEqual([]);
      expect(report.primitives[0]?.attributes).toContainEqual(
        expect.objectContaining({
          semantic: "COLOR_0",
          accessorType: testCase.accessorType,
          componentType: testCase.componentType,
          expectedFormat: testCase.expectedFormat,
          normalized: testCase.normalized,
        }),
      );
    }
  });

  it("rejects unnormalized integer COLOR_0 accessors", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 48 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 12 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5121, type: "VEC4", count: 3 },
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }],
        },
      ],
    };
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
    });

    expect(report.valid).toBe(false);
    expect(report.primitives).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.unsupportedSemanticFormat",
        semantic: "COLOR_0",
      },
    ]);
  });

  it("accepts compact skinning accessors without expanding glTF storage", () => {
    const cases = [
      {
        jointsComponentType: 5121,
        jointsByteLength: 12,
        jointsExpectedFormat: "uint8x4",
        weightsComponentType: 5121,
        weightsByteLength: 12,
        weightsExpectedFormat: "unorm8x4",
      },
      {
        jointsComponentType: 5123,
        jointsByteLength: 24,
        jointsExpectedFormat: "uint16x4",
        weightsComponentType: 5123,
        weightsByteLength: 24,
        weightsExpectedFormat: "unorm16x4",
      },
      {
        jointsComponentType: 5123,
        jointsByteLength: 24,
        jointsExpectedFormat: "uint16x4",
        weightsComponentType: 5126,
        weightsByteLength: 48,
        weightsExpectedFormat: "float32x4",
      },
    ] as const;

    for (const testCase of cases) {
      const byteLength =
        36 + testCase.jointsByteLength + testCase.weightsByteLength;
      const root = {
        asset: { version: "2.0" },
        buffers: [{ byteLength }],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 36 },
          {
            buffer: 0,
            byteOffset: 36,
            byteLength: testCase.jointsByteLength,
          },
          {
            buffer: 0,
            byteOffset: 36 + testCase.jointsByteLength,
            byteLength: testCase.weightsByteLength,
          },
        ],
        accessors: [
          { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
          {
            bufferView: 1,
            componentType: testCase.jointsComponentType,
            type: "VEC4",
            count: 3,
          },
          {
            bufferView: 2,
            componentType: testCase.weightsComponentType,
            type: "VEC4",
            count: 3,
            ...(testCase.weightsComponentType === 5126
              ? {}
              : { normalized: true }),
          },
        ],
        meshes: [
          {
            primitives: [
              { attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } },
            ],
          },
        ],
      };
      const report = validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      });

      expect(report.valid).toBe(true);
      expect(report.diagnostics).toEqual([]);
      expect(report.primitives[0]?.attributes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            semantic: "JOINTS_0",
            componentType: testCase.jointsComponentType,
            expectedFormat: testCase.jointsExpectedFormat,
          }),
          expect.objectContaining({
            semantic: "WEIGHTS_0",
            componentType: testCase.weightsComponentType,
            expectedFormat: testCase.weightsExpectedFormat,
          }),
        ]),
      );
    }
  });

  it("rejects unnormalized integer WEIGHTS_0 accessors", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 48 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 12 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5121, type: "VEC4", count: 3 },
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0, WEIGHTS_0: 1 } }],
        },
      ],
    };
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
    });

    expect(report.valid).toBe(false);
    expect(report.primitives).toEqual([]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.unsupportedSemanticFormat",
        semantic: "WEIGHTS_0",
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

  it("validates morph target POSITION and NORMAL accessors as float vec3 attributes", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 248 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
        { buffer: 0, byteOffset: 72, byteLength: 24 },
        { buffer: 0, byteOffset: 96, byteLength: 6 },
        { buffer: 0, byteOffset: 104, byteLength: 36 },
        { buffer: 0, byteOffset: 140, byteLength: 36 },
        { buffer: 0, byteOffset: 176, byteLength: 36 },
        { buffer: 0, byteOffset: 212, byteLength: 36 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 2, componentType: 5126, type: "VEC2", count: 3 },
        { bufferView: 3, componentType: 5123, type: "SCALAR", count: 3 },
        { bufferView: 4, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 5, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 6, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 7, componentType: 5126, type: "VEC3", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 0,
                NORMAL: 1,
                TEXCOORD_0: 2,
              },
              indices: 3,
              targets: [
                { POSITION: 4, NORMAL: 5 },
                { POSITION: 6, NORMAL: 7 },
              ],
            },
          ],
        },
      ],
    };
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      binaryChunkByteLength: 248,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.primitives[0]?.attributes).toMatchObject([
      { semantic: "POSITION", accessorIndex: 0, expectedFormat: "float32x3" },
      { semantic: "NORMAL", accessorIndex: 1, expectedFormat: "float32x3" },
      { semantic: "TEXCOORD_0", accessorIndex: 2, expectedFormat: "float32x2" },
      {
        semantic: "MORPH_POSITION_0",
        accessorIndex: 4,
        expectedFormat: "float32x3",
      },
      {
        semantic: "MORPH_NORMAL_0",
        accessorIndex: 5,
        expectedFormat: "float32x3",
      },
      {
        semantic: "MORPH_POSITION_1",
        accessorIndex: 6,
        expectedFormat: "float32x3",
      },
      {
        semantic: "MORPH_NORMAL_1",
        accessorIndex: 7,
        expectedFormat: "float32x3",
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

  it("reports unsupported KHR_mesh_quantization component types", () => {
    const root = {
      asset: { version: "2.0" },
      extensionsRequired: ["KHR_mesh_quantization"],
      buffers: [{ byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5125,
          type: "VEC3",
          count: 3,
          normalized: true,
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };

    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.unsupportedQuantizedComponentType",
        severity: "error",
        semantic: "POSITION",
        value: 5125,
      },
    ]);
  });
});
