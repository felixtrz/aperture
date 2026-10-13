import { type StandardTextureShaderFeatures } from "./standard-shader-features.js";
import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import type { BuiltInShaderMetadataValidationReport, BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export { STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT, STANDARD_BASE_COLOR_TEXTURE_SHADER_VARIANT, STANDARD_CASCADED_SHADOW_MAP_SHADER_VARIANT, STANDARD_CLEARCOAT_SHADER_VARIANT, STANDARD_DIFFUSE_IBL_SHADER_VARIANT, STANDARD_DIRECT_LIGHT_SHADER_VARIANT, STANDARD_IRIDESCENCE_SHADER_VARIANT, STANDARD_MATERIAL_MVP_LIGHTING_MODEL, STANDARD_METALLIC_ROUGHNESS_TEXTURE_SHADER_VARIANT, STANDARD_MULTI_SHADOW_MAP_SHADER_VARIANT, STANDARD_POINT_SHADOW_MAP_SHADER_VARIANT, STANDARD_SHADOW_MAP_SHADER_VARIANT, STANDARD_SHEEN_SHADER_VARIANT, STANDARD_SPECULAR_IBL_PROOF_SHADER_VARIANT, STANDARD_TRANSMISSION_SHADER_VARIANT, createStandardTextureShaderVariantKey, type StandardTextureShaderFeatures, } from "./standard-shader-features.js";
export { STANDARD_MESH_WGSL } from "./standard-shader-source.js";
export declare const STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL: string;
export declare const STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL: string;
export declare const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_WGSL: string;
export declare const STANDARD_SHADOW_RECEIVER_MESH_WGSL: string;
export declare const STANDARD_CASCADED_SHADOW_RECEIVER_MESH_WGSL: string;
export declare const STANDARD_MESH_SHADER: BuiltInShaderSourceModule;
export declare const STANDARD_BASE_COLOR_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule;
export declare const STANDARD_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule;
export declare const STANDARD_BASE_COLOR_METALLIC_ROUGHNESS_TEXTURED_MESH_SHADER: BuiltInShaderSourceModule;
export declare const STANDARD_SHADOW_RECEIVER_MESH_SHADER: BuiltInShaderSourceModule;
export declare function createStandardMeshShaderModuleDescriptor(shader?: BuiltInShaderSourceModule): WebGpuShaderModuleDescriptor;
export declare function validateStandardShaderMetadata(shader: BuiltInShaderSourceModule): BuiltInShaderMetadataValidationReport;
export declare function createStandardTextureVariantShader(features: StandardTextureShaderFeatures): BuiltInShaderSourceModule;
//# sourceMappingURL=standard-shader.d.ts.map