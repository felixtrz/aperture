import type { GltfDecodedImageData, GltfImageDataResolver } from "../materials/gltf-texture-types.js";
import type { DecodeExternalImagesResult } from "./glb-uri-images.js";
export declare function mergeDecodedImageData(provided: ReadonlyMap<number, GltfDecodedImageData> | undefined, decoded: ReadonlyMap<number, GltfDecodedImageData>): ReadonlyMap<number, GltfDecodedImageData>;
export declare function createMergedImageDataResolver(input: {
    readonly decodedImages: ReadonlyMap<number, GltfDecodedImageData>;
    readonly fallback: GltfImageDataResolver | undefined;
}): GltfImageDataResolver;
export declare function emptyDecodedImages(): DecodeExternalImagesResult;
export declare function mapWithConcurrency<TItem, TResult>(items: readonly TItem[], concurrency: number, mapper: (item: TItem) => Promise<TResult>): Promise<TResult[]>;
export declare function normalizeConcurrency(value: number | undefined, fallback: number): number;
//# sourceMappingURL=glb-uri-image-merge.d.ts.map