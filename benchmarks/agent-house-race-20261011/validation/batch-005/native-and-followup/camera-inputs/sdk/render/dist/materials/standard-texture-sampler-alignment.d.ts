import type { StandardMaterialSamplerFidelityReportJsonValue } from "./standard-sampler-fidelity.js";
import type { StandardMaterialTextureField, StandardMaterialTextureReadinessReportJsonValue } from "./standard-texture-readiness.js";
export interface StandardMaterialTextureSamplerAlignmentFieldSummary {
    readonly field: StandardMaterialTextureField;
    readonly textureSlotReady: boolean | null;
    readonly samplerWarningCount: number;
}
export interface StandardMaterialTextureSamplerAlignmentSummary {
    readonly materialKey: string;
    readonly textureReady: boolean;
    readonly samplerFidelityReady: boolean;
    readonly blockingTextureDiagnosticCount: number;
    readonly samplerWarningCount: number;
    readonly byField: readonly StandardMaterialTextureSamplerAlignmentFieldSummary[];
}
export type StandardMaterialTextureSamplerAlignmentSummaryJsonValue = StandardMaterialTextureSamplerAlignmentSummary;
export declare function createStandardMaterialTextureSamplerAlignmentSummary(input: {
    readonly textureReadiness: StandardMaterialTextureReadinessReportJsonValue;
    readonly samplerFidelity: StandardMaterialSamplerFidelityReportJsonValue;
}): StandardMaterialTextureSamplerAlignmentSummary;
export declare function standardMaterialTextureSamplerAlignmentSummaryToJsonValue(summary: StandardMaterialTextureSamplerAlignmentSummary): StandardMaterialTextureSamplerAlignmentSummaryJsonValue;
//# sourceMappingURL=standard-texture-sampler-alignment.d.ts.map