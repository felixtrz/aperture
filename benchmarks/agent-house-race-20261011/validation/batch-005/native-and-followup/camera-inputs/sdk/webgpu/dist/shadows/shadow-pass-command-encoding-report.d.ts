import type { ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type ShadowPassCommandEncodingStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowPassCommandEncodingMode = "ready" | "deferred";
export type ShadowPassCommandEncodingDiagnosticCode = "shadowPassCommandEncoding.missingPassPlan" | "shadowPassCommandEncoding.missingDepthView" | "shadowPassCommandEncoding.missingMatrixBuffer" | "shadowPassCommandEncoding.missingCasterDrawList" | "shadowPassCommandEncoding.missingCommandPlan" | "shadowPassCommandEncoding.commandEncodingDeferred";
export interface ShadowPassCommandEncodingDiagnostic {
    readonly code: ShadowPassCommandEncodingDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly passKey?: string;
    readonly shadowId?: number;
    readonly lightId?: number;
    readonly resourceKey?: string;
}
export interface ShadowPassCommandEncodingRecord {
    readonly passKey: string;
    readonly shadowId: number;
    readonly lightId: number;
    readonly depthTextureKey: string;
    readonly depthViewKey: string;
    readonly matrixResourceKey: string;
    readonly commandKey: string;
    readonly drawCount: number;
    readonly commandEncoding: ShadowPassCommandEncodingMode;
}
export interface ShadowPassCommandEncodingReport {
    readonly ready: boolean;
    readonly status: ShadowPassCommandEncodingStatus;
    readonly counts: {
        readonly passes: number;
        readonly depthViews: number;
        readonly matrixBuffers: number;
        readonly casterLists: number;
        readonly commandPlans: number;
        readonly commandRecords: number;
        readonly drawCommands: number;
    };
    readonly sections: {
        readonly passPlans: boolean;
        readonly depthTextureResources: boolean;
        readonly matrixBufferResource: boolean;
        readonly casterDrawLists: boolean;
        readonly commandPlans: boolean;
        readonly commandEncoding: boolean;
        readonly passSubmission: false;
        readonly shaderSampling: false;
    };
    readonly records: readonly ShadowPassCommandEncodingRecord[];
    readonly diagnostics: readonly ShadowPassCommandEncodingDiagnostic[];
}
export type ShadowPassCommandEncodingReportJsonValue = ShadowPassCommandEncodingReport;
export interface ShadowPassCommandEncodingInput {
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
    readonly casterDrawList: ShadowCasterDrawListPlanReport;
    readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
    readonly commandEncoding?: ShadowPassCommandEncodingMode;
}
export interface ShadowPassCommandEncodingScratch {
    readonly records: ShadowPassCommandEncodingRecord[];
    readonly recordPool: ShadowPassCommandEncodingRecord[];
    readonly diagnostics: ShadowPassCommandEncodingDiagnostic[];
    readonly report: ShadowPassCommandEncodingReport;
}
export declare function createShadowPassCommandEncodingReport(input: ShadowPassCommandEncodingInput): ShadowPassCommandEncodingReport;
export declare function createShadowPassCommandEncodingScratch(): ShadowPassCommandEncodingScratch;
export declare function writeShadowPassCommandEncodingReport(input: ShadowPassCommandEncodingInput, scratch: ShadowPassCommandEncodingScratch): ShadowPassCommandEncodingReport;
export declare function shadowPassCommandEncodingReportToJsonValue(report: ShadowPassCommandEncodingReport): ShadowPassCommandEncodingReportJsonValue;
export declare function shadowPassCommandEncodingReportToJson(report: ShadowPassCommandEncodingReport): string;
//# sourceMappingURL=shadow-pass-command-encoding-report.d.ts.map