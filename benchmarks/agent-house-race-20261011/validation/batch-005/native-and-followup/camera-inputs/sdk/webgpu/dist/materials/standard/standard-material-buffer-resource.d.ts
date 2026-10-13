import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { StandardMaterialBufferDescriptorPlan } from "./standard-material-buffer.js";
export type StandardMaterialGpuBufferDiagnosticCode = "standardMaterialGpuBuffer.nullDescriptorPlan" | "standardMaterialGpuBuffer.creationFailed";
export interface StandardMaterialGpuBufferDiagnostic {
    readonly code: StandardMaterialGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface StandardMaterialGpuBufferResource {
    readonly resourceKey: string;
    readonly uniformBuffer: unknown;
    readonly dependencies: StandardMaterialBufferDescriptorPlan["dependencies"];
    readonly featureFlags: number;
}
export interface CreateStandardMaterialGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: StandardMaterialBufferDescriptorPlan | null;
}
export interface CreateStandardMaterialGpuBufferResult {
    readonly valid: boolean;
    readonly resource: StandardMaterialGpuBufferResource | null;
    readonly diagnostics: readonly StandardMaterialGpuBufferDiagnostic[];
}
export declare function createStandardMaterialGpuBuffer(options: CreateStandardMaterialGpuBufferOptions): CreateStandardMaterialGpuBufferResult;
//# sourceMappingURL=standard-material-buffer-resource.d.ts.map