import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
export declare const DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE: number;
export type MorphTargetWeightBufferDescriptorDiagnosticCode = "morphTargetWeightBuffer.notMorphed" | "morphTargetWeightBuffer.missingData" | "morphTargetWeightBuffer.invalidUsageFlags";
export interface MorphTargetWeightBufferDescriptorDiagnostic {
    readonly code: MorphTargetWeightBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly field?: string;
}
export interface MorphTargetWeightBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly renderId: number;
    readonly weightCount: number;
}
export interface CreateMorphTargetWeightBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface MorphTargetWeightBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: MorphTargetWeightBufferDescriptorPlan | null;
    readonly diagnostics: readonly MorphTargetWeightBufferDescriptorDiagnostic[];
}
export type MorphTargetWeightGpuBufferDiagnosticCode = "morphTargetWeightGpuBuffer.nullDescriptorPlan" | "morphTargetWeightGpuBuffer.creationFailed";
export interface MorphTargetWeightGpuBufferDiagnostic {
    readonly code: MorphTargetWeightGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface MorphTargetWeightGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly renderId: number;
    readonly weightCount: number;
}
export interface CreateMorphTargetWeightGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: MorphTargetWeightBufferDescriptorPlan | null;
}
export interface CreateMorphTargetWeightGpuBufferResult {
    readonly valid: boolean;
    readonly resource: MorphTargetWeightGpuBufferResource | null;
    readonly diagnostics: readonly MorphTargetWeightGpuBufferDiagnostic[];
}
export declare function morphTargetWeightBufferResourceKeyForRenderId(renderId: number): string;
export declare function createMorphTargetWeightBufferDescriptor(snapshot: Pick<RenderSnapshot, "morphTargetWeights">, draw: MeshDrawPacket, options?: CreateMorphTargetWeightBufferDescriptorOptions): MorphTargetWeightBufferDescriptorResult;
export declare function createMorphTargetWeightGpuBuffer(options: CreateMorphTargetWeightGpuBufferOptions): CreateMorphTargetWeightGpuBufferResult;
//# sourceMappingURL=morph-target-weight-buffer.d.ts.map