import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
type MorphTargetDeltaBufferDescriptorDiagnosticCode = "morphTargetDeltaBuffer.notMorphed" | "morphTargetDeltaBuffer.missingData" | "morphTargetDeltaBuffer.invalidUsageFlags";
export interface MorphTargetDeltaBufferDescriptorDiagnostic {
    readonly code: MorphTargetDeltaBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly field?: string;
}
interface MorphTargetDeltaBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly renderId: number;
    readonly floatCount: number;
}
export interface CreateMorphTargetDeltaBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface MorphTargetDeltaBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: MorphTargetDeltaBufferDescriptorPlan | null;
    readonly diagnostics: readonly MorphTargetDeltaBufferDescriptorDiagnostic[];
}
type MorphTargetDeltaGpuBufferDiagnosticCode = "morphTargetDeltaGpuBuffer.nullDescriptorPlan" | "morphTargetDeltaGpuBuffer.creationFailed";
export interface MorphTargetDeltaGpuBufferDiagnostic {
    readonly code: MorphTargetDeltaGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface MorphTargetDeltaGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly renderId: number;
    readonly floatCount: number;
}
export interface CreateMorphTargetDeltaGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: MorphTargetDeltaBufferDescriptorPlan | null;
}
export interface CreateMorphTargetDeltaGpuBufferResult {
    readonly valid: boolean;
    readonly resource: MorphTargetDeltaGpuBufferResource | null;
    readonly diagnostics: readonly MorphTargetDeltaGpuBufferDiagnostic[];
}
export declare function createMorphTargetDeltaBufferDescriptor(snapshot: Pick<RenderSnapshot, "morphTargetDeltas">, draw: MeshDrawPacket, options?: CreateMorphTargetDeltaBufferDescriptorOptions): MorphTargetDeltaBufferDescriptorResult;
export declare function createMorphTargetDeltaGpuBuffer(options: CreateMorphTargetDeltaGpuBufferOptions): CreateMorphTargetDeltaGpuBufferResult;
export {};
//# sourceMappingURL=morph-target-delta-buffer.d.ts.map