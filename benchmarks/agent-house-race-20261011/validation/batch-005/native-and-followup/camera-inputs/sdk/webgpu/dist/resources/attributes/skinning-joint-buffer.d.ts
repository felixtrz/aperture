import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuBufferDescriptor, type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
export declare const SKINNING_JOINT_MATRIX_FLOATS = 16;
export declare const DEFAULT_SKINNING_JOINT_BUFFER_USAGE: number;
export type SkinningJointBufferDescriptorDiagnosticCode = "skinningJointBuffer.notSkinned" | "skinningJointBuffer.missingOffset" | "skinningJointBuffer.missingCount" | "skinningJointBuffer.missingData" | "skinningJointBuffer.invalidUsageFlags";
export interface SkinningJointBufferDescriptorDiagnostic {
    readonly code: SkinningJointBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly renderId: number;
    readonly field?: string;
}
export interface SkinningJointBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly renderId: number;
    readonly sourceOffset: number;
    readonly jointCount: number;
}
export interface CreateSkinningJointBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface SkinningJointBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: SkinningJointBufferDescriptorPlan | null;
    readonly diagnostics: readonly SkinningJointBufferDescriptorDiagnostic[];
}
export type SkinningJointGpuBufferDiagnosticCode = "skinningJointGpuBuffer.nullDescriptorPlan" | "skinningJointGpuBuffer.creationFailed";
export interface SkinningJointGpuBufferDiagnostic {
    readonly code: SkinningJointGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface SkinningJointGpuBufferResource {
    readonly resourceKey: string;
    readonly buffer: unknown;
    readonly renderId: number;
    readonly jointCount: number;
    readonly sourceOffset: number;
}
export interface CreateSkinningJointGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: SkinningJointBufferDescriptorPlan | null;
}
export interface CreateSkinningJointGpuBufferResult {
    readonly valid: boolean;
    readonly resource: SkinningJointGpuBufferResource | null;
    readonly diagnostics: readonly SkinningJointGpuBufferDiagnostic[];
}
export declare function skinningJointBufferResourceKeyForRenderId(renderId: number): string;
export declare function createSkinningJointBufferDescriptor(snapshot: Pick<RenderSnapshot, "bones">, draw: MeshDrawPacket, options?: CreateSkinningJointBufferDescriptorOptions): SkinningJointBufferDescriptorResult;
export declare function createSkinningJointGpuBuffer(options: CreateSkinningJointGpuBufferOptions): CreateSkinningJointGpuBufferResult;
//# sourceMappingURL=skinning-joint-buffer.d.ts.map