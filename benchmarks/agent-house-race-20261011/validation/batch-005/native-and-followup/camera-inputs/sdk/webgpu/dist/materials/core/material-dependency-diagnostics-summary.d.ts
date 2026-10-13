import type { MaterialAssetDependencyReadinessDiagnosticCode, MaterialAssetDependencyReadinessReportJsonValue, MaterialAssetDependencyReadinessStatus, MaterialDependencyKind, MaterialKind } from "@aperture-engine/render";
export interface MaterialDependencyStatusBucketSummary {
    readonly status: MaterialAssetDependencyReadinessStatus;
    readonly slotCount: number;
}
export interface MaterialDependencyKindBucketSummary {
    readonly dependencyKind: MaterialDependencyKind;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
}
export interface MaterialDependencyMaterialKindBucketSummary {
    readonly materialKind: MaterialKind | "unknown";
    readonly materialCount: number;
    readonly readyMaterialCount: number;
    readonly blockedMaterialCount: number;
}
export interface MaterialDependencyDiagnosticCodeSummary {
    readonly total: number;
    readonly byCode: Readonly<Partial<Record<MaterialAssetDependencyReadinessDiagnosticCode, number>>>;
}
export interface MaterialDependencyDiagnosticsSummary {
    readonly materialCount: number;
    readonly readyMaterialCount: number;
    readonly blockedMaterialCount: number;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
    readonly byMaterialKind: readonly MaterialDependencyMaterialKindBucketSummary[];
    readonly byDependencyKind: readonly MaterialDependencyKindBucketSummary[];
    readonly byStatus: readonly MaterialDependencyStatusBucketSummary[];
    readonly diagnostics: MaterialDependencyDiagnosticCodeSummary;
}
export declare function createMaterialDependencyDiagnosticsSummary(reports: readonly MaterialAssetDependencyReadinessReportJsonValue[]): MaterialDependencyDiagnosticsSummary;
//# sourceMappingURL=material-dependency-diagnostics-summary.d.ts.map