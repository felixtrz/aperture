import type { GltfDecodedImageData } from "../materials/index.js";
import type { Ktx2DecodeOptions, Ktx2FeatureSetLike, Ktx2TextureCompressionFeature, Ktx2TextureCompressionSupport } from "./ktx2-types.js";
export type { Ktx2BasisTranscoder, Ktx2DecodeOptions, Ktx2FeatureSetLike, Ktx2TextureCompressionFeature, Ktx2TextureCompressionSupport, } from "./ktx2-types.js";
export declare function decodeKtx2TextureData(source: ArrayBuffer | ArrayBufferView): GltfDecodedImageData;
export declare function decodeKtx2TextureDataAsync(source: ArrayBuffer | ArrayBufferView, options?: Ktx2DecodeOptions): Promise<GltfDecodedImageData>;
export declare function createKtx2TextureCompressionSupportFromFeatures(features: Ktx2FeatureSetLike | Iterable<Ktx2TextureCompressionFeature | string> | null | undefined): Ktx2TextureCompressionSupport;
//# sourceMappingURL=ktx2-decoder.d.ts.map