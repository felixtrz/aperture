import type { MeshDrawPacket, PackedTransformOffset, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
type MorphInstanceDescriptorBufferDescriptorDiagnosticCode = "morphInstanceDescriptorBuffer.notMorphed" | "morphInstanceDescriptorBuffer.missingData" | "morphInstanceDescriptorBuffer.invalidUsageFlags";
export interface MorphInstanceDescriptorBufferDescriptorDiagnostic {
    readonly code: MorphInstanceDescriptorBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly field?: string;
}
interface MorphInstanceDescriptorBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Uint32Array;
    readonly renderId: number;
    readonly instanceCount: number;
}
export interface CreateMorphInstanceDescriptorBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
    readonly transformOffsets?: readonly MorphInstanceDescriptorTransformOffset[];
}
export type MorphInstanceDescriptorTransformOffset = Pick<PackedTransformOffset, "packedOffset" | "renderId" | "sourceOffset">;
export interface MorphInstanceDescriptorBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: MorphInstanceDescriptorBufferDescriptorPlan | null;
    readonly diagnostics: readonly MorphInstanceDescriptorBufferDescriptorDiagnostic[];
}
type MorphInstanceDescriptorGpuBufferDiagnosticCode = "morphInstanceDescriptorGpuBuffer.nullDescriptorPlan" | "morphInstanceDescriptorGpuBuffer.creationFailed";
export interface MorphInstanceDescriptorGpuBufferDiagnostic {
    readonly code: MorphInstanceDescriptorGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface MorphInstanceDescriptorGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly renderId: number;
    readonly instanceCount: number;
}
export interface CreateMorphInstanceDescriptorGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: MorphInstanceDescriptorBufferDescriptorPlan | null;
}
export interface CreateMorphInstanceDescriptorGpuBufferResult {
    readonly valid: boolean;
    readonly resource: MorphInstanceDescriptorGpuBufferResource | null;
    readonly diagnostics: readonly MorphInstanceDescriptorGpuBufferDiagnostic[];
}
export declare function createMorphInstanceDescriptorBufferDescriptor(snapshot: Pick<RenderSnapshot, "morphInstanceDescriptors">, draw: MeshDrawPacket, options?: CreateMorphInstanceDescriptorBufferDescriptorOptions): MorphInstanceDescriptorBufferDescriptorResult;
export declare function createMorphInstanceDescriptorGpuBuffer(options: CreateMorphInstanceDescriptorGpuBufferOptions): CreateMorphInstanceDescriptorGpuBufferResult;
export {};
//# sourceMappingURL=morph-instance-descriptor-buffer.d.ts.map