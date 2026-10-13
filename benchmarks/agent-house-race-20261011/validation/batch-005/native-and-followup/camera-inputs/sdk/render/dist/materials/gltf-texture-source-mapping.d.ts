import type { GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { GltfImageSourceRef, GltfTextureMappingDiagnostic } from "./gltf-texture-types.js";
export declare function mapImageIndex(input: {
    readonly texture: Record<string, unknown>;
    readonly textureIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): number | null;
export declare function inspectTextureExtensions(input: {
    readonly texture: Record<string, unknown>;
    readonly textureIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly required: readonly string[];
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): void;
export declare function mapImageSource(input: {
    readonly image: Record<string, unknown>;
    readonly textureIndex: number;
    readonly imageIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfImageSourceRef | null;
//# sourceMappingURL=gltf-texture-source-mapping.d.ts.map