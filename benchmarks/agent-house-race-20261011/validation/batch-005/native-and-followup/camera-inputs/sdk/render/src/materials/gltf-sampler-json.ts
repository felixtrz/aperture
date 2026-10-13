import type {
  GltfSamplerMappingReport,
  GltfSamplerMappingReportJsonValue,
} from "./gltf-sampler-types.js";

export function gltfSamplerMappingReportToJsonValue(
  report: GltfSamplerMappingReport,
): GltfSamplerMappingReportJsonValue {
  return {
    valid: report.valid,
    sampler: { ...report.sampler },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSamplerMappingReportToJson(
  report: GltfSamplerMappingReport,
): string {
  return JSON.stringify(gltfSamplerMappingReportToJsonValue(report));
}
