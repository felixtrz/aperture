import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { UnlitMaterialBufferDescriptorPlan } from "./unlit-material-buffer.js";
export type UnlitMaterialGpuBufferDiagnosticCode = "unlitMaterialGpuBuffer.nullDescriptorPlan" | "unlitMaterialGpuBuffer.creationFailed";
export interface UnlitMaterialGpuBufferDiagnostic {
    readonly code: UnlitMaterialGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface UnlitMaterialGpuBufferResource {
    readonly resourceKey: string;
    readonly uniformBuffer: unknown;
    readonly dependencies: UnlitMaterialBufferDescriptorPlan["dependencies"];
}
export interface CreateUnlitMaterialGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: UnlitMaterialBufferDescriptorPlan | null;
}
export interface CreateUnlitMaterialGpuBufferResult {
    readonly valid: boolean;
    readonly resource: UnlitMaterialGpuBufferResource | null;
    readonly diagnostics: readonly UnlitMaterialGpuBufferDiagnostic[];
}
export declare function createUnlitMaterialGpuBuffer(options: CreateUnlitMaterialGpuBufferOptions): CreateUnlitMaterialGpuBufferResult;
//# sourceMappingURL=unlit-material-buffer-resource.d.ts.map