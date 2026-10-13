import type { PackedSnapshotTransforms } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
export type WorldTransformBufferDescriptorDiagnosticCode = "worldTransformBuffer.emptyData" | "worldTransformBuffer.invalidUsageFlags" | "worldTransformBuffer.packDiagnostic";
export interface WorldTransformBufferDescriptorDiagnostic {
    readonly code: WorldTransformBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly sourceCode?: string;
}
export interface WorldTransformBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly offsets: PackedSnapshotTransforms["offsets"];
}
export interface CreateWorldTransformBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface WorldTransformBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: WorldTransformBufferDescriptorPlan | null;
    readonly diagnostics: readonly WorldTransformBufferDescriptorDiagnostic[];
}
export interface WorldTransformBufferDescriptorScratch {
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
        offsets: PackedSnapshotTransforms["offsets"];
    };
    readonly diagnostics: WorldTransformBufferDescriptorDiagnostic[];
    readonly result: {
        valid: boolean;
        plan: WorldTransformBufferDescriptorPlan | null;
        diagnostics: readonly WorldTransformBufferDescriptorDiagnostic[];
    };
}
export type WorldTransformGpuBufferDiagnosticCode = "worldTransformGpuBuffer.nullDescriptorPlan" | "worldTransformGpuBuffer.creationFailed";
export interface WorldTransformGpuBufferDiagnostic {
    readonly code: WorldTransformGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface WorldTransformGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly offsets: WorldTransformBufferDescriptorPlan["offsets"];
}
export interface CreateWorldTransformGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: WorldTransformBufferDescriptorPlan | null;
}
export interface CreateWorldTransformGpuBufferResult {
    readonly valid: boolean;
    readonly resource: WorldTransformGpuBufferResource | null;
    readonly diagnostics: readonly WorldTransformGpuBufferDiagnostic[];
}
export declare const DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE: number;
export declare function createWorldTransformBufferDescriptorScratch(): WorldTransformBufferDescriptorScratch;
export declare function writeWorldTransformBufferDescriptor(packed: PackedSnapshotTransforms, scratch: WorldTransformBufferDescriptorScratch, options?: CreateWorldTransformBufferDescriptorOptions): WorldTransformBufferDescriptorResult;
export declare function createWorldTransformBufferDescriptor(packed: PackedSnapshotTransforms, options?: CreateWorldTransformBufferDescriptorOptions): WorldTransformBufferDescriptorResult;
export declare function createWorldTransformGpuBuffer(options: CreateWorldTransformGpuBufferOptions): CreateWorldTransformGpuBufferResult;
//# sourceMappingURL=world-transform-buffer.d.ts.map