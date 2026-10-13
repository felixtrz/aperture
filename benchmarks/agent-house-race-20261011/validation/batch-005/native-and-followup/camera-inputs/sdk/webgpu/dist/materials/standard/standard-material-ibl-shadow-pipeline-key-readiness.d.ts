import type { StandardMaterialIblShadowBindingReadinessReport } from "./standard-material-ibl-shadow-binding-readiness.js";
export type StandardMaterialIblShadowPipelineKeyStatus = "available" | "inactive" | "missing" | "not-required";
export type StandardMaterialIblShadowPipelineFeature = "ibl-diffuse-irradiance" | "ibl-specular-prefilter" | "shadow-view-projection" | "shadow-map";
export type StandardMaterialIblShadowPipelineKeyDiagnosticCode = "standardMaterialIblShadowPipelineKey.missingBindingReadiness" | "standardMaterialIblShadowPipelineKey.featureInactive";
export interface StandardMaterialIblShadowPipelineKeyFeature {
    readonly feature: StandardMaterialIblShadowPipelineFeature;
    readonly pipelineKeyToken: string;
    readonly source: "ibl" | "shadow";
    readonly requiredBySlotCount: number;
    readonly readiness: "available" | "inactive";
}
export interface StandardMaterialIblShadowPipelineKeyDiagnostic {
    readonly code: StandardMaterialIblShadowPipelineKeyDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly feature?: StandardMaterialIblShadowPipelineFeature;
}
export interface StandardMaterialIblShadowPipelineKeyReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialIblShadowPipelineKeyStatus;
    readonly standardMaterialCount: number;
    readonly featureCount: number;
    readonly sections: {
        readonly bindingReadiness: boolean;
        readonly pipelineKeyMetadata: boolean;
        readonly pipelineDescriptor: boolean;
        readonly bindGroupLayout: boolean;
        readonly shaderSampling: boolean;
    };
    readonly features: readonly StandardMaterialIblShadowPipelineKeyFeature[];
    readonly diagnostics: readonly StandardMaterialIblShadowPipelineKeyDiagnostic[];
}
export type StandardMaterialIblShadowPipelineKeyReadinessReportJsonValue = StandardMaterialIblShadowPipelineKeyReadinessReport;
export interface StandardMaterialIblShadowPipelineKeyReadinessInput {
    readonly standardMaterialCount: number;
    readonly bindingReadiness: StandardMaterialIblShadowBindingReadinessReport;
    readonly submittedPipelineKeys?: readonly string[];
    readonly bindGroupAvailable?: boolean;
}
export declare function createStandardMaterialIblShadowPipelineKeyReadinessReport(input: StandardMaterialIblShadowPipelineKeyReadinessInput): StandardMaterialIblShadowPipelineKeyReadinessReport;
export declare function standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(report: StandardMaterialIblShadowPipelineKeyReadinessReport): StandardMaterialIblShadowPipelineKeyReadinessReportJsonValue;
export declare function standardMaterialIblShadowPipelineKeyReadinessReportToJson(report: StandardMaterialIblShadowPipelineKeyReadinessReport): string;
//# sourceMappingURL=standard-material-ibl-shadow-pipeline-key-readiness.d.ts.map