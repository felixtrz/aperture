import { type MaterialAsset, type StandardMaterialProofPointDiagnostic } from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";
import { createStandardMaterialBindGroupDescriptorPlan } from "./standard-bind-group.js";
export declare const STANDARD_MATERIAL_UNIFORM_FLOATS = 76;
export declare const STANDARD_MATERIAL_UNIFORM_BYTE_LENGTH: number;
export declare const STANDARD_MATERIAL_UNIFORM_LAYOUT: readonly ["baseColorFactor.r", "baseColorFactor.g", "baseColorFactor.b", "baseColorFactor.a", "emissiveFactor.r", "emissiveFactor.g", "emissiveFactor.b", "metallicFactor", "roughnessFactor", "normalScale", "occlusionStrength", "alphaCutoff", "featureFlags.u32", "baseColorTexCoord.u32", "metallicRoughnessTexCoord.u32", "normalTexCoord.u32", "occlusionTexCoord.u32", "emissiveTexCoord.u32", "baseColorTextureOffset.u", "baseColorTextureOffset.v", "baseColorTextureScale.u", "baseColorTextureScale.v", "baseColorTextureRotation", "padding1", "metallicRoughnessTextureOffset.u", "metallicRoughnessTextureOffset.v", "metallicRoughnessTextureScale.u", "metallicRoughnessTextureScale.v", "metallicRoughnessTextureRotation", "padding2", "normalTextureOffset.u", "normalTextureOffset.v", "normalTextureScale.u", "normalTextureScale.v", "normalTextureRotation", "padding3", "occlusionTextureOffset.u", "occlusionTextureOffset.v", "occlusionTextureScale.u", "occlusionTextureScale.v", "occlusionTextureRotation", "padding4", "emissiveTextureOffset.u", "emissiveTextureOffset.v", "emissiveTextureScale.u", "emissiveTextureScale.v", "emissiveTextureRotation", "padding5", "clearcoatFactor", "clearcoatRoughnessFactor", "transmissionFactor", "clearcoatTexCoord.u32", "sheenColorFactor.r", "sheenColorFactor.g", "sheenColorFactor.b", "sheenRoughnessFactor", "iridescenceFactor", "iridescenceIor", "iridescenceThicknessMinimum", "iridescenceThicknessMaximum", "transmissionTexCoord.u32", "sheenColorTexCoord.u32", "iridescenceTexCoord.u32", "sheenRoughnessTexCoord.u32", "iridescenceThicknessTexCoord.u32", "clearcoatRoughnessTexCoord.u32", "padding7.u32", "padding8.u32", "transmissionIor", "transmissionThickness", "transmissionAttenuationDistance", "padding9", "attenuationColor.r", "attenuationColor.g", "attenuationColor.b", "padding10"];
export declare const STANDARD_MATERIAL_FEATURE_FLAGS: {
    readonly BASE_COLOR_TEXTURE: number;
    readonly METALLIC_ROUGHNESS_TEXTURE: number;
    readonly NORMAL_TEXTURE: number;
    readonly OCCLUSION_TEXTURE: number;
    readonly EMISSIVE_TEXTURE: number;
    readonly ALPHA_MASK: number;
    readonly ALPHA_BLEND: number;
    readonly DOUBLE_SIDED: number;
    readonly CLEARCOAT_TEXTURE: number;
    readonly TRANSMISSION_TEXTURE: number;
    readonly SHEEN_COLOR_TEXTURE: number;
    readonly IRIDESCENCE_TEXTURE: number;
    readonly SHEEN_ROUGHNESS_TEXTURE: number;
    readonly IRIDESCENCE_THICKNESS_TEXTURE: number;
    readonly CLEARCOAT_ROUGHNESS_TEXTURE: number;
};
export type StandardMaterialFeatureFlag = (typeof STANDARD_MATERIAL_FEATURE_FLAGS)[keyof typeof STANDARD_MATERIAL_FEATURE_FLAGS];
export type StandardMaterialPackingDiagnosticCode = "standardMaterialPack.unsupportedMaterialKind" | "standardMaterialPack.missingTextureHandle" | "standardMaterialPack.missingSamplerHandle" | StandardMaterialProofPointDiagnostic["code"];
export interface StandardMaterialPackingDiagnostic {
    readonly code: StandardMaterialPackingDiagnosticCode;
    readonly message: string;
    readonly field?: string;
    readonly severity: "warning" | "error";
}
export interface StandardMaterialTextureDependency {
    readonly textureKey: string | null;
    readonly samplerKey: string | null;
    readonly texCoord: number;
}
export interface StandardMaterialResourceDependencies {
    readonly baseColor: StandardMaterialTextureDependency;
    readonly metallicRoughness: StandardMaterialTextureDependency;
    readonly normal: StandardMaterialTextureDependency;
    readonly occlusion: StandardMaterialTextureDependency;
    readonly emissive: StandardMaterialTextureDependency;
    readonly clearcoat: StandardMaterialTextureDependency;
    readonly clearcoatRoughness: StandardMaterialTextureDependency;
    readonly transmission: StandardMaterialTextureDependency;
    readonly sheenColor: StandardMaterialTextureDependency;
    readonly sheenRoughness: StandardMaterialTextureDependency;
    readonly iridescence: StandardMaterialTextureDependency;
    readonly iridescenceThickness: StandardMaterialTextureDependency;
}
export interface PackedStandardMaterial {
    readonly uniform: Uint8Array;
    readonly uniformFloat32: Float32Array;
    readonly uniformUint32: Uint32Array;
    readonly uniformLayout: typeof STANDARD_MATERIAL_UNIFORM_LAYOUT;
    readonly featureFlags: number;
    readonly dependencies: StandardMaterialResourceDependencies;
}
export interface PackStandardMaterialResult {
    readonly valid: boolean;
    readonly packed: PackedStandardMaterial | null;
    readonly diagnostics: readonly StandardMaterialPackingDiagnostic[];
}
export type StandardMaterialBufferDescriptorDiagnosticCode = "standardMaterialBuffer.nullPackedMaterial" | "standardMaterialBuffer.invalidUniformData" | "standardMaterialBuffer.invalidUsageFlags";
export interface StandardMaterialBufferDescriptorDiagnostic {
    readonly code: StandardMaterialBufferDescriptorDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface StandardMaterialBufferDescriptorPlan {
    readonly descriptor: WebGpuBufferDescriptor;
    readonly source: Uint8Array;
    readonly dependencies: StandardMaterialResourceDependencies;
    readonly featureFlags: number;
}
export interface StandardMaterialBufferDescriptorResult {
    readonly valid: boolean;
    readonly plan: StandardMaterialBufferDescriptorPlan | null;
    readonly diagnostics: readonly StandardMaterialBufferDescriptorDiagnostic[];
}
export interface CreateStandardMaterialBufferDescriptorOptions {
    readonly label?: string;
    readonly usage?: number;
}
export interface StandardMaterialPreparationPlan {
    readonly packed: PackedStandardMaterial;
    readonly materialBuffer: StandardMaterialBufferDescriptorPlan;
    readonly materialBufferResourceKey: string;
    readonly materialBindGroup: ReturnType<typeof createStandardMaterialBindGroupDescriptorPlan>;
}
export interface StandardMaterialPreparationResult {
    readonly valid: boolean;
    readonly plan: StandardMaterialPreparationPlan | null;
    readonly diagnostics: readonly (StandardMaterialPackingDiagnostic | StandardMaterialBufferDescriptorDiagnostic)[];
}
export type CreateStandardMaterialPreparationPlanOptions = CreateStandardMaterialBufferDescriptorOptions;
export declare const DEFAULT_STANDARD_MATERIAL_BUFFER_USAGE: number;
export declare function packStandardMaterial(material: MaterialAsset): PackStandardMaterialResult;
export declare function createStandardMaterialBufferDescriptor(packed: PackedStandardMaterial | null, options?: CreateStandardMaterialBufferDescriptorOptions): StandardMaterialBufferDescriptorResult;
export declare function createStandardMaterialPreparationPlan(material: MaterialAsset, options?: CreateStandardMaterialPreparationPlanOptions): StandardMaterialPreparationResult;
//# sourceMappingURL=standard-material-buffer.d.ts.map