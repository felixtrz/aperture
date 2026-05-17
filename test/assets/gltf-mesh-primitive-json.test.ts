import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createGltfMeshPrimitiveMappingReport,
  gltfMeshPrimitiveMappingReportToJson,
  gltfMeshPrimitiveMappingReportToJsonValue,
} from "@aperture-engine/core";

describe("glTF mesh primitive mapping report JSON", () => {
  it("preserves planned handle keys, references, and diagnostics", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}, {}, {}],
        meshes: [
          {
            primitives: [
              {
                attributes: {
                  POSITION: 0,
                  NORMAL: 1,
                },
                indices: 2,
              },
            ],
          },
        ],
      },
    });

    expect(gltfMeshPrimitiveMappingReportToJsonValue(report)).toEqual({
      valid: true,
      root: { valid: true, diagnostics: [] },
      meshes: [
        {
          handleKey: "gltf:mesh:0:primitive:0",
          registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          label: "gltf mesh 0 primitive 0",
          topology: "triangle-list",
          attributes: {
            position: { semantic: "POSITION", accessorIndex: 0 },
            normal: { semantic: "NORMAL", accessorIndex: 1 },
          },
          indices: { accessorIndex: 2 },
          materialIndex: null,
          mesh: null,
        },
      ],
      diagnostics: [
        {
          layer: "mesh",
          code: "gltfMesh.unresolvedAccessorData",
          severity: "warning",
          meshIndex: 0,
          primitiveIndex: 0,
          message:
            "glTF mesh 0 primitive 0 references accessors that have not been decoded; planned mesh source asset remains null.",
        },
      ],
    });
    expect(JSON.parse(gltfMeshPrimitiveMappingReportToJson(report))).toEqual(
      gltfMeshPrimitiveMappingReportToJsonValue(report),
    );
  });

  it("summarizes mesh source data instead of embedding typed arrays", () => {
    const report = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}],
        meshes: [
          {
            primitives: [
              {
                attributes: {
                  POSITION: 0,
                },
              },
            ],
          },
        ],
      },
    });
    const mesh = createBoxMeshAsset({ label: "fixture-box" });
    const planned = report.meshes[0];

    expect(planned).toBeDefined();
    if (planned === undefined) {
      return;
    }

    const json = gltfMeshPrimitiveMappingReportToJsonValue({
      ...report,
      meshes: [{ ...planned, mesh }],
    });

    expect(json.meshes[0]?.mesh).toEqual({
      kind: "mesh",
      label: "fixture-box",
      vertexStreams: 1,
      submeshes: 1,
      materialSlots: 1,
      indexFormat: "uint16",
      indexCount: 36,
      hasLocalAabb: true,
      hasLocalSphere: true,
    });
    expect(JSON.stringify(json)).not.toContain('vertexStreams":[{"');
    expect(JSON.stringify(json)).not.toContain("data");
  });
});
