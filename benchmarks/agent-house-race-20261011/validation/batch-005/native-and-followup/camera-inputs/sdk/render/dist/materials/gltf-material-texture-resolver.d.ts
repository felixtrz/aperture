import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureBindingResolverResult, GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { MaterialTextureBinding } from "./types.js";
export declare function resolveTextureBindingResult(input: {
    readonly materialKey: string;
    readonly field: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly textureIndex: number;
    readonly resolved: GltfMaterialTextureBindingResolverResult;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureBinding | null;
//# sourceMappingURL=gltf-material-texture-resolver.d.ts.map