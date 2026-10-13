import type { PackedSnapshotViewUniformRecord, PackedSnapshotViewUniforms } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
export type ViewUniformBufferDescriptorDiagnosticCode = "viewUniformBuffer.emptyData" | "viewUniformBuffer.invalidUsageFlags" | "viewUniformBuffer.packDiagnostic";
export interface ViewUniformBufferDescriptorDiagnostic {
    readonly code: ViewUniformBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly sourceCode?: string;
}
export interface ViewUniformBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly views: readonly PackedSnapshotViewUniformRecord[];
}
export interface CreateViewUniformBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface ViewUniformBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: ViewUniformBufferDescriptorPlan | null;
    readonly diagnostics: readonly ViewUniformBufferDescriptorDiagnostic[];
}
export interface ViewUniformBufferDescriptorScratch {
    source: Float32Array;
    readonly descriptor: {
        label?: string;
        size: number;
        usage: number;
        mappedAtCreation?: boolean;
        initialData?: ArrayBufferView;
    };
    readonly plan: {
        descriptor: WebGpuBufferDescriptor;
        source: Float32Array;
        views: readonly PackedSnapshotViewUniformRecord[];
    };
    readonly diagnostics: ViewUniformBufferDescriptorDiagnostic[];
    readonly result: {
        valid: boolean;
        plan: ViewUniformBufferDescriptorPlan | null;
        diagnostics: readonly ViewUniformBufferDescriptorDiagnostic[];
    };
}
export declare function createViewUniformBufferDescriptorScratch(): ViewUniformBufferDescriptorScratch;
export declare function writeViewUniformBufferDescriptor(packed: PackedSnapshotViewUniforms, scratch: ViewUniformBufferDescriptorScratch, options?: CreateViewUniformBufferDescriptorOptions): ViewUniformBufferDescriptorResult;
export declare function createViewUniformBufferDescriptor(packed: PackedSnapshotViewUniforms, options?: CreateViewUniformBufferDescriptorOptions): ViewUniformBufferDescriptorResult;
//# sourceMappingURL=view-uniform-buffer.d.ts.map