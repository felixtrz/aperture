import { createRenderWorldPreparedResourceSummary, } from "./render-world-prepared-resource-summary.js";
export function createRenderWorldPreparedResourceSummaryFromReport(options) {
    return createRenderWorldPreparedResourceSummary({
        meshes: options.meshes,
        materials: options.materials,
        meshBinding: options.report.meshes.binding,
        materialBinding: options.report.materials.binding,
        ...(options.drawReadiness === undefined
            ? {}
            : { drawReadiness: options.drawReadiness }),
        diagnostics: [
            ...options.report.apply.diagnostics,
            ...options.report.meshes.preparation.diagnostics,
            ...options.report.materials.preparation.diagnostics,
            ...(options.diagnostics ?? []),
        ],
    });
}
//# sourceMappingURL=render-world-prepared-resource-summary-from-report.js.map