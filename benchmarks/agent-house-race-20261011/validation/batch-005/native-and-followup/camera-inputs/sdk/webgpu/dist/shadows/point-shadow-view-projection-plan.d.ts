import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type PointShadowViewProjectionStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type PointShadowViewProjectionMode = "ready" | "deferred";
export type PointShadowViewProjectionDiagnosticCode = "pointShadowViewProjection.missingLight" | "pointShadowViewProjection.unsupportedLightKind" | "pointShadowViewProjection.missingPassPlan" | "pointShadowViewProjection.matrixDeferred";
export interface PointShadowViewProjectionPlan {
    readonly shadowId: number;
    readonly lightId: number;
    readonly faceIndex: number;
    readonly faceLabel: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
    readonly planKey: string;
    readonly passKey: string;
    readonly lightKind: "point";
    readonly lightTransformOffset: number;
    readonly mapSize: number;
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly projection: "perspective-cube-face";
    readonly fovYRadians: number;
    readonly near: number;
    readonly far: number;
    readonly viewMatrixKey: string;
    readonly projectionMatrixKey: string;
    readonly viewProjectionMatrixKey: string;
    readonly computation: PointShadowViewProjectionMode;
}
export interface PointShadowViewProjectionDiagnostic {
    readonly code: PointShadowViewProjectionDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId: number;
    readonly lightId: number;
    readonly message: string;
}
export interface PointShadowViewProjectionPlanReport {
    readonly ready: boolean;
    readonly status: PointShadowViewProjectionStatus;
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
    readonly plans: readonly PointShadowViewProjectionPlan[];
    readonly diagnostics: readonly PointShadowViewProjectionDiagnostic[];
}
export type PointShadowViewProjectionPlanReportJsonValue = PointShadowViewProjectionPlanReport;
export interface PointShadowViewProjectionPlanInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly lights: readonly LightPacket[];
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly computation?: PointShadowViewProjectionMode;
    readonly near?: number;
}
export declare function createPointShadowViewProjectionPlanReport(input: PointShadowViewProjectionPlanInput): PointShadowViewProjectionPlanReport;
export declare function pointShadowViewProjectionPlanReportToJsonValue(report: PointShadowViewProjectionPlanReport): PointShadowViewProjectionPlanReportJsonValue;
export declare function pointShadowViewProjectionPlanReportToJson(report: PointShadowViewProjectionPlanReport): string;
//# sourceMappingURL=point-shadow-view-projection-plan.d.ts.map