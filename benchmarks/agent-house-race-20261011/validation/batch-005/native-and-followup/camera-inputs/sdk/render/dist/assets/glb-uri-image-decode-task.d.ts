import type { GltfDecodedImageData, GltfImageBytesDecoder } from "../materials/gltf-texture-types.js";
import type { LoadGlbFromUriDiagnostic, LoadGlbFromUriExternalImageStatus } from "./glb-uri-loader.js";
import type { Ktx2BasisTranscoder, Ktx2TextureCompressionSupport } from "./ktx2-decoder.js";
export interface GlbExternalImageDecodeTaskResult {
    readonly decoded?: {
        readonly imageIndex: number;
        readonly image: GltfDecodedImageData;
    };
    readonly statuses: readonly LoadGlbFromUriExternalImageStatus[];
    readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}
export declare function decodeGlbExternalImage(input: {
    readonly image: unknown;
    readonly imageIndex: number;
    readonly root: Record<string, unknown>;
    readonly binary: Uint8Array | null;
    readonly sourceUrl: URL;
    readonly externalBufferBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly externalImageBytes: ReadonlyMap<number, ArrayBuffer | ArrayBufferView>;
    readonly decodeImageData?: GltfImageBytesDecoder;
    readonly basisTranscoder?: Ktx2BasisTranscoder;
    readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
    readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
    readonly decodeCache: Map<string, Promise<GltfDecodedImageData>>;
    readonly byteObjectId: (bytes: ArrayBuffer | ArrayBufferView) => number;
    readonly getCreatedBasisTranscoder: () => Promise<Ktx2BasisTranscoder> | null;
    readonly setCreatedBasisTranscoder: (promise: Promise<Ktx2BasisTranscoder>) => void;
}): Promise<GlbExternalImageDecodeTaskResult | null>;
//# sourceMappingURL=glb-uri-image-decode-task.d.ts.map