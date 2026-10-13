import type { GltfValidatedAccessorReference } from "./gltf-accessor-validation.js";
import type { DecodeShape, GltfAccessorDecodingOptions, GltfDecodedAccessor, GltfDecodedArray } from "./gltf-accessor-decoding-types.js";
export declare function sourceBytesView(source: ArrayBuffer | ArrayBufferView | null | undefined): Uint8Array | null;
export declare function createDirectSourceBinding(input: {
    readonly accessor: GltfValidatedAccessorReference;
    readonly elementByteSize: number;
    readonly shape: DecodeShape;
    readonly sourceBytes: Uint8Array;
    readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): Pick<GltfDecodedAccessor, "sourceBufferViewIndex" | "sourceView" | "sourceViewByteOffset" | "sourceByteStride" | "sourceElementByteSize"> | null;
export declare function decodeTightlyPackedAccessor(input: {
    readonly accessor: GltfValidatedAccessorReference;
    readonly elementByteSize: number;
    readonly shape: DecodeShape;
    readonly sourceBytes: Uint8Array;
    readonly storageMode: NonNullable<GltfAccessorDecodingOptions["storageMode"]>;
}): GltfDecodedArray | null;
export declare function decodeStridedAccessor(sourceBytes: Uint8Array, accessor: GltfValidatedAccessorReference, shape: DecodeShape): GltfDecodedArray;
//# sourceMappingURL=gltf-accessor-decoding-source.d.ts.map