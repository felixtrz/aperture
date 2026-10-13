import { type MaterialAsset, type MaterialValidationDiagnostic } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
export declare const MATCAP_MATERIAL_UNIFORM_FLOATS = 4;
export declare const MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH: number;
export declare const MATCAP_MATERIAL_UNIFORM_LAYOUT: readonly ["baseColorFactor.r", "baseColorFactor.g", "baseColorFactor.b", "baseColorFactor.a"];
export type MatcapMaterialPackingDiagnosticCode = "matcapMaterialPack.unsupportedMaterialKind" | "matcapMaterialPack.missingTextureHandle" | "matcapMaterialPack.missingSamplerHandle" | MaterialValidationDiagnostic["code"];
export interface MatcapMaterialPackingDiagnostic {
    readonly code: MatcapMaterialPackingDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly severity: "warning" | "error";
}
export interface MatcapMaterialTextureDependency {
    readonly textureKey: string;
    readonly samplerKey: string;
}
export interface MatcapMaterialResourceDependencies {
    readonly matcapTexture: MatcapMaterialTextureDependency;
}
export interface PackedMatcapMaterial {
    readonly uniform: Float32Array;
    readonly uniformLayout: typeof MATCAP_MATERIAL_UNIFORM_LAYOUT;
    readonly dependencies: MatcapMaterialResourceDependencies;
}
export interface PackMatcapMaterialResult {
    readonly valid: boolean;
    readonly packed: PackedMatcapMaterial | null;
    readonly diagnostics: readonly MatcapMaterialPackingDiagnostic[];
}
export type MatcapMaterialBufferDescriptorDiagnosticCode = "matcapMaterialBuffer.nullPackedMaterial" | "matcapMaterialBuffer.invalidUniformData" | "matcapMaterialBuffer.invalidUsageFlags";
export interface MatcapMaterialBufferDescriptorDiagnostic {
    readonly code: MatcapMaterialBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface MatcapMaterialBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Float32Array;
    readonly dependencies: MatcapMaterialResourceDependencies;
}
export interface MatcapMaterialBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: MatcapMaterialBufferDescriptorPlan | null;
    readonly diagnostics: readonly MatcapMaterialBufferDescriptorDiagnostic[];
}
export interface CreateMatcapMaterialBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface MatcapMaterialGpuPreparationPlan {
    readonly packed: PackedMatcapMaterial;
    readonly materialBuffer: MatcapMaterialBufferDescriptorPlan;
    readonly materialBufferResourceKey: string;
}
export interface MatcapMaterialGpuPreparationResult {
    readonly valid: boolean;
    readonly plan: MatcapMaterialGpuPreparationPlan | null;
    readonly diagnostics: readonly (MatcapMaterialPackingDiagnostic | MatcapMaterialBufferDescriptorDiagnostic)[];
}
export type CreateMatcapMaterialGpuPreparationPlanOptions = CreateMatcapMaterialBufferDescriptorOptions;
export declare const DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE: number;
export declare function packMatcapMaterial(material: MaterialAsset): PackMatcapMaterialResult;
export declare function createMatcapMaterialBufferDescriptor(packed: PackedMatcapMaterial | null, options?: CreateMatcapMaterialBufferDescriptorOptions): MatcapMaterialBufferDescriptorResult;
export declare function createMatcapMaterialGpuPreparationPlan(material: MaterialAsset, options?: CreateMatcapMaterialGpuPreparationPlanOptions): MatcapMaterialGpuPreparationResult;
//# sourceMappingURL=matcap-material-buffer.d.ts.map