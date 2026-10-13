import type { SpotShadowViewProjectionPlanReport } from "./spot-shadow-view-projection-plan.js";
export type SpotShadowMatrixComputationStatus = "ready" | "missing" | "unsupported" | "not-required";
export type SpotShadowMatrixComputationDiagnosticCode = "spotShadowMatrix.missingViewProjectionPlan" | "spotShadowMatrix.unsupportedViewProjectionPlan" | "spotShadowMatrix.missingLightTransform" | "spotShadowMatrix.invalidLightDirection";
export interface SpotShadowMatrixComputationDiagnostic {
    readonly code: SpotShadowMatrixComputationDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId?: number;
    readonly lightId?: number;
    readonly message: string;
}
export interface SpotShadowMatrixComputation {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly matrixKey: string;
    readonly lightTransformOffset: number;
    readonly lightPosition: readonly [number, number, number];
    readonly lightDirection: readonly [number, number, number];
    readonly target: readonly [number, number, number];
    readonly up: readonly [number, number, number];
    readonly fovYRadians: number;
    readonly near: number;
    readonly far: number;
    readonly viewMatrix: readonly number[];
    readonly projectionMatrix: readonly number[];
    readonly viewProjectionMatrix: readonly number[];
}
export interface SpotShadowMatrixComputationReport {
    readonly ready: boolean;
    readonly status: SpotShadowMatrixComputationStatus;
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
    readonly matrices: readonly SpotShadowMatrixComputation[];
    readonly diagnostics: readonly SpotShadowMatrixComputationDiagnostic[];
}
export type SpotShadowMatrixComputationReportJsonValue = SpotShadowMatrixComputationReport;
export interface SpotShadowMatrixComputationInput {
    readonly viewProjection: SpotShadowViewProjectionPlanReport;
    readonly transforms: Float32Array;
}
export declare function createSpotShadowMatrixComputationReport(input: SpotShadowMatrixComputationInput): SpotShadowMatrixComputationReport;
export declare function spotShadowMatrixComputationReportToJsonValue(report: SpotShadowMatrixComputationReport): SpotShadowMatrixComputationReportJsonValue;
export declare function spotShadowMatrixComputationReportToJson(report: SpotShadowMatrixComputationReport): string;
//# sourceMappingURL=spot-shadow-matrix-computation.d.ts.map