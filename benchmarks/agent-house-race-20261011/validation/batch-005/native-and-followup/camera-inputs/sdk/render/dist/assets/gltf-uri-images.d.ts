import type { GltfDecodedImageData, GltfImageBytesDecoder } from "../materials/gltf-texture-types.js";
import type { LoadGltfFromUriCache, LoadGltfFromUriDiagnostic, LoadGltfFromUriExternalImageStatus } from "./gltf-uri-loader.js";
import type { Ktx2BasisTranscoder, Ktx2TextureCompressionSupport } from "./ktx2-decoder.js";
export { createMergedImageDataResolver, normalizeConcurrency, } from "./gltf-uri-image-merge.js";
export interface DecodeExternalImagesResult {
    readonly images: ReadonlyMap<number, GltfDecodedImageData>;
    readonly statuses: readonly LoadGltfFromUriExternalImageStatus[];
    readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}
export declare function decodeExternalImages(input: {
    readonly root: Record<string, unknown>;
    readonly sourceUrl: string;
    readonly externalBufferBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly decodeImageData?: GltfImageBytesDecoder;
    readonly basisTranscoder?: Ktx2BasisTranscoder;
    readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
    readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
    readonly imageDecodeConcurrency: number;
    readonly cache?: LoadGltfFromUriCache;
}): Promise<DecodeExternalImagesResult>;
//# sourceMappingURL=gltf-uri-images.d.ts.map