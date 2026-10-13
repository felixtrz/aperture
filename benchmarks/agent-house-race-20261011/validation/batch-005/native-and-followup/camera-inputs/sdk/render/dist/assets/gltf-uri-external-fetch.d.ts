import type { LoadGltfFromUriCache, LoadGltfFromUriFetch } from "./gltf-uri-loader.js";
import type { FetchExternalBuffersResult, FetchExternalImagesResult } from "./gltf-uri-external-fetch-types.js";
export type { FetchExternalBuffersResult, FetchExternalImagesResult, } from "./gltf-uri-external-fetch-types.js";
export declare function fetchExternalBuffers(input: {
    readonly root: Record<string, unknown>;
    readonly sourceUrl: string;
    readonly fetcher: LoadGltfFromUriFetch;
    readonly cache?: LoadGltfFromUriCache;
}): Promise<FetchExternalBuffersResult>;
export declare function fetchExternalImages(input: {
    readonly root: Record<string, unknown>;
    readonly sourceUrl: string;
    readonly fetcher: LoadGltfFromUriFetch;
    readonly cache?: LoadGltfFromUriCache;
    readonly provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined;
}): Promise<FetchExternalImagesResult>;
//# sourceMappingURL=gltf-uri-external-fetch.d.ts.map