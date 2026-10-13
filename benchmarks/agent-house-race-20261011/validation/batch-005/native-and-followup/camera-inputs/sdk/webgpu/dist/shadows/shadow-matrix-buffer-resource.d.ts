import { type WebGpuBufferDeviceLike, type WebGpuBufferFailure } from "../gpu/buffer.js";
import type { ShadowMatrixBufferDescriptorReport } from "./shadow-matrix-buffer-descriptor.js";
export type ShadowMatrixBufferResourceStatus = "available" | "missing" | "not-required";
export type ShadowMatrixBufferResourceDiagnosticCode = "shadowMatrixBufferResource.missingDescriptor" | "shadowMatrixBufferResource.missingMatrices" | "shadowMatrixBufferResource.missingMatrixData" | "shadowMatrixBufferResource.bufferCreationFailed" | "shadowMatrixBufferResource.bindGroupDeferred" | "shadowMatrixBufferResource.shaderSamplingDeferred";
export interface ShadowMatrixBufferResourceDiagnostic {
    readonly code: ShadowMatrixBufferResourceDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly matrixKey?: string;
    readonly reason?: WebGpuBufferFailure["reason"];
}
export interface ShadowMatrixBufferResource {
    readonly resourceKey: string;
    readonly label: string;
    readonly buffer: unknown;
    readonly byteSize: number;
    readonly matrixCount: number;
    readonly entryMatrixKeys: readonly string[];
}
export interface ShadowMatrixBufferResourceReport {
    readonly ready: boolean;
    readonly status: ShadowMatrixBufferResourceStatus;
    readonly matrixCount: number;
    readonly byteSize: number;
    readonly createdBufferCount: number;
    readonly reusedBufferCount: number;
    readonly sections: {
        readonly matrixComputation: boolean;
        readonly bufferDescriptor: boolean;
        readonly bufferAllocation: boolean;
        readonly upload: boolean;
        readonly bindGroupResource: false;
        readonly shaderSampling: false;
    };
    readonly resource: ShadowMatrixBufferResource | null;
    readonly diagnostics: readonly ShadowMatrixBufferResourceDiagnostic[];
}
export type ShadowMatrixBufferResourceReportJsonValue = Omit<ShadowMatrixBufferResourceReport, "resource"> & {
    readonly resource: {
        readonly resourceKey: string;
        readonly label: string;
        readonly byteSize: number;
        readonly matrixCount: number;
        readonly entryMatrixKeys: readonly string[];
    } | null;
};
export interface CreateShadowMatrixBufferResourceReportOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly descriptor: ShadowMatrixBufferDescriptorReport;
    readonly matrices: ShadowMatrixComputationReportLike;
    readonly cache?: Map<string, ShadowMatrixBufferResource>;
}
export interface ShadowMatrixComputationLike {
    readonly matrixKey: string;
    readonly viewProjectionMatrix: readonly number[];
}
export interface ShadowMatrixComputationReportLike {
    readonly status: "ready" | "missing" | "unsupported" | "not-required";
    readonly matrixCount: number;
    readonly matrices: readonly ShadowMatrixComputationLike[];
}
export declare const DEFAULT_SHADOW_MATRIX_BUFFER_USAGE: number;
export declare function createShadowMatrixBufferResourceReport(options: CreateShadowMatrixBufferResourceReportOptions): ShadowMatrixBufferResourceReport;
export declare function shadowMatrixBufferResourceReportToJsonValue(value: ShadowMatrixBufferResourceReport): ShadowMatrixBufferResourceReportJsonValue;
export declare function shadowMatrixBufferResourceReportToJson(value: ShadowMatrixBufferResourceReport): string;
//# sourceMappingURL=shadow-matrix-buffer-resource.d.ts.map