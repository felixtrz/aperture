import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { ViewUniformBufferDescriptorPlan } from "./view-uniform-buffer.js";
export type ViewUniformGpuBufferDiagnosticCode = "viewUniformGpuBuffer.nullDescriptorPlan" | "viewUniformGpuBuffer.creationFailed";
export interface ViewUniformGpuBufferDiagnostic {
    readonly code: ViewUniformGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface ViewUniformGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly views: ViewUniformBufferDescriptorPlan["views"];
}
export interface CreateViewUniformGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: ViewUniformBufferDescriptorPlan | null;
}
export interface CreateViewUniformGpuBufferResult {
    readonly valid: boolean;
    readonly resource: ViewUniformGpuBufferResource | null;
    readonly diagnostics: readonly ViewUniformGpuBufferDiagnostic[];
}
export declare function createViewUniformGpuBuffer(options: CreateViewUniformGpuBufferOptions): CreateViewUniformGpuBufferResult;
//# sourceMappingURL=view-uniform-buffer-resource.d.ts.map