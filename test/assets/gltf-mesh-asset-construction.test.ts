import { describe, expect, it } from "vitest";

import {
  createGltfMeshPrimitiveMappingReport,
  createMeshAssetsFromGltfDecodedAccessors,
  decodeGltfPrimitiveAccessors,
  validateGltfPrimitiveAccessorReferences,
  type GltfAccessorDecodingReport,
} from "@aperture-engine/core";

describe("glTF mesh source asset construction", () => {
  it("constructs a MeshAsset from decoded primitive arrays", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 42 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    };
    const bytes = new Uint8Array(42);
    const view = new DataView(bytes.buffer);
    [0, 0, 0, 1, 0, 0, 0, 2, 0].forEach((value, index) =>
      view.setFloat32(index * 4, value, true),
    );
    [0, 1, 2].forEach((value, index) =>
      view.setUint16(36 + index * 2, value, true),
    );
    const decodedReport = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.meshes[0]).toMatchObject({
      handleKey: "gltf:mesh:0:primitive:0",
      registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
    });
    expect(report.meshes[0]?.mesh).toMatchObject({
      kind: "mesh",
      label: "mesh:gltf:mesh:0:primitive:0",
      vertexStreams: [
        {
          id: "gltf-primitive-interleaved",
          arrayStride: 12,
          vertexCount: 3,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
          ],
        },
      ],
      indexBuffer: { format: "uint16" },
      submeshes: [{ topology: "triangle-list", indexCount: 3 }],
      materialSlots: [{ index: 0, label: "default" }],
      localAabb: { min: [0, 0, 0], max: [1, 2, 0] },
    });
    expect(
      Array.from(report.meshes[0]?.mesh?.vertexStreams[0]?.data ?? []),
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  });

  it("reports index values outside the vertex range", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      indices: new Uint16Array([0, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });

    expect(report.valid).toBe(false);
    expect(report.meshes[0]?.mesh).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMeshAsset.invalidIndexValue",
        indexValue: 2,
        vertexCount: 2,
      },
    ]);
  });

  it("preserves decoded TANGENT attributes for normal-mapped glTF meshes", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 48,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TANGENT", format: "float32x4", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
    ]);
  });

  it("preserves decoded TEXCOORD_1 attributes for UV1 glTF textures", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      texcoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      texcoords1: new Float32Array([0.25, 0.75, 0.5, 0.5, 0.75, 0.25]),
      indices: new Uint16Array([0, 1, 2]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });
    const stream = report.meshes[0]?.mesh?.vertexStreams[0];

    expect(report.valid).toBe(true);
    expect(stream).toMatchObject({
      arrayStride: 40,
      vertexCount: 3,
      attributes: [
        { semantic: "POSITION", format: "float32x3", offset: 0 },
        { semantic: "NORMAL", format: "float32x3", offset: 12 },
        { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        { semantic: "TEXCOORD_1", format: "float32x2", offset: 32 },
      ],
    });
    expect(Array.from(stream?.data ?? [])).toEqual([
      0, 0, 0, 0, 0, 1, 0, 0, 0.25, 0.75, 1, 0, 0, 0, 0, 1, 1, 0, 0.5, 0.5, 0,
      1, 0, 0, 0, 1, 0, 1, 0.75, 0.25,
    ]);
  });

  it("reports mismatched optional attribute counts", () => {
    const decodedReport = decodedFixture({
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
    });
    const report = createMeshAssetsFromGltfDecodedAccessors({ decodedReport });

    expect(report.valid).toBe(false);
    expect(report.meshes[0]?.mesh).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfMeshAsset.mismatchedAttributeCount",
        semantic: "NORMAL",
        vertexCount: 2,
      },
    ]);
  });
});

function decodedFixture(input: {
  readonly positions: Float32Array;
  readonly normals?: Float32Array;
  readonly texcoords?: Float32Array;
  readonly texcoords1?: Float32Array;
  readonly tangents?: Float32Array;
  readonly indices?: Uint16Array;
}): GltfAccessorDecodingReport {
  return {
    valid: true,
    primitives: [
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        vertexCount: input.positions.length / 3,
        attributes: [
          {
            semantic: "POSITION",
            accessorIndex: 0,
            bufferIndex: 0,
            sourceByteOffset: 0,
            sourceByteLength: input.positions.byteLength,
            expectedFormat: "float32x3",
            itemSize: 3,
            array: input.positions,
          },
          ...(input.normals === undefined
            ? []
            : [
                {
                  semantic: "NORMAL" as const,
                  accessorIndex: 1,
                  bufferIndex: 0,
                  sourceByteOffset: input.positions.byteLength,
                  sourceByteLength: input.normals.byteLength,
                  expectedFormat: "float32x3" as const,
                  itemSize: 3,
                  array: input.normals,
                },
              ]),
          ...(input.texcoords === undefined
            ? []
            : [
                {
                  semantic: "TEXCOORD_0" as const,
                  accessorIndex: 2,
                  bufferIndex: 0,
                  sourceByteOffset:
                    input.positions.byteLength +
                    (input.normals?.byteLength ?? 0),
                  sourceByteLength: input.texcoords.byteLength,
                  expectedFormat: "float32x2" as const,
                  itemSize: 2,
                  array: input.texcoords,
                },
              ]),
          ...(input.tangents === undefined
            ? []
            : [
                {
                  semantic: "TANGENT" as const,
                  accessorIndex: 3,
                  bufferIndex: 0,
                  sourceByteOffset:
                    input.positions.byteLength +
                    (input.normals?.byteLength ?? 0) +
                    (input.texcoords?.byteLength ?? 0),
                  sourceByteLength: input.tangents.byteLength,
                  expectedFormat: "float32x4" as const,
                  itemSize: 4,
                  array: input.tangents,
                },
              ]),
          ...(input.texcoords1 === undefined
            ? []
            : [
                {
                  semantic: "TEXCOORD_1" as const,
                  accessorIndex: 4,
                  bufferIndex: 0,
                  sourceByteOffset:
                    input.positions.byteLength +
                    (input.normals?.byteLength ?? 0) +
                    (input.texcoords?.byteLength ?? 0) +
                    (input.tangents?.byteLength ?? 0),
                  sourceByteLength: input.texcoords1.byteLength,
                  expectedFormat: "float32x2" as const,
                  itemSize: 2,
                  array: input.texcoords1,
                },
              ]),
        ],
        indices:
          input.indices === undefined
            ? null
            : {
                semantic: "INDICES",
                accessorIndex: 2,
                bufferIndex: 0,
                sourceByteOffset: 0,
                sourceByteLength: input.indices.byteLength,
                expectedFormat: "uint16",
                itemSize: 1,
                array: input.indices,
              },
      },
    ],
    diagnostics: [],
  };
}
