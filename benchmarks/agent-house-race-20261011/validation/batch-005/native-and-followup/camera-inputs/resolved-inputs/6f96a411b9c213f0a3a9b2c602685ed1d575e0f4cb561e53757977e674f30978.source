export function createPreparedResourceAppReuseAlignmentSummary(input) {
    const facadePreparedMeshes = input.facade.preparedMeshes.totalEntries;
    const facadePreparedMaterials = input.facade.preparedMaterials.totalEntries;
    const appPreparedMeshes = input.reuse.preparedMeshFacade.totalEntries;
    const appPreparedMaterials = input.reuse.preparedMaterialFacade.totalEntries;
    const diagnostics = [];
    if (facadePreparedMeshes !== appPreparedMeshes) {
        diagnostics.push({
            code: "preparedResourceAppReuse.meshFacadeMismatch",
            severity: "warning",
            renderPreparedCount: facadePreparedMeshes,
            appPreparedCount: appPreparedMeshes,
            message: "Render prepared mesh facade count differs from the app prepared mesh facade count.",
        });
    }
    if (facadePreparedMaterials !== appPreparedMaterials) {
        diagnostics.push({
            code: "preparedResourceAppReuse.materialFacadeMismatch",
            severity: "warning",
            renderPreparedCount: facadePreparedMaterials,
            appPreparedCount: appPreparedMaterials,
            message: "Render prepared material facade count differs from the app prepared material facade count.",
        });
    }
    return {
        facade: {
            preparedMeshes: facadePreparedMeshes,
            preparedMaterials: facadePreparedMaterials,
            readyDraws: input.facade.drawReadiness.ready,
            blockedDraws: input.facade.drawReadiness.blocked,
        },
        appFacade: {
            preparedMeshes: appPreparedMeshes,
            preparedMaterials: appPreparedMaterials,
        },
        reuse: {
            preparedMeshBuffersCreated: input.reuse.preparedMeshBuffersCreated,
            preparedMeshBuffersReused: input.reuse.preparedMeshBuffersReused,
            preparedMaterialBuffersCreated: input.reuse.preparedMaterialBuffersCreated,
            preparedMaterialBuffersReused: input.reuse.preparedMaterialBuffersReused,
            preparedMaterialBindGroupsCreated: input.reuse.preparedMaterialBindGroupsCreated,
            preparedMaterialBindGroupsReused: input.reuse.preparedMaterialBindGroupsReused,
            textureResourcesCreated: input.reuse.textureResourcesCreated,
            textureResourcesReused: input.reuse.textureResourcesReused,
            samplerResourcesCreated: input.reuse.samplerResourcesCreated,
            samplerResourcesReused: input.reuse.samplerResourcesReused,
            dynamicBufferWrites: input.reuse.dynamicBufferWrites,
        },
        diagnostics,
    };
}
export function preparedResourceAppReuseAlignmentSummaryToJsonValue(summary) {
    return {
        facade: { ...summary.facade },
        appFacade: { ...summary.appFacade },
        reuse: { ...summary.reuse },
        diagnostics: summary.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
//# sourceMappingURL=prepared-resource-app-reuse-alignment-summary.js.map