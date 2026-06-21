import { preparedMaterialStoreSummaryToJsonValue, preparedMeshStoreSummaryToJsonValue, } from "../assets/preparation.js";
export function createRenderWorldPreparedResourceSummary(options) {
    const meshStore = preparedMeshStoreSummaryToJsonValue(options.meshes);
    const materialStore = preparedMaterialStoreSummaryToJsonValue(options.materials);
    const diagnostics = collectDiagnostics(options);
    return {
        preparedMeshes: {
            totalEntries: meshStore.totalEntries,
        },
        preparedMaterials: {
            totalEntries: materialStore.totalEntries,
            families: materialStore.families,
        },
        bindings: {
            meshes: bindingSummary(options.meshBinding),
            materials: bindingSummary(options.materialBinding),
        },
        drawReadiness: options.drawReadiness
            ? {
                present: true,
                ready: options.drawReadiness.ready.length,
                blocked: options.drawReadiness.blocked.length,
            }
            : {
                present: false,
                ready: 0,
                blocked: 0,
            },
        diagnostics: diagnosticSummary(diagnostics),
    };
}
export function renderWorldPreparedResourceSummaryToJsonValue(summary) {
    return {
        preparedMeshes: { ...summary.preparedMeshes },
        preparedMaterials: {
            totalEntries: summary.preparedMaterials.totalEntries,
            families: { ...summary.preparedMaterials.families },
        },
        bindings: {
            meshes: { ...summary.bindings.meshes },
            materials: { ...summary.bindings.materials },
        },
        drawReadiness: { ...summary.drawReadiness },
        diagnostics: { ...summary.diagnostics },
    };
}
function bindingSummary(report) {
    return report === undefined
        ? { present: false, updated: 0, missing: 0 }
        : {
            present: true,
            updated: report.updated,
            missing: report.missing,
        };
}
function collectDiagnostics(options) {
    return [
        ...(options.meshBinding?.diagnostics ?? []),
        ...(options.materialBinding?.diagnostics ?? []),
        ...(options.drawReadiness?.diagnostics ?? []),
        ...(options.diagnostics ?? []),
    ];
}
function diagnosticSummary(diagnostics) {
    let info = 0;
    let warnings = 0;
    let errors = 0;
    for (const diagnostic of diagnostics) {
        switch (diagnostic.severity) {
            case "info":
                info += 1;
                break;
            case "warning":
                warnings += 1;
                break;
            case "error":
                errors += 1;
                break;
        }
    }
    return {
        total: diagnostics.length,
        info,
        warnings,
        errors,
    };
}
//# sourceMappingURL=render-world-prepared-resource-summary.js.map