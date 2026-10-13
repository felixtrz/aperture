import type { StandardMaterialSamplerFidelityDiagnosticCode, StandardMaterialSamplerFidelityReportJsonValue, StandardMaterialTextureField } from "@aperture-engine/render";
export interface StandardMaterialSamplerFidelityFieldSummary {
    readonly field: StandardMaterialTextureField;
    readonly slotCount: number;
    readonly warningCount: number;
}
export interface StandardMaterialSamplerFidelityIssueSummary {
    readonly code: StandardMaterialSamplerFidelityDiagnosticCode;
    readonly count: number;
}
export interface StandardMaterialSamplerFidelitySummary {
    readonly materialCount: number;
    readonly readyMaterialCount: number;
    readonly blockedMaterialCount: number;
    readonly slotCount: number;
    readonly warningCount: number;
    readonly byField: readonly StandardMaterialSamplerFidelityFieldSummary[];
    readonly byIssue: readonly StandardMaterialSamplerFidelityIssueSummary[];
    readonly mipmapIssueCount: number;
    readonly lodIssueCount: number;
    readonly anisotropyIssueCount: number;
}
export declare function createStandardMaterialSamplerFidelitySummary(reports: readonly StandardMaterialSamplerFidelityReportJsonValue[]): StandardMaterialSamplerFidelitySummary;
//# sourceMappingURL=standard-material-sampler-fidelity-summary.d.ts.map