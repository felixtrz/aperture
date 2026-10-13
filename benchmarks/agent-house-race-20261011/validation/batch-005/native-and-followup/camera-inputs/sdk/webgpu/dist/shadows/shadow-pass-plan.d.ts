import type { ShadowRequestPacket } from "@aperture-engine/render";
import type { ShadowTextureResourceReport } from "./shadow-texture-resource.js";
export type ShadowPassSubmissionStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type ShadowPassSubmissionMode = "ready" | "deferred" | "unsupported";
export type ShadowPassPlanDiagnosticCode = "shadowPassPlan.missingTextureResources" | "shadowPassPlan.missingShadowRequest" | "shadowPassPlan.submissionDeferred" | "shadowPassPlan.submissionUnsupported";
export interface ShadowPassPlan {
    readonly shadowId: number;
    readonly lightId: number;
    readonly lightKind: NonNullable<ShadowRequestPacket["lightKind"]>;
    readonly cascadeIndex?: number;
    readonly cascadeCount?: number;
    readonly faceIndex: number;
    readonly faceCount: 1 | 6;
    readonly passKey: string;
    readonly resourceKey: string;
    readonly textureKey: string;
    readonly viewKey: string;
    readonly width: number;
    readonly height: number;
    readonly depthFormat: "depth24plus";
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly depthLoadOp: "clear" | "load";
    readonly depthStoreOp: "store";
    readonly depthClearValue: 0 | 1;
    readonly submission: Exclude<ShadowPassSubmissionMode, "ready"> | "ready";
}
export interface ShadowPassPlanDiagnostic {
    readonly code: ShadowPassPlanDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowPassPlanReport {
    readonly ready: boolean;
    readonly status: ShadowPassSubmissionStatus;
    readonly requestCount: number;
    readonly textureCount: number;
    readonly passCount: number;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly textureResources: boolean;
        readonly passPlans: boolean;
        readonly passSubmission: boolean;
        readonly gpuCommands: boolean;
    };
    readonly passes: readonly ShadowPassPlan[];
    readonly diagnostics: readonly ShadowPassPlanDiagnostic[];
}
export type ShadowPassPlanReportJsonValue = ShadowPassPlanReport;
export interface ShadowPassPlanInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly textures: ShadowTextureResourceReport;
    readonly submission?: ShadowPassSubmissionMode;
}
export declare function createShadowPassPlanReport(input: ShadowPassPlanInput): ShadowPassPlanReport;
export declare function shadowPassPlanReportToJsonValue(report: ShadowPassPlanReport): ShadowPassPlanReportJsonValue;
export declare function shadowPassPlanReportToJson(report: ShadowPassPlanReport): string;
//# sourceMappingURL=shadow-pass-plan.d.ts.map