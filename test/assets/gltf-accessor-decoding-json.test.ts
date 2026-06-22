import { describe, expect, it } from "vitest";
import {
  createGltfMeshPrimitiveMappingReport,
  decodeGltfPrimitiveAccessors,
  gltfAccessorDecodingReportToJson,
  gltfAccessorDecodingReportToJsonValue,
  validateGltfPrimitiveAccessorReferences,
} from "@aperture-engine/render";

describe("glTF accessor decoding report JSON", () => {
  it("summarizes decoded arrays without embedding contents", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 1 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const bytes = new Uint8Array(12);
    new DataView(bytes.buffer).setFloat32(0, 7, true);
    const report = decodeGltfPrimitiveAccessors({
      validationReport: validateGltfPrimitiveAccessorReferences({
        root,
        primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
      }),
      resolveBufferBytes: () => bytes,
    });
    const json = gltfAccessorDecodingReportToJsonValue(report);

    expect(json).toEqual({
      valid: true,
      primitives: [
        {
          meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          vertexCount: 1,
          attributes: [
            {
              semantic: "POSITION",
              accessorIndex: 0,
              bufferIndex: 0,
              sourceByteOffset: 0,
              sourceByteLength: 12,
              expectedFormat: "float32x3",
              itemSize: 3,
              array: { type: "Float32Array", length: 3 },
            },
          ],
          indices: null,
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(gltfAccessorDecodingReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toContain("7,0,0");
    expect(JSON.stringify(json)).not.toContain("ArrayBuffer");
    expect(JSON.stringify(json)).not.toContain("Uint8Array");
    expect(JSON.stringify(json)).not.toContain("GPU");
  });

  it("preserves decoding diagnostics", () => {
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
      resolveBufferBytes: () => undefined,
    });

    expect(
      gltfAccessorDecodingReportToJsonValue(report).diagnostics,
    ).toMatchObject([
      {
        code: "gltfDecode.missingBufferBytes",
        severity: "error",
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        semantic: "POSITION",
        accessorIndex: 0,
        bufferIndex: 0,
        expectedFormat: "float32x3",
        arrayType: "Float32Array",
      },
    ]);
  });
});
