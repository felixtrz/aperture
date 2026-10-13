import type { GltfValidatedAccessorReference } from "./gltf-accessor-validation.js";
import type { DecodeShape, GltfDecodedArray } from "./gltf-accessor-decoding-types.js";
export declare const NATIVE_LITTLE_ENDIAN: boolean;
export declare function decodeShape(accessor: GltfValidatedAccessorReference): DecodeShape | null;
export declare function createOutputArray(shape: DecodeShape, length: number): GltfDecodedArray;
export declare function createOutputArrayView(shape: DecodeShape, buffer: ArrayBufferLike, byteOffset: number, length: number): GltfDecodedArray;
export declare function outputComponentBytes(shape: DecodeShape): 1 | 2 | 4;
export declare function readComponent(view: DataView, byteOffset: number, shape: DecodeShape): number;
export declare function arrayTypeForExpectedFormat(expectedFormat: GltfValidatedAccessorReference["expectedFormat"]): string;
//# sourceMappingURL=gltf-accessor-decoding-shape.d.ts.map