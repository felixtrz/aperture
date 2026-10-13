import type { GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { GltfTextureMappingDiagnostic } from "./gltf-texture-types.js";
import type { SamplerAsset } from "./types.js";
export declare function mapSamplerIndex(input: {
    readonly texture: Record<string, unknown>;
    readonly textureIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly samplers: readonly unknown[] | undefined;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): number | undefined;
export declare function createMappedSampler(input: {
    readonly samplers: readonly unknown[] | undefined;
    readonly samplerIndex: number | undefined;
    readonly textureIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): SamplerAsset | null;
//# sourceMappingURL=gltf-texture-sampler-mapping.d.ts.map