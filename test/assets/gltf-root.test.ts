import { describe, expect, it } from "vitest";

import {
  gltfRootValidationReportToJson,
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
} from "@aperture-engine/core";

describe("glTF root validation for asset mapping", () => {
  it("accepts a minimal glTF 2.0 root with mapper arrays", () => {
    const report = validateGltfRootForAssetMapping({
      asset: { version: "2.0" },
      materials: [],
      textures: [],
      images: [],
      samplers: [],
      extensionsRequired: ["KHR_materials_unlit", "KHR_texture_basisu"],
    });

    expect(report).toEqual({ valid: true, diagnostics: [] });
  });

  it("reports invalid glTF versions and missing asset metadata", () => {
    expect(validateGltfRootForAssetMapping({}).diagnostics).toMatchObject([
      {
        code: "gltfRoot.invalidAsset",
        severity: "error",
        field: "asset",
      },
    ]);
    expect(
      validateGltfRootForAssetMapping({
        asset: { version: "1.0" },
      }).diagnostics,
    ).toMatchObject([
      {
        code: "gltfRoot.unsupportedVersion",
        severity: "error",
        field: "asset.version",
        value: "1.0",
      },
    ]);
  });

  it("reports malformed mapper arrays", () => {
    const report = validateGltfRootForAssetMapping({
      asset: { version: "2.0" },
      materials: {},
      textures: "bad",
      images: null,
      samplers: 1,
      extensionsRequired: "KHR_materials_unlit",
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.field)).toEqual([
      "materials",
      "textures",
      "images",
      "samplers",
      "extensionsRequired",
    ]);
  });

  it("reports unsupported required extensions with JSON-safe output", () => {
    const report = validateGltfRootForAssetMapping({
      asset: { version: "2.0" },
      extensionsRequired: ["EXT_mesh_gpu_instancing", 42],
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfRoot.unsupportedRequiredExtension",
        severity: "error",
        extensionName: "EXT_mesh_gpu_instancing",
      },
      {
        code: "gltfRoot.unsupportedRequiredExtension",
        severity: "error",
        value: 42,
      },
    ]);
    expect(JSON.parse(gltfRootValidationReportToJson(report))).toEqual(
      gltfRootValidationReportToJsonValue(report),
    );
  });
});
