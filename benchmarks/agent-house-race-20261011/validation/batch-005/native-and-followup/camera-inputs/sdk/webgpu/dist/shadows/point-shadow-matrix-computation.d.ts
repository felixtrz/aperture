import type { PointShadowViewProjectionPlan, PointShadowViewProjectionPlanReport } from "./point-shadow-view-projection-plan.js";
export type PointShadowMatrixComputationStatus = "ready" | "missing" | "unsupported" | "not-required";
export type PointShadowMatrixComputationDiagnosticCode = "pointShadowMatrix.missingViewProjectionPlan" | "pointShadowMatrix.unsupportedViewProjectionPlan" | "pointShadowMatrix.missingLightTransform" | "pointShadowMatrix.invalidFace";
export interface PointShadowMatrixComputationDiagnostic {
    readonly code: PointShadowMatrixComputationDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId?: number;
    readonly lightId?: number;
    readonly message: string;
}
export interface PointShadowMatrixComputation {
    readonly shadowId: number;
    readonly lightId: number;
    readonly faceIndex: number;
    readonly faceLabel: PointShadowViewProjectionPlan["faceLabel"];
    readonly planKey: string;
    readonly passKey: string;
    readonly matrixKey: string;
    readonly lightTransformOffset: number;
    readonly lightPosition: readonly [number, number, number];
    readonly target: readonly [number, number, number];
    readonly up: readonly [number, number, number];
    readonly fovYRadians: number;
    readonly near: number;
    readonly far: number;
    readonly viewMatrix: readonly number[];
    readonly projectionMatrix: readonly number[];
    readonly viewProjectionMatrix: readonly number[];
}
export interface PointShadowMatrixComputationReport {
    readonly ready: boolean;
    readonly status: PointShadowMatrixComputationStatus;
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
    readonly matrices: readonly PointShadowMatrixComputation[];
    readonly diagnostics: readonly PointShadowMatrixComputationDiagnostic[];
}
export type PointShadowMatrixComputationReportJsonValue = PointShadowMatrixComputationReport;
export interface PointShadowMatrixComputationInput {
    readonly viewProjection: PointShadowViewProjectionPlanReport;
    readonly transforms: Float32Array;
}
export declare function createPointShadowMatrixComputationReport(input: PointShadowMatrixComputationInput): PointShadowMatrixComputationReport;
export declare function pointShadowMatrixComputationReportToJsonValue(report: PointShadowMatrixComputationReport): PointShadowMatrixComputationReportJsonValue;
export declare function pointShadowMatrixComputationReportToJson(report: PointShadowMatrixComputationReport): string;
//# sourceMappingURL=point-shadow-matrix-computation.d.ts.map