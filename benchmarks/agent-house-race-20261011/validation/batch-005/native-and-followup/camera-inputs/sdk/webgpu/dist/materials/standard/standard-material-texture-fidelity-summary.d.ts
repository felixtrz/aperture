import type { StandardMaterialTextureField, StandardMaterialTextureReadinessDiagnosticCode, StandardMaterialTextureReadinessReportJsonValue } from "@aperture-engine/render";
export interface StandardMaterialTextureFidelityFieldSummary {
    readonly field: StandardMaterialTextureField;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
}
export interface StandardMaterialTextureFidelityIssueSummary {
    readonly code: StandardMaterialTextureReadinessDiagnosticCode;
    readonly count: number;
}
export interface StandardMaterialTextureFidelitySummary {
    readonly materialCount: number;
    readonly readyMaterialCount: number;
    readonly blockedMaterialCount: number;
    readonly slotCount: number;
    readonly readySlotCount: number;
    readonly blockedSlotCount: number;
    readonly byField: readonly StandardMaterialTextureFidelityFieldSummary[];
    readonly byIssue: readonly StandardMaterialTextureFidelityIssueSummary[];
    readonly samplerIssueCount: number;
    readonly colorSpaceIssueCount: number;
    readonly semanticIssueCount: number;
    readonly texCoordIssueCount: number;
    readonly transformIssueCount: number;
}
export declare function createStandardMaterialTextureFidelitySummary(reports: readonly StandardMaterialTextureReadinessReportJsonValue[]): StandardMaterialTextureFidelitySummary;
//# sourceMappingURL=standard-material-texture-fidelity-summary.d.ts.map