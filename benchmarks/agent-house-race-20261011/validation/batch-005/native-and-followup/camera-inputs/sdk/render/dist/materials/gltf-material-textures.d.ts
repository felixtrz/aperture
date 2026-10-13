import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureBindingResolver, GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { MaterialTextureBinding } from "./types.js";
export declare function mapTextureBinding(input: {
    readonly materialKey: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly field: string;
    readonly value: unknown;
    readonly resolver: GltfMaterialTextureBindingResolver | undefined;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureBinding | null;
//# sourceMappingURL=gltf-material-textures.d.ts.map