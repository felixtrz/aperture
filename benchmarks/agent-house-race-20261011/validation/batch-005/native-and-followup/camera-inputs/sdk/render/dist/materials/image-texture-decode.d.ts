import type { GltfDecodedImageData, GltfImageBytesFetcher } from "./gltf-texture-types.js";
export interface DecodeImageUrlToTextureSourceOptions {
    readonly fetchImageBytes?: GltfImageBytesFetcher;
    readonly mimeType?: string;
}
export type DecodedImageTextureSource = GltfDecodedImageData;
export declare function decodeImageUrlToTextureSource(url: string, options?: DecodeImageUrlToTextureSourceOptions): Promise<DecodedImageTextureSource>;
//# sourceMappingURL=image-texture-decode.d.ts.map