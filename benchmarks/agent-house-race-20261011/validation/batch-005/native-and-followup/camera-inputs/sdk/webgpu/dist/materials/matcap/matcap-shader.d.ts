import type { WebGpuShaderModuleDescriptor } from "../../gpu/shader.js";
import type { BuiltInShaderMetadataValidationReport, BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
export declare const MATCAP_MATERIAL_SHADER_VARIANT = "matcap-texture";
export declare const MATCAP_MESH_WGSL: string;
export declare const MATCAP_MESH_SHADER: BuiltInShaderSourceModule;
export declare function createMatcapMeshShaderModuleDescriptor(shader?: BuiltInShaderSourceModule): WebGpuShaderModuleDescriptor;
export declare function validateMatcapShaderMetadata(shader: BuiltInShaderSourceModule): BuiltInShaderMetadataValidationReport;
//# sourceMappingURL=matcap-shader.d.ts.map