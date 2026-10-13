import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { DebugNormalMaterialBufferDescriptorPlan } from "./debug-normal-material-buffer.js";
export type DebugNormalMaterialGpuBufferDiagnosticCode = "debugNormalMaterialGpuBuffer.nullDescriptorPlan" | "debugNormalMaterialGpuBuffer.creationFailed";
export interface DebugNormalMaterialGpuBufferDiagnostic {
    readonly code: DebugNormalMaterialGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface DebugNormalMaterialGpuBufferResource {
    readonly resourceKey: string;
    readonly uniformBuffer: unknown;
    readonly dependencies: DebugNormalMaterialBufferDescriptorPlan["dependencies"];
}
export interface DebugNormalMaterialGpuBufferResourceJsonValue {
    readonly resourceKey: string;
    readonly dependencies: DebugNormalMaterialBufferDescriptorPlan["dependencies"];
}
export interface CreateDebugNormalMaterialGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: DebugNormalMaterialBufferDescriptorPlan | null;
}
export interface CreateDebugNormalMaterialGpuBufferResult {
    readonly valid: boolean;
    readonly resource: DebugNormalMaterialGpuBufferResource | null;
    readonly diagnostics: readonly DebugNormalMaterialGpuBufferDiagnostic[];
}
export declare function createDebugNormalMaterialGpuBuffer(options: CreateDebugNormalMaterialGpuBufferOptions): CreateDebugNormalMaterialGpuBufferResult;
export declare function debugNormalMaterialGpuBufferResourceToJsonValue(resource: DebugNormalMaterialGpuBufferResource): DebugNormalMaterialGpuBufferResourceJsonValue;
//# sourceMappingURL=debug-normal-material-buffer-resource.d.ts.map