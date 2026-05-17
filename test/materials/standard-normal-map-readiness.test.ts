import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureHandle,
  standardMaterialNormalMapTangentReadinessReportToJson,
  standardMaterialNormalMapTangentReadinessReportToJsonValue,
  createStandardMaterialNormalMapTangentReadinessReport,
  type MeshAsset,
} from "@aperture-engine/core";

describe("StandardMaterial normal-map tangent readiness", () => {
  it("does not require tangents when no normal map is authored", () => {
    const report = createStandardMaterialNormalMapTangentReadinessReport({
      mesh: createBoxMeshAsset(),
      material: createStandardMaterialAsset(),
      meshKey: "mesh:cube",
      materialKey: "material:standard",
    });

    expect(report).toMatchObject({
      ready: true,
      materialKind: "standard",
      normalMapAuthored: false,
      requiresTangents: false,
      hasTangents: false,
      diagnostics: [],
    });
  });

  it("reports missing tangents for authored tangent-space normal maps", () => {
    const report = createStandardMaterialNormalMapTangentReadinessReport({
      mesh: createBoxMeshAsset(),
      material: createStandardMaterialAsset({
        normalTexture: {
          texture: createTextureHandle("normal"),
          sampler: createSamplerHandle("normal"),
        },
      }),
      meshKey: "mesh:cube",
      materialKey: "material:normal-map",
    });
    const json =
      standardMaterialNormalMapTangentReadinessReportToJsonValue(report);

    expect(report.ready).toBe(false);
    expect(report).toMatchObject({
      normalMapAuthored: true,
      requiresTangents: true,
      hasTangents: false,
      diagnostics: [
        {
          code: "standardNormalMap.missingTangents",
          severity: "warning",
          meshKey: "mesh:cube",
          materialKey: "material:normal-map",
        },
      ],
    });
    expect(report.meshSemantics).toEqual(["NORMAL", "POSITION", "TEXCOORD_0"]);
    expect(json).toEqual(report);
    expect(standardMaterialNormalMapTangentReadinessReportToJson(report)).toBe(
      JSON.stringify(json),
    );
  });

  it("marks normal-map tangent requirements ready when the mesh has TANGENT data", () => {
    const report = createStandardMaterialNormalMapTangentReadinessReport({
      mesh: withTangentAttribute(createBoxMeshAsset()),
      material: createStandardMaterialAsset({
        normalTexture: {
          texture: createTextureHandle("normal"),
          sampler: createSamplerHandle("normal"),
        },
      }),
    });

    expect(report).toMatchObject({
      ready: true,
      normalMapAuthored: true,
      requiresTangents: true,
      hasTangents: true,
      diagnostics: [],
    });
    expect(report.meshSemantics).toEqual([
      "NORMAL",
      "POSITION",
      "TANGENT",
      "TEXCOORD_0",
    ]);
  });
});

function withTangentAttribute(mesh: MeshAsset): MeshAsset {
  return {
    ...mesh,
    vertexStreams: mesh.vertexStreams.map((stream) => ({
      ...stream,
      attributes: [
        ...stream.attributes,
        { semantic: "TANGENT", format: "float32x4", offset: 32 },
      ],
    })),
  };
}
