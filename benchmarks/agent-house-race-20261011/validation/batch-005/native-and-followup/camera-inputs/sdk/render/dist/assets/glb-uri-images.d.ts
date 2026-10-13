import type { GltfDecodedImageData, GltfImageBytesDecoder } from "../materials/gltf-texture-types.js";
import type { LoadGlbFromUriCache, LoadGlbFromUriDiagnostic, LoadGlbFromUriExternalImageStatus } from "./glb-uri-loader.js";
import type { Ktx2BasisTranscoder, Ktx2TextureCompressionSupport } from "./ktx2-decoder.js";
export { createMergedImageDataResolver, emptyDecodedImages, mergeDecodedImageData, normalizeConcurrency, } from "./glb-uri-image-merge.js";
export interface DecodeExternalImagesResult {
    readonly images: ReadonlyMap<number, GltfDecodedImageData>;
    readonly statuses: readonly LoadGlbFromUriExternalImageStatus[];
    readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}
export declare function decodeExternalImages(input: {
    readonly root: Record<string, unknown>;
    readonly binary: Uint8Array | null;
    readonly sourceUrl: string;
    readonly externalBufferBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly decodeImageData?: GltfImageBytesDecoder;
    readonly basisTranscoder?: Ktx2BasisTranscoder;
    readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
    readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
    readonly imageDecodeConcurrency: number;
    readonly cache?: LoadGlbFromUriCache;
}): Promise<DecodeExternalImagesResult>;
//# sourceMappingURL=glb-uri-images.d.ts.map