import { registerGltfPlannedMeshSourceAsset } from "./gltf-mesh-source-registration-writers.js";
export function registerGltfMeshSourceAssetsFromConstructionReport(options) {
    const diagnostics = [];
    const written = [];
    const skipped = [];
    if (!options.report.valid && options.report.meshes.length === 0) {
        diagnostics.push({
            code: "gltfMeshRegistration.invalidConstructionReport",
            severity: "error",
            message: "No mesh source assets were registered because the construction report is invalid.",
        });
        return result({ diagnostics, written, skipped });
    }
    for (const mesh of options.report.meshes) {
        registerGltfPlannedMeshSourceAsset({
            registry: options.registry,
            report: options.report,
            mesh,
            diagnostics,
            written,
            skipped,
        });
    }
    return result({ diagnostics, written, skipped });
}
export function gltfMeshSourceAssetRegistrationReportToJsonValue(report) {
    return {
        valid: report.valid,
        written: report.written.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        })),
        skipped: report.skipped.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfMeshSourceAssetRegistrationReportToJson(report) {
    return JSON.stringify(gltfMeshSourceAssetRegistrationReportToJsonValue(report));
}
function result(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        written: input.written,
        skipped: input.skipped,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=gltf-mesh-source-registration.js.map