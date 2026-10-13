import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import type { BuiltInShaderMetadataValidationReport, BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export declare const DEBUG_NORMAL_SHADER_VARIANT = "world-normal-rgb";
export declare const DEBUG_NORMAL_MESH_WGSL: string;
export declare const DEBUG_NORMAL_MESH_SHADER: BuiltInShaderSourceModule;
export declare function createDebugNormalMeshShaderModuleDescriptor(shader?: BuiltInShaderSourceModule): WebGpuShaderModuleDescriptor;
export declare function validateDebugNormalShaderMetadata(shader: BuiltInShaderSourceModule): BuiltInShaderMetadataValidationReport;
//# sourceMappingURL=debug-normal-shader.d.ts.map