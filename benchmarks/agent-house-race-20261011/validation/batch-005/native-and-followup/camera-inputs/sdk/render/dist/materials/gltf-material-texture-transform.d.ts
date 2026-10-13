import type { GltfMaterialMappingDiagnostic, GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { MaterialTextureTransform } from "./types.js";
export declare function mapTextureTransform(input: {
    readonly materialKey: string;
    readonly slot: GltfMaterialTextureSlot;
    readonly field: string;
    readonly value: Record<string, unknown>;
    readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureTransform | undefined;
//# sourceMappingURL=gltf-material-texture-transform.d.ts.map