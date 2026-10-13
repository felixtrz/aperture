import type { ShadowPassPlanDiagnostic, ShadowPassPlanReport } from "../../shadows/shadow-pass-plan.js";
export type StandardMaterialShadowStatus = "available" | "unsupported" | "missing" | "deferred" | "not-required";
export type StandardMaterialShadowReadinessDiagnosticCode = "standardMaterialShadow.missingPassPlan" | "standardMaterialShadow.unsupportedPassSubmission" | "standardMaterialShadow.passSubmissionDeferred" | "standardMaterialShadow.shaderSamplingDeferred";
export interface StandardMaterialShadowReadinessDiagnostic {
    readonly code: StandardMaterialShadowReadinessDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly passPlanDiagnostics: readonly ShadowPassPlanDiagnostic[];
}
export interface StandardMaterialShadowReadinessReport {
    readonly ready: boolean;
    readonly status: StandardMaterialShadowStatus;
    readonly standardMaterialCount: number;
    readonly shadowRequestCount: number;
    readonly passCount: number;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly shadowTextureResources: boolean;
        readonly shadowPassPlan: boolean;
        readonly passSubmission: boolean;
        readonly shaderSampling: false;
    };
    readonly diagnostics: readonly StandardMaterialShadowReadinessDiagnostic[];
}
export type StandardMaterialShadowReadinessReportJsonValue = StandardMaterialShadowReadinessReport;
export interface StandardMaterialShadowReadinessInput {
    readonly standardMaterialCount: number;
    readonly shadowPassPlan: ShadowPassPlanReport;
}
export declare function createStandardMaterialShadowReadinessReport(input: StandardMaterialShadowReadinessInput): StandardMaterialShadowReadinessReport;
export declare function standardMaterialShadowReadinessReportToJsonValue(report: StandardMaterialShadowReadinessReport): StandardMaterialShadowReadinessReportJsonValue;
export declare function standardMaterialShadowReadinessReportToJson(report: StandardMaterialShadowReadinessReport): string;
//# sourceMappingURL=standard-material-shadow-readiness.d.ts.map