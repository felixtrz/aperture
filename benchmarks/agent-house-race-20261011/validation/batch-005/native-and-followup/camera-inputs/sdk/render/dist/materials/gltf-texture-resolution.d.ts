import type { GltfDecodedImageData, GltfImageSourceRef, GltfTextureMappingDiagnostic, GltfTextureMappingOptions } from "./gltf-texture-types.js";
export declare function resolveDecodedImage(input: {
    readonly options: GltfTextureMappingOptions;
    readonly image: Record<string, unknown>;
    readonly imageIndex: number;
    readonly source: GltfImageSourceRef;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfDecodedImageData | null;
export declare function resolveDecodedImageAsync(input: {
    readonly options: GltfTextureMappingOptions;
    readonly image: Record<string, unknown>;
    readonly imageIndex: number;
    readonly source: GltfImageSourceRef;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
}): Promise<GltfDecodedImageData | null>;
//# sourceMappingURL=gltf-texture-resolution.d.ts.map