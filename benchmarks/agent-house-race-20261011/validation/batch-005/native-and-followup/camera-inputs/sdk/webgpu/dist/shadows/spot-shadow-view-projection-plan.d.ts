import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type SpotShadowViewProjectionStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type SpotShadowViewProjectionMode = "ready" | "deferred";
export type SpotShadowViewProjectionDiagnosticCode = "spotShadowViewProjection.missingLight" | "spotShadowViewProjection.unsupportedLightKind" | "spotShadowViewProjection.missingPassPlan" | "spotShadowViewProjection.matrixDeferred";
export interface SpotShadowViewProjectionPlan {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly lightKind: "spot";
    readonly lightTransformOffset: number;
    readonly mapSize: number;
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly projection: "perspective-spot";
    readonly fovYRadians: number;
    readonly near: number;
    readonly far: number;
    readonly viewMatrixKey: string;
    readonly projectionMatrixKey: string;
    readonly viewProjectionMatrixKey: string;
    readonly computation: SpotShadowViewProjectionMode;
}
export interface SpotShadowViewProjectionDiagnostic {
    readonly code: SpotShadowViewProjectionDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId: number;
    readonly lightId: number;
    readonly message: string;
}
export interface SpotShadowViewProjectionPlanReport {
    readonly ready: boolean;
    readonly status: SpotShadowViewProjectionStatus;
    readonly requestCount: number;
    readonly passCount: number;
    readonly planCount: number;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly lightPackets: boolean;
        readonly passPlans: boolean;
        readonly matrixPlanning: boolean;
        readonly gpuResources: false;
    };
    readonly plans: readonly SpotShadowViewProjectionPlan[];
    readonly diagnostics: readonly SpotShadowViewProjectionDiagnostic[];
}
export type SpotShadowViewProjectionPlanReportJsonValue = SpotShadowViewProjectionPlanReport;
export interface SpotShadowViewProjectionPlanInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly lights: readonly LightPacket[];
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly computation?: SpotShadowViewProjectionMode;
    readonly near?: number;
}
export declare function createSpotShadowViewProjectionPlanReport(input: SpotShadowViewProjectionPlanInput): SpotShadowViewProjectionPlanReport;
export declare function spotShadowViewProjectionPlanReportToJsonValue(report: SpotShadowViewProjectionPlanReport): SpotShadowViewProjectionPlanReportJsonValue;
export declare function spotShadowViewProjectionPlanReportToJson(report: SpotShadowViewProjectionPlanReport): string;
//# sourceMappingURL=spot-shadow-view-projection-plan.d.ts.map