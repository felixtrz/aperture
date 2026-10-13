export interface PreparedResourceAppReuseFacadeSummary {
    readonly preparedMeshes: {
        readonly totalEntries: number;
    };
    readonly preparedMaterials: {
        readonly totalEntries: number;
    };
    readonly drawReadiness: {
        readonly ready: number;
        readonly blocked: number;
    };
}
export interface PreparedResourceAppReuseReportSummary {
    readonly preparedMeshFacade: {
        readonly totalEntries: number;
    };
    readonly preparedMaterialFacade: {
        readonly totalEntries: number;
    };
    readonly preparedMeshBuffersCreated: number;
    readonly preparedMeshBuffersReused: number;
    readonly preparedMaterialBuffersCreated: number;
    readonly preparedMaterialBuffersReused: number;
    readonly preparedMaterialBindGroupsCreated: number;
    readonly preparedMaterialBindGroupsReused: number;
    readonly textureResourcesCreated: number;
    readonly textureResourcesReused: number;
    readonly samplerResourcesCreated: number;
    readonly samplerResourcesReused: number;
    readonly dynamicBufferWrites: number;
}
export type PreparedResourceAppReuseAlignmentDiagnosticCode = "preparedResourceAppReuse.meshFacadeMismatch" | "preparedResourceAppReuse.materialFacadeMismatch";
export interface PreparedResourceAppReuseAlignmentDiagnostic {
    readonly code: PreparedResourceAppReuseAlignmentDiagnosticCode;
    readonly message: string;
    readonly severity: "warning";
    readonly renderPreparedCount: number;
    readonly appPreparedCount: number;
}
export interface PreparedResourceAppReuseAlignmentSummary {
    readonly facade: {
        readonly preparedMeshes: number;
        readonly preparedMaterials: number;
        readonly readyDraws: number;
        readonly blockedDraws: number;
    };
    readonly appFacade: {
        readonly preparedMeshes: number;
        readonly preparedMaterials: number;
    };
    readonly reuse: {
        readonly preparedMeshBuffersCreated: number;
        readonly preparedMeshBuffersReused: number;
        readonly preparedMaterialBuffersCreated: number;
        readonly preparedMaterialBuffersReused: number;
        readonly preparedMaterialBindGroupsCreated: number;
        readonly preparedMaterialBindGroupsReused: number;
        readonly textureResourcesCreated: number;
        readonly textureResourcesReused: number;
        readonly samplerResourcesCreated: number;
        readonly samplerResourcesReused: number;
        readonly dynamicBufferWrites: number;
    };
    readonly diagnostics: readonly PreparedResourceAppReuseAlignmentDiagnostic[];
}
export type PreparedResourceAppReuseAlignmentSummaryJsonValue = PreparedResourceAppReuseAlignmentSummary;
export declare function createPreparedResourceAppReuseAlignmentSummary(input: {
    readonly facade: PreparedResourceAppReuseFacadeSummary;
    readonly reuse: PreparedResourceAppReuseReportSummary;
}): PreparedResourceAppReuseAlignmentSummary;
export declare function preparedResourceAppReuseAlignmentSummaryToJsonValue(summary: PreparedResourceAppReuseAlignmentSummary): PreparedResourceAppReuseAlignmentSummaryJsonValue;
//# sourceMappingURL=prepared-resource-app-reuse-alignment-summary.d.ts.map