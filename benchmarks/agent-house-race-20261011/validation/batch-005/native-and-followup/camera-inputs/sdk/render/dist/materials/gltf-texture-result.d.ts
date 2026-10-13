import type { GltfDecodedImageData, GltfTextureMappingDiagnostic, GltfTextureMappingOptions, GltfTextureMappingReport, PreparedGltfTextureMapping } from "./gltf-texture-types.js";
import type { SamplerAsset, TextureAsset } from "./types.js";
export declare function preparedReport(report: GltfTextureMappingReport): PreparedGltfTextureMapping;
export declare function createTextureMappingReportFromDecoded(input: Extract<PreparedGltfTextureMapping, {
    readonly kind: "image";
}> & {
    readonly decoded: GltfDecodedImageData | null;
}): GltfTextureMappingReport;
export declare function createGltfTextureMappingReport(input: {
    readonly options: GltfTextureMappingOptions;
    readonly diagnostics: readonly GltfTextureMappingDiagnostic[];
    readonly texture: TextureAsset | null;
    readonly sampler: SamplerAsset | null;
    readonly imageIndex?: number | undefined;
    readonly samplerIndex?: number | undefined;
}): GltfTextureMappingReport;
//# sourceMappingURL=gltf-texture-result.d.ts.map