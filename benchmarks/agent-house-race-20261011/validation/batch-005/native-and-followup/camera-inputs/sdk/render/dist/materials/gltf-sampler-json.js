export function gltfSamplerMappingReportToJsonValue(report) {
    return {
        valid: report.valid,
        sampler: { ...report.sampler },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfSamplerMappingReportToJson(report) {
    return JSON.stringify(gltfSamplerMappingReportToJsonValue(report));
}
//# sourceMappingURL=gltf-sampler-json.js.map