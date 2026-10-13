import type { RenderResourceSummaryCounts, RenderResourceSummaryReport } from "./resource-summary.js";
export interface PreparedResourceLifetimeFacadeSummary {
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
export type PreparedResourceLifetimeAlignmentDiagnosticCode = "preparedResourceLifetime.backendMissingResources" | "preparedResourceLifetime.backendStaleResources" | "preparedResourceLifetime.backendPendingDestroyResources";
export interface PreparedResourceLifetimeAlignmentDiagnostic {
    readonly code: PreparedResourceLifetimeAlignmentDiagnosticCode;
    readonly message: string;
    readonly severity: "warning";
    readonly facadePreparedMeshes: number;
    readonly facadePreparedMaterials: number;
    readonly backendMissingResources?: number;
    readonly backendStaleResources?: number;
    readonly backendPendingDestroyResources?: number;
}
export interface PreparedResourceLifetimeAlignmentSummary {
    readonly facade: {
        readonly preparedMeshes: number;
        readonly preparedMaterials: number;
        readonly readyDraws: number;
        readonly blockedDraws: number;
    };
    readonly backend: Pick<RenderResourceSummaryCounts, "meshResources" | "materialBuffers" | "staleResources" | "missingResources" | "pendingDestroyResources">;
    readonly diagnostics: readonly PreparedResourceLifetimeAlignmentDiagnostic[];
}
export type PreparedResourceLifetimeAlignmentSummaryJsonValue = PreparedResourceLifetimeAlignmentSummary;
export declare function createPreparedResourceLifetimeAlignmentSummary(input: {
    readonly facade: PreparedResourceLifetimeFacadeSummary;
    readonly backend: RenderResourceSummaryReport;
}): PreparedResourceLifetimeAlignmentSummary;
export declare function preparedResourceLifetimeAlignmentSummaryToJsonValue(summary: PreparedResourceLifetimeAlignmentSummary): PreparedResourceLifetimeAlignmentSummaryJsonValue;
//# sourceMappingURL=prepared-resource-lifetime-alignment-summary.d.ts.map