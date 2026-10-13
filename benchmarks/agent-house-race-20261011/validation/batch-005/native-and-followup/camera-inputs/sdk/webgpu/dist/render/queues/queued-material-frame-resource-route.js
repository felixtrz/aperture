export function createQueuedMaterialFrameResourceRouteShell(options) {
    return {
        valid: options.prepareRoute.valid && options.frameResources.valid,
        status: options.prepareRoute.valid && options.frameResources.valid
            ? "prepared"
            : "failed",
        family: options.prepareRoute.family,
        facadeMeshResourceKey: options.prepareRoute.meshResourceKey,
        facadeMaterialResourceKey: options.prepareRoute.materialResourceKey,
        backendMeshKey: options.backendMeshKey,
        backendMaterialKey: options.backendMaterialKey,
        pipelineKey: options.prepareRoute.pipelineKey,
        sourceVersion: options.prepareRoute.sourceVersion,
        frame: options.prepareRoute.frame,
        diagnostics: options.frameResources.diagnostics,
    };
}
export function createQueuedMaterialFrameResourceRouteShellSummary(shell) {
    return {
        valid: shell.valid,
        status: shell.status,
        family: shell.family,
        hasFacadeMeshResourceKey: shell.facadeMeshResourceKey !== null,
        hasFacadeMaterialResourceKey: shell.facadeMaterialResourceKey !== null,
        hasBackendMeshKey: shell.backendMeshKey.length > 0,
        hasBackendMaterialKey: shell.backendMaterialKey.length > 0,
        pipelineKey: shell.pipelineKey,
        sourceVersion: shell.sourceVersion,
        frame: shell.frame,
        diagnostics: {
            total: shell.diagnostics.length,
            byCode: diagnosticCodeCounts(shell.diagnostics),
        },
    };
}
export function queuedMaterialFrameResourceRouteShellSummaryToJsonValue(summary) {
    return {
        valid: summary.valid,
        status: summary.status,
        family: summary.family,
        hasFacadeMeshResourceKey: summary.hasFacadeMeshResourceKey,
        hasFacadeMaterialResourceKey: summary.hasFacadeMaterialResourceKey,
        hasBackendMeshKey: summary.hasBackendMeshKey,
        hasBackendMaterialKey: summary.hasBackendMaterialKey,
        pipelineKey: summary.pipelineKey,
        sourceVersion: summary.sourceVersion,
        frame: summary.frame,
        diagnostics: {
            total: summary.diagnostics.total,
            byCode: { ...summary.diagnostics.byCode },
        },
    };
}
function diagnosticCodeCounts(diagnostics) {
    const counts = {};
    for (const diagnostic of diagnostics) {
        const code = diagnosticCode(diagnostic);
        if (code === null) {
            continue;
        }
        counts[code] = (counts[code] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
function diagnosticCode(diagnostic) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
        return null;
    }
    const code = diagnostic.code;
    return typeof code === "string" ? code : null;
}
//# sourceMappingURL=queued-material-frame-resource-route.js.map