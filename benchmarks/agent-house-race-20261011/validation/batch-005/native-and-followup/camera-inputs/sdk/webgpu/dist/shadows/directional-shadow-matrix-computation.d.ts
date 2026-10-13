import { type Mat4Like, type Vec3Like } from "@aperture-engine/simulation";
import type { DirectionalShadowViewProjectionPlanReport } from "./directional-shadow-view-projection-plan.js";
export type DirectionalShadowMatrixComputationStatus = "ready" | "missing" | "unsupported" | "not-required";
export type DirectionalShadowMatrixComputationDiagnosticCode = "directionalShadowMatrix.missingViewProjectionPlan" | "directionalShadowMatrix.unsupportedViewProjectionPlan" | "directionalShadowMatrix.missingLightTransform" | "directionalShadowMatrix.invalidLightDirection";
export interface DirectionalShadowMatrixComputationDiagnostic {
    readonly code: DirectionalShadowMatrixComputationDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId?: number;
    readonly lightId?: number;
    readonly message: string;
}
export interface DirectionalShadowMatrixComputation {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly matrixKey: string;
    readonly lightTransformOffset: number;
    readonly cascadeIndex?: number;
    readonly cascadeCount?: number;
    readonly cascadeNear?: number;
    readonly cascadeFar?: number;
    readonly center: readonly [number, number, number];
    readonly lightDirection: readonly [number, number, number];
    readonly lightPosition: readonly [number, number, number];
    readonly orthographicSize: number;
    readonly near: number;
    readonly far: number;
    readonly viewMatrix: readonly number[];
    readonly projectionMatrix: readonly number[];
    readonly viewProjectionMatrix: readonly number[];
}
export interface DirectionalShadowMatrixComputationReport {
    readonly ready: boolean;
    readonly status: DirectionalShadowMatrixComputationStatus;
    readonly planCount: number;
    readonly matrixCount: number;
    readonly sections: {
        readonly viewProjectionPlanning: boolean;
        readonly transformData: boolean;
        readonly matrixComputation: boolean;
        readonly gpuBufferAllocation: false;
        readonly upload: false;
        readonly passSubmission: false;
    };
    readonly matrices: readonly DirectionalShadowMatrixComputation[];
    readonly diagnostics: readonly DirectionalShadowMatrixComputationDiagnostic[];
}
export interface DirectionalShadowCasterBoundsInput {
    readonly passKey: string;
    readonly bounds: readonly DirectionalShadowCasterWorldAabb[];
}
export type DirectionalShadowReceiverBoundsInput = DirectionalShadowCasterBoundsInput;
export interface DirectionalShadowCasterWorldAabb {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
}
export type DirectionalShadowMatrixComputationReportJsonValue = DirectionalShadowMatrixComputationReport;
export interface DirectionalShadowMatrixComputationInput {
    readonly viewProjection: DirectionalShadowViewProjectionPlanReport;
    readonly transforms: Float32Array;
    readonly center?: Vec3Like;
    readonly orthographicSize?: number;
    readonly near?: number;
    readonly far?: number;
    readonly lightDistance?: number;
    /**
     * Camera world->view matrix. When supplied together with
     * {@link cameraProjectionMatrix} (and the plan carries absolute cascade
     * near/far distances from M4-T2), each cascade ortho is FRUSTUM-FIT to the
     * camera view slice and TEXEL-SNAPPED for stability instead of using the
     * fixed {@link center} + globally-scaled {@link orthographicSize}. Consumed
     * read-only from the snapshot transforms; no scene graph is introduced.
     */
    readonly cameraViewMatrix?: Mat4Like | undefined;
    /** Camera view->clip projection matrix (pairs with {@link cameraViewMatrix}). */
    readonly cameraProjectionMatrix?: Mat4Like | undefined;
    /** Optional world up used to build the light view basis (defaults to +Y). */
    readonly up?: Vec3Like | undefined;
    /**
     * Optional caster bounds grouped by shadow pass. Frustum fitting uses these to
     * tighten the depth range like PlayCanvas does after culling visible casters.
     */
    readonly casterBounds?: readonly DirectionalShadowCasterBoundsInput[];
    /**
     * Optional receiver bounds grouped by shadow pass. Single-cascade fitting uses
     * these to avoid spending the map on empty camera-frustum sky/background.
     */
    readonly receiverBounds?: readonly DirectionalShadowReceiverBoundsInput[];
    /**
     * Enables camera-frustum fitting when camera matrices and cascade distances
     * are available. No-camera/static fallback callers can disable this to honor
     * the supplied center/orthographic settings exactly.
     */
    readonly frustumFit?: boolean | undefined;
}
export declare function createDirectionalShadowMatrixComputationReport(input: DirectionalShadowMatrixComputationInput): DirectionalShadowMatrixComputationReport;
export declare function directionalShadowMatrixComputationReportToJsonValue(report: DirectionalShadowMatrixComputationReport): DirectionalShadowMatrixComputationReportJsonValue;
export declare function directionalShadowMatrixComputationReportToJson(report: DirectionalShadowMatrixComputationReport): string;
//# sourceMappingURL=directional-shadow-matrix-computation.d.ts.map