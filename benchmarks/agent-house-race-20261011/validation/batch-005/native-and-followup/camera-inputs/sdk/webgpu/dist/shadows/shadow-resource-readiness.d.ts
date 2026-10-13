import type { ShadowMapDescriptorReport } from "./shadow-map-descriptor.js";
export type ShadowResourceReadinessStatus = "available" | "unsupported" | "missing" | "not-required";
export type ShadowResourceReadinessDiagnosticCode = "shadowResourceReadiness.missingDescriptors" | "shadowResourceReadiness.passSubmissionDeferred";
export interface ShadowResourceReadinessDiagnostic {
    readonly code: ShadowResourceReadinessDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowResourceReadinessReport {
    readonly ready: boolean;
    readonly status: ShadowResourceReadinessStatus;
    readonly requestCount: number;
    readonly descriptorCount: number;
    readonly resourceKeys: readonly string[];
    readonly sections: {
        readonly shadowMapDescriptors: boolean;
        readonly shadowMapResources: boolean;
        readonly shadowPassSubmission: false;
    };
    readonly diagnostics: readonly ShadowResourceReadinessDiagnostic[];
}
export type ShadowResourceReadinessReportJsonValue = ShadowResourceReadinessReport;
export interface ShadowResourceReadinessInput {
    readonly descriptors: ShadowMapDescriptorReport;
}
export declare function createShadowResourceReadinessReport(input: ShadowResourceReadinessInput): ShadowResourceReadinessReport;
export declare function shadowResourceReadinessReportToJsonValue(report: ShadowResourceReadinessReport): ShadowResourceReadinessReportJsonValue;
export declare function shadowResourceReadinessReportToJson(report: ShadowResourceReadinessReport): string;
//# sourceMappingURL=shadow-resource-readiness.d.ts.map