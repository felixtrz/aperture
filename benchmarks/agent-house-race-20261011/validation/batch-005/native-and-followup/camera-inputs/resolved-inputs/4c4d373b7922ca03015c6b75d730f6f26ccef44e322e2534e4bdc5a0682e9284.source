import { createMaterialDependencyReadinessReport, materialDependencyReadinessReportToJsonValue, } from "@aperture-engine/render";
export function diagnoseSnapshotMaterialDependencies(assets, snapshot) {
    const diagnostics = [];
    const seenMaterialKeys = new Set();
    for (const draw of snapshot.meshDraws) {
        pushMaterialDependencyDiagnostic(assets, draw.material, {
            diagnostics,
            seenMaterialKeys,
        });
    }
    if (diagnostics.length === 0 &&
        snapshot.diagnostics.some(isMaterialDependencyRenderDiagnostic)) {
        for (const entry of assets.list({ kind: "material", status: "ready" })) {
            if (entry.asset === null) {
                continue;
            }
            pushMaterialDependencyDiagnostic(assets, entry.handle, { diagnostics, seenMaterialKeys });
        }
    }
    return diagnostics;
}
function pushMaterialDependencyDiagnostic(assets, material, output) {
    const report = createMaterialDependencyReadinessReport({
        registry: assets,
        material,
    });
    if (report.ready || output.seenMaterialKeys.has(report.materialKey)) {
        return;
    }
    output.seenMaterialKeys.add(report.materialKey);
    output.diagnostics.push(createWebGpuAppMaterialDependencyDiagnostic(report));
}
export function createWebGpuAppMaterialDependencyDiagnostic(materialDependencyReadiness) {
    const json = materialDependencyReadinessReportToJsonValue(materialDependencyReadiness);
    return {
        code: "webGpuApp.materialDependenciesNotReady",
        materialDependencyReadiness: json,
        message: `Material '${json.materialKey}' has source asset dependencies that are not ready for app rendering.`,
    };
}
function isMaterialDependencyRenderDiagnostic(diagnostic) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
        return false;
    }
    const code = diagnostic.code;
    return (typeof code === "string" &&
        (code === "render.material.missingTextureHandle" ||
            code === "render.material.missingSamplerHandle" ||
            code.startsWith("render.standardMaterialTexture.") ||
            code.startsWith("render.texture.") ||
            code.startsWith("render.sampler.")));
}
//# sourceMappingURL=material-dependencies.js.map