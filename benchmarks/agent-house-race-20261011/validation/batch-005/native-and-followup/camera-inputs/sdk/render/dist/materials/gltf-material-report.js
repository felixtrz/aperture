export function gltfMaterialMappingReportToJsonValue(report) {
    return {
        valid: report.valid,
        material: report.material === null ? null : cloneMaterialAsset(report.material),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfMaterialMappingReportToJson(report) {
    return JSON.stringify(gltfMaterialMappingReportToJsonValue(report));
}
function cloneMaterialAsset(material) {
    const cloned = {
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
//# sourceMappingURL=gltf-material-report.js.map