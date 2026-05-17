import { describe, expect, it } from "vitest";

import {
  gltfPrimitiveMaterialResolutionReportToJson,
  gltfPrimitiveMaterialResolutionReportToJsonValue,
  type GltfPrimitiveMaterialResolutionReport,
} from "@aperture-engine/core";

describe("glTF primitive material resolution report JSON", () => {
  it("serializes resolved and unresolved primitive material entries", () => {
    const report: GltfPrimitiveMaterialResolutionReport = {
      valid: false,
      resolved: [
        {
          meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
          meshIndex: 0,
          primitiveIndex: 0,
          materialIndex: 0,
          materialHandleKey: "material:gltf:material:0",
          source: "registered",
        },
      ],
      unresolved: [
        {
          meshHandleKey: "mesh:gltf:mesh:0:primitive:1",
          meshIndex: 0,
          primitiveIndex: 1,
          materialIndex: null,
          materialHandleKey: "material:gltf:default",
          reason: "gltfPrimitiveMaterial.defaultMaterialUnavailable",
          diagnostics: [
            {
              code: "gltfPrimitiveMaterial.defaultMaterialUnavailable",
              severity: "error",
              message:
                "glTF mesh 0 primitive 1 requires default material 'material:gltf:default' but it was not registered or provided as available.",
              meshHandleKey: "mesh:gltf:mesh:0:primitive:1",
              meshIndex: 0,
              primitiveIndex: 1,
              materialIndex: null,
              materialHandleKey: "material:gltf:default",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfPrimitiveMaterial.defaultMaterialUnavailable",
          severity: "error",
          message:
            "glTF mesh 0 primitive 1 requires default material 'material:gltf:default' but it was not registered or provided as available.",
          meshHandleKey: "mesh:gltf:mesh:0:primitive:1",
          meshIndex: 0,
          primitiveIndex: 1,
          materialIndex: null,
          materialHandleKey: "material:gltf:default",
        },
      ],
    };
    const json = gltfPrimitiveMaterialResolutionReportToJsonValue(report);

    expect(json).toEqual(report);
    expect(
      JSON.parse(gltfPrimitiveMaterialResolutionReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toContain("AssetRegistry");
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
    expect(JSON.stringify(json)).not.toContain("sourceData");
    expect(JSON.stringify(json)).not.toContain("GPU");
    expect(JSON.stringify(json)).not.toContain("EcsWorld");
  });

  it("preserves skipped material dependency diagnostics", () => {
    const report: GltfPrimitiveMaterialResolutionReport = {
      valid: false,
      resolved: [],
      unresolved: [
        {
          meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
          meshIndex: 1,
          primitiveIndex: 0,
          materialIndex: 3,
          materialHandleKey: "material:gltf:material:3",
          reason: "gltfPrimitiveMaterial.failedMaterialDependency",
          diagnostics: [
            {
              code: "gltfPrimitiveMaterial.failedMaterialDependency",
              severity: "error",
              message:
                "glTF mesh 1 primitive 0 references material 'material:gltf:material:3' with failed source asset dependencies.",
              meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
              meshIndex: 1,
              primitiveIndex: 0,
              materialIndex: 3,
              materialHandleKey: "material:gltf:material:3",
              registrationReason: "gltfRegistration.missingDependency",
              dependencyKey: "texture:gltf:texture:4:baseColorTexture",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfPrimitiveMaterial.failedMaterialDependency",
          severity: "error",
          message:
            "glTF mesh 1 primitive 0 references material 'material:gltf:material:3' with failed source asset dependencies.",
          meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
          meshIndex: 1,
          primitiveIndex: 0,
          materialIndex: 3,
          materialHandleKey: "material:gltf:material:3",
          registrationReason: "gltfRegistration.missingDependency",
          dependencyKey: "texture:gltf:texture:4:baseColorTexture",
        },
      ],
    };

    expect(gltfPrimitiveMaterialResolutionReportToJsonValue(report)).toEqual({
      valid: false,
      resolved: [],
      unresolved: [
        {
          meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
          meshIndex: 1,
          primitiveIndex: 0,
          materialIndex: 3,
          materialHandleKey: "material:gltf:material:3",
          reason: "gltfPrimitiveMaterial.failedMaterialDependency",
          diagnostics: [
            {
              code: "gltfPrimitiveMaterial.failedMaterialDependency",
              severity: "error",
              message:
                "glTF mesh 1 primitive 0 references material 'material:gltf:material:3' with failed source asset dependencies.",
              meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
              meshIndex: 1,
              primitiveIndex: 0,
              materialIndex: 3,
              materialHandleKey: "material:gltf:material:3",
              registrationReason: "gltfRegistration.missingDependency",
              dependencyKey: "texture:gltf:texture:4:baseColorTexture",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfPrimitiveMaterial.failedMaterialDependency",
          severity: "error",
          message:
            "glTF mesh 1 primitive 0 references material 'material:gltf:material:3' with failed source asset dependencies.",
          meshHandleKey: "mesh:gltf:mesh:1:primitive:0",
          meshIndex: 1,
          primitiveIndex: 0,
          materialIndex: 3,
          materialHandleKey: "material:gltf:material:3",
          registrationReason: "gltfRegistration.missingDependency",
          dependencyKey: "texture:gltf:texture:4:baseColorTexture",
        },
      ],
    });
  });
});
