import type { GltfDecodedImageData, GltfImageDataResolver } from "../materials/gltf-texture-types.js";
export declare function mapWithConcurrency<TItem, TResult>(items: readonly TItem[], concurrency: number, mapper: (item: TItem) => Promise<TResult>): Promise<TResult[]>;
export declare function normalizeConcurrency(value: number | undefined, fallback: number): number;
export declare function createMergedImageDataResolver(input: {
    readonly decodedImages: ReadonlyMap<number, GltfDecodedImageData>;
    readonly fallback: GltfImageDataResolver | undefined;
}): GltfImageDataResolver;
//# sourceMappingURL=gltf-uri-image-merge.d.ts.map