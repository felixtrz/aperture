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
