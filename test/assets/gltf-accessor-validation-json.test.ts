import { describe, expect, it } from "vitest";
import {
  createGltfMeshPrimitiveMappingReport,
  gltfAccessorValidationReportToJson,
  gltfAccessorValidationReportToJsonValue,
  validateGltfPrimitiveAccessorReferences,
} from "@aperture-engine/render";

describe("glTF accessor validation report JSON", () => {
  it("preserves byte-range and expected-format metadata", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 64 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0 },
              indices: 1,
            },
          ],
        },
      ],
    };
    const primitiveReport = createGltfMeshPrimitiveMappingReport({ root });
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport,
    });

    expect(gltfAccessorValidationReportToJsonValue(report)).toEqual({
      valid: true,
      primitives: [
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
              bufferViewByteOffset: 0,
              bufferViewByteLength: 36,
              byteOffset: 0,
              byteLength: 36,
              componentType: 5126,
              accessorType: "VEC3",
              count: 3,
              byteStride: 12,
              normalized: false,
              expectedFormat: "float32x3",
            },
          ],
          indices: {
            semantic: "INDICES",
            accessorIndex: 1,
            bufferViewIndex: 1,
            bufferIndex: 0,
            bufferViewByteOffset: 36,
            bufferViewByteLength: 6,
            byteOffset: 36,
            byteLength: 6,
            componentType: 5123,
            accessorType: "SCALAR",
            count: 3,
            byteStride: 2,
            normalized: false,
            expectedFormat: "uint16",
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(gltfAccessorValidationReportToJson(report))).toEqual(
      gltfAccessorValidationReportToJsonValue(report),
    );
  });

  it("keeps diagnostics JSON-safe without embedding source bytes", () => {
    const root = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 8 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8, byteStride: 4 }],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 1 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    };
    const report = validateGltfPrimitiveAccessorReferences({
      root,
      primitiveReport: createGltfMeshPrimitiveMappingReport({ root }),
    });
    const json = gltfAccessorValidationReportToJsonValue(report);

    expect(json.valid).toBe(false);
    expect(json.diagnostics).toMatchObject([
      {
        code: "gltfAccessor.invalidByteStride",
        severity: "error",
        semantic: "POSITION",
        accessorIndex: 0,
        bufferViewIndex: 0,
        byteLength: 4,
        requiredByteLength: 12,
      },
    ]);
    expect(JSON.stringify(json)).not.toContain("ArrayBuffer");
    expect(JSON.stringify(json)).not.toContain("Uint8Array");
    expect(JSON.stringify(json)).not.toContain("Float32Array");
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
    expect(JSON.stringify(json)).not.toContain("GPU");
  });
});
