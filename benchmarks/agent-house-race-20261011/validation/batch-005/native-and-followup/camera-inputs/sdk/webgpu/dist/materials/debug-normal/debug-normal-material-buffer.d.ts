import { type MaterialAsset, type MaterialValidationDiagnostic } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
export declare const DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS = 4;
export declare const DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH: number;
export declare const DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT: readonly ["mode.u32", "padding0.u32", "padding1.u32", "padding2.u32"];
export type DebugNormalMaterialPackingDiagnosticCode = "debugNormalMaterialPack.unsupportedMaterialKind" | MaterialValidationDiagnostic["code"];
export interface DebugNormalMaterialPackingDiagnostic {
    readonly code: DebugNormalMaterialPackingDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly severity: "warning" | "error";
}
export type DebugNormalMaterialResourceDependencies = Record<string, never>;
export interface PackedDebugNormalMaterial {
    readonly uniform: Uint8Array;
    readonly uniformUint32: Uint32Array;
    readonly uniformLayout: typeof DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT;
    readonly dependencies: DebugNormalMaterialResourceDependencies;
}
export interface PackDebugNormalMaterialResult {
    readonly valid: boolean;
    readonly packed: PackedDebugNormalMaterial | null;
    readonly diagnostics: readonly DebugNormalMaterialPackingDiagnostic[];
}
export type DebugNormalMaterialBufferDescriptorDiagnosticCode = "debugNormalMaterialBuffer.nullPackedMaterial" | "debugNormalMaterialBuffer.invalidUniformData" | "debugNormalMaterialBuffer.invalidUsageFlags";
export interface DebugNormalMaterialBufferDescriptorDiagnostic {
    readonly code: DebugNormalMaterialBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface DebugNormalMaterialBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Uint8Array;
    readonly dependencies: DebugNormalMaterialResourceDependencies;
}
export interface DebugNormalMaterialBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: DebugNormalMaterialBufferDescriptorPlan | null;
    readonly diagnostics: readonly DebugNormalMaterialBufferDescriptorDiagnostic[];
}
export interface CreateDebugNormalMaterialBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface DebugNormalMaterialGpuPreparationPlan {
    readonly packed: PackedDebugNormalMaterial;
    readonly materialBuffer: DebugNormalMaterialBufferDescriptorPlan;
    readonly materialBufferResourceKey: string;
}
export interface DebugNormalMaterialGpuPreparationResult {
    readonly valid: boolean;
    readonly plan: DebugNormalMaterialGpuPreparationPlan | null;
    readonly diagnostics: readonly (DebugNormalMaterialPackingDiagnostic | DebugNormalMaterialBufferDescriptorDiagnostic)[];
}
export type CreateDebugNormalMaterialGpuPreparationPlanOptions = CreateDebugNormalMaterialBufferDescriptorOptions;
export declare const DEFAULT_DEBUG_NORMAL_MATERIAL_BUFFER_USAGE: number;
export declare function packDebugNormalMaterial(material: MaterialAsset): PackDebugNormalMaterialResult;
export declare function createDebugNormalMaterialBufferDescriptor(packed: PackedDebugNormalMaterial | null, options?: CreateDebugNormalMaterialBufferDescriptorOptions): DebugNormalMaterialBufferDescriptorResult;
export declare function createDebugNormalMaterialGpuPreparationPlan(material: MaterialAsset, options?: CreateDebugNormalMaterialGpuPreparationPlanOptions): DebugNormalMaterialGpuPreparationResult;
//# sourceMappingURL=debug-normal-material-buffer.d.ts.map