import { resolvePrimitiveMaterial } from "./gltf-primitive-material-resolution-resolve.js";
export function createGltfPrimitiveMaterialResolutionReport(options) {
    const diagnostics = [];
    const resolved = [];
    const unresolved = [];
    const context = {
        ...options,
        availableMaterialHandleKeys: new Set(options.availableMaterialHandleKeys ?? []),
        keyPrefix: options.keyPrefix ?? "gltf",
    };
    for (const primitive of options.primitiveReport.meshes) {
        const resolution = resolvePrimitiveMaterial(context, primitive);
        if (resolution.kind === "resolved") {
            resolved.push(resolution.value);
            continue;
        }
        diagnostics.push(...resolution.value.diagnostics);
        unresolved.push(resolution.value);
    }
    return {
        valid: diagnostics.length === 0,
        resolved,
        unresolved,
        diagnostics,
    };
}
export function gltfPrimitiveMaterialResolutionReportToJsonValue(report) {
    return {
        valid: report.valid,
        resolved: report.resolved.map((entry) => ({ ...entry })),
        unresolved: report.unresolved.map((entry) => ({
            ...entry,
            diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfPrimitiveMaterialResolutionReportToJson(report) {
    return JSON.stringify(gltfPrimitiveMaterialResolutionReportToJsonValue(report));
}
//# sourceMappingURL=gltf-primitive-material-resolution.js.map