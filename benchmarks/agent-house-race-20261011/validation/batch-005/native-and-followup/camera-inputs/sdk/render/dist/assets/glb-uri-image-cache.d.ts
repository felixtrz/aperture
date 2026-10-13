import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type { Ktx2BasisTranscoder, Ktx2TextureCompressionSupport } from "./ktx2-decoder.js";
export declare function imageDecodeCacheKey(input: {
    readonly source: GltfImageSourceRef;
    readonly sourceUrl: URL;
    readonly bytes: ArrayBuffer | ArrayBufferView | undefined;
    readonly byteObjectId: (bytes: ArrayBuffer | ArrayBufferView) => number;
    readonly decodeOptionsKey?: string;
}): string;
export declare function imageDecodeOptionsKeyField(input: {
    readonly source: GltfImageSourceRef;
    readonly textureCompression?: Ktx2TextureCompressionSupport;
}): {
    readonly decodeOptionsKey?: string;
};
export declare function resolveBasisKtx2Transcoder(input: {
    readonly source: GltfImageSourceRef;
    readonly provided: Ktx2BasisTranscoder | undefined;
    readonly create: (() => PromiseLike<Ktx2BasisTranscoder>) | undefined;
    readonly getCreated: () => Promise<Ktx2BasisTranscoder> | null;
    readonly setCreated: (promise: Promise<Ktx2BasisTranscoder>) => void;
}): Promise<Ktx2BasisTranscoder | undefined>;
//# sourceMappingURL=glb-uri-image-cache.d.ts.map