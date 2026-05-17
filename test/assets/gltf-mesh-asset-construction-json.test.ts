import { describe, expect, it } from "vitest";

import {
  gltfMeshAssetConstructionReportToJson,
  gltfMeshAssetConstructionReportToJsonValue,
  type GltfMeshAssetConstructionReport,
} from "@aperture-engine/core";

describe("glTF mesh source asset construction report JSON", () => {
  it("summarizes mesh buffers without embedding raw typed-array contents", () => {
    const report: GltfMeshAssetConstructionReport = {
      valid: true,
      meshes: [
        {
          handleKey: "gltf:mesh:0:primitive:0",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          mesh: {
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
                data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]),
              },
            ],
            indexBuffer: {
              format: "uint16",
              data: new Uint16Array([0, 1, 2]),
            },
            submeshes: [
              {
                label: "default",
                topology: "triangle-list",
                materialSlot: 0,
                vertexStart: 0,
                vertexCount: 3,
                indexStart: 0,
                indexCount: 3,
              },
            ],
            materialSlots: [{ index: 0, label: "default" }],
            localAabb: { min: [0, 0, 0], max: [1, 2, 0] },
            localSphere: { center: [0.5, 1, 0], radius: Math.sqrt(1.25) },
          },
        },
      ],
      diagnostics: [],
    };
    const json = gltfMeshAssetConstructionReportToJsonValue(report);

    expect(json).toEqual({
      valid: true,
      meshes: [
        {
          handleKey: "gltf:mesh:0:primitive:0",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          mesh: {
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
                data: { type: "Float32Array", length: 9 },
              },
            ],
            indexBuffer: {
              format: "uint16",
              data: { type: "Uint16Array", length: 3 },
            },
            submeshes: [
              {
                label: "default",
                topology: "triangle-list",
                materialSlot: 0,
                vertexStart: 0,
                vertexCount: 3,
                indexStart: 0,
                indexCount: 3,
              },
            ],
            materialSlots: [{ index: 0, label: "default" }],
            localAabb: { min: [0, 0, 0], max: [1, 2, 0] },
            localSphere: { center: [0.5, 1, 0], radius: Math.sqrt(1.25) },
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(gltfMeshAssetConstructionReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toContain('"data":[0,0,0');
    expect(JSON.stringify(json)).not.toContain("ArrayBuffer");
    expect(JSON.stringify(json)).not.toContain("GPU");
    expect(JSON.stringify(json)).not.toContain("EcsWorld");
  });

  it("preserves mesh construction diagnostics", () => {
    const report: GltfMeshAssetConstructionReport = {
      valid: false,
      meshes: [
        {
          handleKey: "gltf:mesh:0:primitive:0",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          mesh: null,
        },
      ],
      diagnostics: [
        {
          code: "gltfMeshAsset.invalidIndexValue",
          severity: "error",
          message:
            "Primitive 'mesh:gltf:mesh:0:primitive:0' index 4 is outside vertex count 3.",
          meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          semantic: "INDICES",
          indexValue: 4,
          vertexCount: 3,
        },
      ],
    };

    expect(gltfMeshAssetConstructionReportToJsonValue(report)).toEqual(report);
  });
});
