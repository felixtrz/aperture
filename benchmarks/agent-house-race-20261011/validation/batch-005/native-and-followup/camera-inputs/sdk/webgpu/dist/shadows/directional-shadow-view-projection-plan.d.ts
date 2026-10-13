import type { LightPacket, ShadowRequestPacket } from "@aperture-engine/render";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type DirectionalShadowViewProjectionStatus = "ready" | "deferred" | "unsupported" | "missing" | "not-required";
export type DirectionalShadowViewProjectionMode = "ready" | "deferred";
export type DirectionalShadowViewProjectionDiagnosticCode = "directionalShadowViewProjection.missingLight" | "directionalShadowViewProjection.unsupportedLightKind" | "directionalShadowViewProjection.missingPassPlan" | "directionalShadowViewProjection.matrixDeferred";
export interface DirectionalShadowViewProjectionPlan {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly lightKind: "directional";
    readonly cascadeIndex?: number;
    readonly cascadeCount?: number;
    readonly cascadeNear?: number;
    readonly cascadeFar?: number;
    /**
     * Absolute world-space near distance of this cascade's camera-frustum slice.
     * Emitted alongside the normalized {@link cascadeNear} fraction so the matrix
     * fit (M4-T1) can build the frustum slice and so the matrix-side splits agree
     * with the shader-side selection bounds (light-packing directionalCascadeFarBounds).
     */
    readonly cascadeNearDistance?: number;
    /** Absolute world-space far distance of this cascade's camera-frustum slice. */
    readonly cascadeFarDistance?: number;
    readonly lightTransformOffset: number;
    readonly mapSize: number;
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly center?: readonly [number, number, number];
    readonly orthographicSize?: number;
    readonly near?: number;
    readonly far?: number;
    readonly lightDistance?: number;
    readonly projection: "orthographic";
    readonly viewMatrixKey: string;
    readonly projectionMatrixKey: string;
    readonly viewProjectionMatrixKey: string;
    readonly computation: DirectionalShadowViewProjectionMode;
}
export interface DirectionalShadowViewProjectionDiagnostic {
    readonly code: DirectionalShadowViewProjectionDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId: number;
    readonly lightId: number;
    readonly message: string;
}
export interface DirectionalShadowViewProjectionPlanReport {
    readonly ready: boolean;
    readonly status: DirectionalShadowViewProjectionStatus;
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
    readonly plans: readonly DirectionalShadowViewProjectionPlan[];
    readonly diagnostics: readonly DirectionalShadowViewProjectionDiagnostic[];
}
export type DirectionalShadowViewProjectionPlanReportJsonValue = DirectionalShadowViewProjectionPlanReport;
export interface DirectionalShadowViewProjectionPlanInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly lights: readonly LightPacket[];
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly computation?: DirectionalShadowViewProjectionMode;
    /**
     * Camera near plane distance feeding the practical cascade-split scheme. When
     * omitted the nearest cascade bound falls back to the same minimum the
     * light-packing far-bounds use, preserving prior behavior.
     */
    readonly cameraNear?: number;
    /** Camera far plane distance; defaults to the per-light shadow max distance. */
    readonly cameraFar?: number;
    /**
     * Shadow max distance for the cascade split. Defaults per-light to
     * {@link LightPacket.range} so the matrix-side splits use the SAME source as
     * the shader-side selection bounds (light-packing directionalCascadeFarBounds).
     */
    readonly shadowMaxDistance?: number;
}
export declare function createDirectionalShadowViewProjectionPlanReport(input: DirectionalShadowViewProjectionPlanInput): DirectionalShadowViewProjectionPlanReport;
export declare function directionalShadowViewProjectionPlanReportToJsonValue(report: DirectionalShadowViewProjectionPlanReport): DirectionalShadowViewProjectionPlanReportJsonValue;
export declare function directionalShadowViewProjectionPlanReportToJson(report: DirectionalShadowViewProjectionPlanReport): string;
//# sourceMappingURL=directional-shadow-view-projection-plan.d.ts.map