import type { Ktx2FeatureSetLike, Ktx2TextureCompressionFeature } from "./ktx2-types.js";
export declare function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer;
export declare function bytesView(source: ArrayBuffer | ArrayBufferView): Uint8Array;
export declare function featureSetHas(features: Ktx2FeatureSetLike | Iterable<Ktx2TextureCompressionFeature | string> | null | undefined, feature: Ktx2TextureCompressionFeature): boolean;
export declare function readUint64(view: DataView, byteOffset: number): number;
//# sourceMappingURL=ktx2-utils.d.ts.map