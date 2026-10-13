export type ShadowMatrixBufferDescriptorStatus = "ready" | "deferred" | "missing" | "unsupported" | "not-required";
export type ShadowMatrixBufferUploadMode = "ready" | "deferred";
export type ShadowMatrixBufferDescriptorDiagnosticCode = "shadowMatrixBuffer.missingViewProjectionPlan" | "shadowMatrixBuffer.unsupportedViewProjectionPlan" | "shadowMatrixBuffer.uploadDeferred";
export interface ShadowMatrixBufferEntry {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly matrixKey: string;
    readonly offsetBytes: number;
    readonly sizeBytes: number;
    readonly upload: ShadowMatrixBufferUploadMode;
}
export interface ShadowMatrixBufferDescriptor {
    readonly resourceKey: string;
    readonly label: string;
    readonly usage: "read-only-storage-buffer";
    readonly matrixCount: number;
    readonly strideBytes: number;
    readonly byteSize: number;
    readonly entries: readonly ShadowMatrixBufferEntry[];
}
export interface ShadowMatrixBufferDescriptorDiagnostic {
    readonly code: ShadowMatrixBufferDescriptorDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
}
export interface ShadowMatrixBufferDescriptorReport {
    readonly ready: boolean;
    readonly status: ShadowMatrixBufferDescriptorStatus;
    readonly planCount: number;
    readonly matrixCount: number;
    readonly byteSize: number;
    readonly sections: {
        readonly viewProjectionPlanning: boolean;
        readonly bufferDescriptor: boolean;
        readonly gpuAllocation: false;
        readonly upload: boolean;
    };
    readonly descriptor: ShadowMatrixBufferDescriptor | null;
    readonly diagnostics: readonly ShadowMatrixBufferDescriptorDiagnostic[];
}
export type ShadowMatrixBufferDescriptorReportJsonValue = ShadowMatrixBufferDescriptorReport;
export interface ShadowMatrixBufferDescriptorInput {
    readonly viewProjection: ShadowViewProjectionPlanReportLike;
    readonly upload?: ShadowMatrixBufferUploadMode;
    readonly resourceKey?: string;
    readonly label?: string;
}
export interface ShadowViewProjectionPlanLike {
    readonly shadowId: number;
    readonly lightId: number;
    readonly planKey: string;
    readonly passKey: string;
    readonly viewProjectionMatrixKey: string;
}
export interface ShadowViewProjectionPlanReportLike {
    readonly status: "ready" | "deferred" | "unsupported" | "missing" | "not-required";
    readonly planCount: number;
    readonly plans: readonly ShadowViewProjectionPlanLike[];
}
export declare const SHADOW_MATRIX_BUFFER_STRIDE_BYTES: number;
export declare function createShadowMatrixBufferDescriptorReport(input: ShadowMatrixBufferDescriptorInput): ShadowMatrixBufferDescriptorReport;
export declare function shadowMatrixBufferDescriptorReportToJsonValue(report: ShadowMatrixBufferDescriptorReport): ShadowMatrixBufferDescriptorReportJsonValue;
export declare function shadowMatrixBufferDescriptorReportToJson(report: ShadowMatrixBufferDescriptorReport): string;
//# sourceMappingURL=shadow-matrix-buffer-descriptor.d.ts.map