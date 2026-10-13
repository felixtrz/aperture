import type { PackedSnapshotInstanceTints } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
export declare const INSTANCE_TINT_FLOATS = 4;
export declare const INSTANCE_TINT_BYTES: number;
export declare const INSTANCE_TINT_SHADER_LOCATION = 6;
export type InstanceTintBufferDescriptorDiagnosticCode = "instanceTintBuffer.emptyData" | "instanceTintBuffer.invalidUsageFlags" | "instanceTintBuffer.packDiagnostic";
export interface InstanceTintBufferDescriptorDiagnostic {
    readonly code: InstanceTintBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly sourceCode?: string;
}
export interface InstanceTintBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly offsets: PackedSnapshotInstanceTints["offsets"];
    readonly vertexCount: number;
}
export interface CreateInstanceTintBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface InstanceTintBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: InstanceTintBufferDescriptorPlan | null;
    readonly diagnostics: readonly InstanceTintBufferDescriptorDiagnostic[];
}
export interface InstanceTintBufferDescriptorScratch {
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
        offsets: PackedSnapshotInstanceTints["offsets"];
        vertexCount: number;
    };
    readonly diagnostics: InstanceTintBufferDescriptorDiagnostic[];
    readonly result: {
        valid: boolean;
        plan: InstanceTintBufferDescriptorPlan | null;
        diagnostics: readonly InstanceTintBufferDescriptorDiagnostic[];
    };
}
export type InstanceTintGpuBufferDiagnosticCode = "instanceTintGpuBuffer.nullDescriptorPlan" | "instanceTintGpuBuffer.creationFailed";
export interface InstanceTintGpuBufferDiagnostic {
    readonly code: InstanceTintGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface InstanceTintGpuBufferResource {
    readonly streamId: "instanceTint";
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly vertexCount: number;
    readonly offsets: InstanceTintBufferDescriptorPlan["offsets"];
}
export interface CreateInstanceTintGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: InstanceTintBufferDescriptorPlan | null;
}
export interface CreateInstanceTintGpuBufferResult {
    readonly valid: boolean;
    readonly resource: InstanceTintGpuBufferResource | null;
    readonly diagnostics: readonly InstanceTintGpuBufferDiagnostic[];
}
export declare const DEFAULT_INSTANCE_TINT_BUFFER_USAGE: number;
export declare const INSTANCE_TINT_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: number;
    readonly stepMode: "instance";
    readonly attributes: readonly [{
        readonly shaderLocation: 6;
        readonly offset: 0;
        readonly format: "float32x4";
    }];
};
export declare function createInstanceTintBufferDescriptorScratch(): InstanceTintBufferDescriptorScratch;
export declare function writeInstanceTintBufferDescriptor(packed: PackedSnapshotInstanceTints, scratch: InstanceTintBufferDescriptorScratch, options?: CreateInstanceTintBufferDescriptorOptions): InstanceTintBufferDescriptorResult;
export declare function createInstanceTintBufferDescriptor(packed: PackedSnapshotInstanceTints, options?: CreateInstanceTintBufferDescriptorOptions): InstanceTintBufferDescriptorResult;
export declare function createInstanceTintGpuBuffer(options: CreateInstanceTintGpuBufferOptions): CreateInstanceTintGpuBufferResult;
//# sourceMappingURL=instance-tint-buffer.d.ts.map