import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowMatrixBufferDescriptorReport, ShadowViewProjectionPlanReportLike } from "./shadow-matrix-buffer-descriptor.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type ShadowCasterCommandPlanStatus = "ready" | "deferred" | "missing" | "unsupported" | "not-required";
export type ShadowCasterCommandEncodingMode = "ready" | "deferred";
export type ShadowCasterCommandPlanDiagnosticCode = "shadowCasterCommandPlan.missingPassPlan" | "shadowCasterCommandPlan.missingViewProjection" | "shadowCasterCommandPlan.unsupportedViewProjection" | "shadowCasterCommandPlan.missingMatrixBuffer" | "shadowCasterCommandPlan.unsupportedMatrixBuffer" | "shadowCasterCommandPlan.missingCasterDrawList" | "shadowCasterCommandPlan.missingMatrixEntry" | "shadowCasterCommandPlan.commandEncodingDeferred";
export interface ShadowCasterCommandPlanDiagnostic {
    readonly code: ShadowCasterCommandPlanDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowCasterCommandPlan {
    readonly commandKey: string;
    readonly shadowId: number;
    readonly lightId: number;
    readonly passKey: string;
    readonly matrixResourceKey: string;
    readonly matrixOffsetBytes: number;
    readonly drawCount: number;
    readonly commandEncoding: ShadowCasterCommandEncodingMode;
}
export interface ShadowCasterCommandPlanReadinessReport {
    readonly ready: boolean;
    readonly status: ShadowCasterCommandPlanStatus;
    readonly counts: {
        readonly requests: number;
        readonly passes: number;
        readonly viewProjectionPlans: number;
        readonly matrices: number;
        readonly casterLists: number;
        readonly drawCommands: number;
        readonly commandPlans: number;
    };
    readonly sections: {
        readonly shadowPassPlan: boolean;
        readonly viewProjectionPlanning: boolean;
        readonly matrixBufferDescriptor: boolean;
        readonly casterDrawLists: boolean;
        readonly commandEncoding: boolean;
        readonly gpuCommands: false;
    };
    readonly commands: readonly ShadowCasterCommandPlan[];
    readonly diagnostics: readonly ShadowCasterCommandPlanDiagnostic[];
}
export type ShadowCasterCommandPlanReadinessReportJsonValue = ShadowCasterCommandPlanReadinessReport;
export interface ShadowCasterCommandPlanReadinessScratch {
    readonly commands: ShadowCasterCommandPlan[];
    readonly commandPool: ShadowCasterCommandPlan[];
    readonly diagnostics: ShadowCasterCommandPlanDiagnostic[];
    readonly report: ShadowCasterCommandPlanReadinessReport;
}
export interface ShadowCasterCommandPlanReadinessInput {
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly viewProjection: ShadowViewProjectionPlanReportLike;
    readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly commandEncoding?: ShadowCasterCommandEncodingMode;
}
export declare function createShadowCasterCommandPlanReadinessReport(input: ShadowCasterCommandPlanReadinessInput): ShadowCasterCommandPlanReadinessReport;
export declare function createShadowCasterCommandPlanReadinessScratch(): ShadowCasterCommandPlanReadinessScratch;
export declare function writeShadowCasterCommandPlanReadinessReport(input: ShadowCasterCommandPlanReadinessInput, scratch: ShadowCasterCommandPlanReadinessScratch): ShadowCasterCommandPlanReadinessReport;
export declare function shadowCasterCommandPlanReadinessReportToJsonValue(report: ShadowCasterCommandPlanReadinessReport): ShadowCasterCommandPlanReadinessReportJsonValue;
export declare function shadowCasterCommandPlanReadinessReportToJson(report: ShadowCasterCommandPlanReadinessReport): string;
//# sourceMappingURL=shadow-caster-command-plan-readiness.d.ts.map