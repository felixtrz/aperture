import type {
  GltfMaterialMappingReport,
  GltfMaterialMappingReportJsonValue,
} from "./gltf-material-types.js";
import type { MaterialAsset } from "./types.js";

export function gltfMaterialMappingReportToJsonValue(
  report: GltfMaterialMappingReport,
): GltfMaterialMappingReportJsonValue {
  return {
    valid: report.valid,
    material:
      report.material === null ? null : cloneMaterialAsset(report.material),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMaterialMappingReportToJson(
  report: GltfMaterialMappingReport,
): string {
  return JSON.stringify(gltfMaterialMappingReportToJsonValue(report));
}

function cloneMaterialAsset(material: MaterialAsset): Record<string, unknown> {
  const cloned: Record<string, unknown> = {
    ...material,
    renderState: {
      ...material.renderState,
      depth: { ...material.renderState.depth },
      blend: { ...material.renderState.blend },
    },
  };

  if ("baseColorFactor" in material) {
    cloned.baseColorFactor = Array.from(material.baseColorFactor);
  }

  return cloned;
}
