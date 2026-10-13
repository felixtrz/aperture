import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
export type BuiltInShaderBindingResource = "uniform-buffer" | "read-only-storage-buffer" | "texture" | "sampler";
export type BuiltInShaderBindingId = "viewProjection" | "worldTransforms" | "previousWorldTransforms" | "unlitMaterial" | "matcapMaterial" | "standardMaterial" | "debugNormalMaterial" | "lightFloats" | "lightMetadata" | "localLightClusterParams" | "localLightClusterCells" | "localLightClusterIndices" | "localLightClusterMetadata" | "localLightClusterCookieTexture" | "localLightClusterCookieSampler" | "localLightClusterCookieMatrices" | "baseColorTexture" | "baseColorSampler" | "metallicRoughnessTexture" | "metallicRoughnessSampler" | "clearcoatTexture" | "clearcoatSampler" | "clearcoatRoughnessTexture" | "clearcoatRoughnessSampler" | "transmissionTexture" | "transmissionSampler" | "sheenColorTexture" | "sheenColorSampler" | "sheenRoughnessTexture" | "sheenRoughnessSampler" | "iridescenceTexture" | "iridescenceSampler" | "iridescenceThicknessTexture" | "iridescenceThicknessSampler" | "normalTexture" | "normalSampler" | "occlusionTexture" | "occlusionSampler" | "emissiveTexture" | "emissiveSampler" | "directionalShadowMatrices" | "directionalShadowMap" | "directionalShadowSampler" | "standardDiffuseIblTexture" | "standardSpecularIblTexture" | "standardIblSampler" | "standardAreaLightLtcMatrixTexture" | "standardAreaLightLtcFresnelTexture" | "standardAreaLightLtcSampler" | "standardTransmissionSceneColorTexture" | "standardTransmissionSceneColorSampler" | "skinJointMatrices" | "standardMorphTargetWeights" | "standardMorphTargetDeltas" | "standardMorphInstanceDescriptors" | "matcapTexture" | "matcapSampler";
export interface BuiltInShaderBindingMetadata {
    readonly id: BuiltInShaderBindingId;
    readonly label: string;
    readonly group: number;
    readonly binding: number;
    readonly resource: BuiltInShaderBindingResource;
}
export interface BuiltInShaderEntryPoints {
    readonly vertex: string;
    readonly fragment: string;
}
export interface BuiltInShaderSourceModule {
    readonly label: string;
    readonly code: string;
    readonly entryPoints: BuiltInShaderEntryPoints;
    readonly bindings: readonly BuiltInShaderBindingMetadata[];
}
export type BuiltInShaderMetadataDiagnosticCode = "shaderMetadata.missingLabel" | "shaderMetadata.missingCode" | "shaderMetadata.missingEntryPoint" | "shaderMetadata.missingBinding";
export interface BuiltInShaderMetadataDiagnostic {
    readonly code: BuiltInShaderMetadataDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface BuiltInShaderMetadataValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly BuiltInShaderMetadataDiagnostic[];
}
export declare const UNLIT_MESH_WGSL: string;
export declare const UNLIT_TEXTURED_MESH_WGSL: string;
export declare const UNLIT_VERTEX_COLOR_MESH_WGSL: string;
export declare const UNLIT_TEXTURED_VERTEX_COLOR_MESH_WGSL: string;
export declare const UNLIT_MESH_SHADER: BuiltInShaderSourceModule;
export declare const UNLIT_VERTEX_COLOR_MESH_SHADER: BuiltInShaderSourceModule;
export declare const UNLIT_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule;
export declare const UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER: BuiltInShaderSourceModule;
export declare const UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER: BuiltInShaderSourceModule;
export declare function createUnlitMeshShaderModuleDescriptor(shader?: BuiltInShaderSourceModule): WebGpuShaderModuleDescriptor;
export declare function validateBuiltInShaderMetadata(shader: BuiltInShaderSourceModule): BuiltInShaderMetadataValidationReport;
//# sourceMappingURL=unlit-shader.d.ts.map