export function createFrameAssemblyReadinessReport(input) {
    const diagnostics = [];
    diagnostics.push(...input.drawPackages.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.severity,
    })));
    diagnostics.push(...input.viewUniforms.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.code === "viewUniform.emptySnapshot"
            ? "info"
            : "warning",
    })));
    for (const result of input.meshResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            severity: "warning",
        })));
    }
    for (const result of input.materialResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            severity: "warning",
        })));
    }
    for (const result of input.pipelines) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            severity: result.ok ? "warning" : "error",
        })));
    }
    if (input.drawPackages.packages.length === 0) {
        diagnostics.push({
            code: "frameReadiness.emptyFrame",
            message: "Frame assembly has no draw packages ready for submission.",
            severity: "info",
        });
    }
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const blocked = input.meshResources.filter((result) => !result.valid).length +
        input.materialResources.filter((result) => !result.valid).length +
        input.pipelines.filter((result) => !result.ok).length;
    return {
        ready: input.drawPackages.packages.length > 0 && blocked === 0 && errors === 0,
        counts: {
            drawPackages: input.drawPackages.packages.length,
            viewUniforms: input.viewUniforms.views.length,
            meshResourcesReady: input.meshResources.filter((result) => result.valid)
                .length,
            materialResourcesReady: input.materialResources.filter((result) => result.valid).length,
            pipelineHits: input.pipelines.filter((result) => result.ok && result.status === "hit").length,
            pipelineMisses: input.pipelines.filter((result) => result.ok && result.status === "miss").length,
            blocked,
            warnings,
            errors,
        },
        diagnostics,
    };
}
//# sourceMappingURL=frame-readiness.js.map