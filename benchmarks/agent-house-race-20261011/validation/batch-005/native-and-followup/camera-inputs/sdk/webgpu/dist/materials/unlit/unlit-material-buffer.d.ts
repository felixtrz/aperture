import type { PackedUnlitMaterial, UnlitMaterialResourceDependencies } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
export type UnlitMaterialBufferDescriptorDiagnosticCode = "unlitMaterialBuffer.nullPackedMaterial" | "unlitMaterialBuffer.invalidUniformData" | "unlitMaterialBuffer.invalidUsageFlags";
export interface UnlitMaterialBufferDescriptorDiagnostic {
    readonly code: UnlitMaterialBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface UnlitMaterialBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly dependencies: UnlitMaterialResourceDependencies;
}
export interface UnlitMaterialBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: UnlitMaterialBufferDescriptorPlan | null;
    readonly diagnostics: readonly UnlitMaterialBufferDescriptorDiagnostic[];
}
export interface CreateUnlitMaterialBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export declare const DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE: number;
export declare function createUnlitMaterialBufferDescriptor(packed: PackedUnlitMaterial | null, options?: CreateUnlitMaterialBufferDescriptorOptions): UnlitMaterialBufferDescriptorResult;
//# sourceMappingURL=unlit-material-buffer.d.ts.map