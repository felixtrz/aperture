import type { InstanceAttributeLayout, PackedSnapshotInstanceAttributes } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
export type InstanceAttributeBufferDescriptorDiagnosticCode = "instanceAttributeBuffer.emptyData" | "instanceAttributeBuffer.layoutMismatch" | "instanceAttributeBuffer.invalidUsageFlags" | "instanceAttributeBuffer.packDiagnostic";
export interface InstanceAttributeBufferDescriptorDiagnostic {
    readonly code: InstanceAttributeBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly sourceCode?: string;
}
export interface InstanceAttributeBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly layout: InstanceAttributeLayout;
    readonly offsets: PackedSnapshotInstanceAttributes["offsets"];
    readonly vertexCount: number;
}
export interface CreateInstanceAttributeBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface InstanceAttributeBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: InstanceAttributeBufferDescriptorPlan | null;
    readonly diagnostics: readonly InstanceAttributeBufferDescriptorDiagnostic[];
}
export type InstanceAttributeGpuBufferDiagnosticCode = "instanceAttributeGpuBuffer.nullDescriptorPlan" | "instanceAttributeGpuBuffer.creationFailed";
export interface InstanceAttributeGpuBufferDiagnostic {
    readonly code: InstanceAttributeGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface InstanceAttributeGpuBufferResource {
    readonly streamId: "instanceAttributes";
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly vertexCount: number;
    readonly layout: InstanceAttributeLayout;
    readonly offsets: InstanceAttributeBufferDescriptorPlan["offsets"];
}
export interface CreateInstanceAttributeGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: InstanceAttributeBufferDescriptorPlan | null;
}
export interface CreateInstanceAttributeGpuBufferResult {
    readonly valid: boolean;
    readonly resource: InstanceAttributeGpuBufferResource | null;
    readonly diagnostics: readonly InstanceAttributeGpuBufferDiagnostic[];
}
export declare const DEFAULT_INSTANCE_ATTRIBUTE_BUFFER_USAGE: number;
export declare function createInstanceAttributeVertexBufferLayout(layout: InstanceAttributeLayout): {
    readonly arrayStride: number;
    readonly stepMode: "instance";
    readonly attributes: {
        shaderLocation: number;
        offset: number;
        format: import("@aperture-engine/render").InstanceAttributeFormat;
    }[];
};
export declare function createInstanceAttributeBufferDescriptor(packed: PackedSnapshotInstanceAttributes, options?: CreateInstanceAttributeBufferDescriptorOptions): InstanceAttributeBufferDescriptorResult;
export declare function createInstanceAttributeGpuBuffer(options: CreateInstanceAttributeGpuBufferOptions): CreateInstanceAttributeGpuBufferResult;
//# sourceMappingURL=instance-attribute-buffer.d.ts.map