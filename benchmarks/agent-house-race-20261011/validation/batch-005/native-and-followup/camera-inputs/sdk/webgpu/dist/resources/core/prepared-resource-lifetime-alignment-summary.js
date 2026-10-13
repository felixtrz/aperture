export function createPreparedResourceLifetimeAlignmentSummary(input) {
    const facadePreparedMeshes = input.facade.preparedMeshes.totalEntries;
    const facadePreparedMaterials = input.facade.preparedMaterials.totalEntries;
    const diagnostics = [];
    if ((facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
        input.backend.counts.missingResources > 0) {
        diagnostics.push({
            code: "preparedResourceLifetime.backendMissingResources",
            severity: "warning",
            facadePreparedMeshes,
            facadePreparedMaterials,
            backendMissingResources: input.backend.counts.missingResources,
            message: "Prepared facade entries exist while backend resource inspection reports missing resources.",
        });
    }
    if ((facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
        input.backend.counts.staleResources > 0) {
        diagnostics.push({
            code: "preparedResourceLifetime.backendStaleResources",
            severity: "warning",
            facadePreparedMeshes,
            facadePreparedMaterials,
            backendStaleResources: input.backend.counts.staleResources,
            message: "Prepared facade entries exist while backend resource inspection reports stale resources.",
        });
    }
    if ((facadePreparedMeshes > 0 || facadePreparedMaterials > 0) &&
        input.backend.counts.pendingDestroyResources > 0) {
        diagnostics.push({
            code: "preparedResourceLifetime.backendPendingDestroyResources",
            severity: "warning",
            facadePreparedMeshes,
            facadePreparedMaterials,
            backendPendingDestroyResources: input.backend.counts.pendingDestroyResources,
            message: "Prepared facade entries exist while backend resource inspection reports pending-destroy resources.",
        });
    }
    return {
        facade: {
            preparedMeshes: facadePreparedMeshes,
            preparedMaterials: facadePreparedMaterials,
            readyDraws: input.facade.drawReadiness.ready,
            blockedDraws: input.facade.drawReadiness.blocked,
        },
        backend: {
            meshResources: input.backend.counts.meshResources,
            materialBuffers: input.backend.counts.materialBuffers,
            staleResources: input.backend.counts.staleResources,
            missingResources: input.backend.counts.missingResources,
            pendingDestroyResources: input.backend.counts.pendingDestroyResources,
        },
        diagnostics,
    };
}
export function preparedResourceLifetimeAlignmentSummaryToJsonValue(summary) {
    return {
        facade: { ...summary.facade },
        backend: { ...summary.backend },
        diagnostics: summary.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
//# sourceMappingURL=prepared-resource-lifetime-alignment-summary.js.map