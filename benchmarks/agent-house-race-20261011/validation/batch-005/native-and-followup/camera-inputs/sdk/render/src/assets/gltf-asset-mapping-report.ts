import type {
  GltfAssetMappingReport,
  GltfAssetMappingReportJsonValue,
} from "./gltf-asset-mapping-types.js";

export function gltfAssetMappingReportToJsonValue(
  report: GltfAssetMappingReport,
): GltfAssetMappingReportJsonValue {
  return {
    valid: report.valid,
    root: report.root,
    textures: report.textures.map((texture) => ({
      ...texture,
      texture: texture.report.texture,
    })),
    samplers: report.samplers.map((sampler) => ({ ...sampler })),
    materials: report.materials.map((material) => ({
      ...material,
      material: material.report.material,
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfAssetMappingReportToJson(
  report: GltfAssetMappingReport,
): string {
  return JSON.stringify(gltfAssetMappingReportToJsonValue(report));
}
