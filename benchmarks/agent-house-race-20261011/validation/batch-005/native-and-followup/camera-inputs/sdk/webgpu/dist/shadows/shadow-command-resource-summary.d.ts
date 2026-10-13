import type { DirectionalShadowViewProjectionPlanReport } from "./directional-shadow-view-projection-plan.js";
import type { ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowMatrixBufferDescriptorReport } from "./shadow-matrix-buffer-descriptor.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
import type { ShadowTextureResourceReport } from "./shadow-texture-resource.js";
export type ShadowCommandResourceSummaryStatus = "ready" | "deferred" | "missing" | "unsupported" | "not-required";
export type ShadowCommandResourceSummaryDiagnosticCode = "shadowCommandResourceSummary.missingTextureResources" | "shadowCommandResourceSummary.missingPassPlan" | "shadowCommandResourceSummary.missingViewProjection" | "shadowCommandResourceSummary.unsupportedViewProjection" | "shadowCommandResourceSummary.missingMatrixBuffer" | "shadowCommandResourceSummary.unsupportedMatrixBuffer" | "shadowCommandResourceSummary.missingCasterDrawList" | "shadowCommandResourceSummary.missingCommandPlan" | "shadowCommandResourceSummary.textureAllocationDeferred" | "shadowCommandResourceSummary.commandEncodingDeferred";
export interface ShadowCommandResourceSummaryDiagnostic {
    readonly code: ShadowCommandResourceSummaryDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowCommandResourceSummaryReport {
    readonly ready: boolean;
    readonly status: ShadowCommandResourceSummaryStatus;
    readonly counts: {
        readonly requests: number;
        readonly textures: number;
        readonly passes: number;
        readonly viewProjectionPlans: number;
        readonly matrices: number;
        readonly casterLists: number;
        readonly commandPlans: number;
        readonly drawCommands: number;
    };
    readonly sections: {
        readonly textureResources: boolean;
        readonly passPlans: boolean;
        readonly viewProjectionPlanning: boolean;
        readonly matrixBufferDescriptor: boolean;
        readonly casterDrawLists: boolean;
        readonly commandPlans: boolean;
        readonly gpuAllocation: false;
        readonly commandEncoding: boolean;
    };
    readonly resourceKeys: {
        readonly textures: readonly string[];
        readonly views: readonly string[];
        readonly passes: readonly string[];
        readonly matrixBuffers: readonly string[];
        readonly commands: readonly string[];
    };
    readonly diagnostics: readonly ShadowCommandResourceSummaryDiagnostic[];
}
export type ShadowCommandResourceSummaryReportJsonValue = ShadowCommandResourceSummaryReport;
export interface ShadowCommandResourceSummaryInput {
    readonly textures: ShadowTextureResourceReport;
    readonly passPlan: ShadowPassPlanReport;
    readonly viewProjection: DirectionalShadowViewProjectionPlanReport;
    readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
}
export declare function createShadowCommandResourceSummaryReport(input: ShadowCommandResourceSummaryInput): ShadowCommandResourceSummaryReport;
export declare function shadowCommandResourceSummaryReportToJsonValue(report: ShadowCommandResourceSummaryReport): ShadowCommandResourceSummaryReportJsonValue;
export declare function shadowCommandResourceSummaryReportToJson(report: ShadowCommandResourceSummaryReport): string;
//# sourceMappingURL=shadow-command-resource-summary.d.ts.map