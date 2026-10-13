import type { LoadGlbFromUriCache, LoadGlbFromUriFetch } from "./glb-uri-loader.js";
import type { FetchExternalBuffersResult, FetchExternalImagesResult } from "./glb-uri-external-fetch-types.js";
export type { FetchExternalBuffersResult, FetchExternalImagesResult, } from "./glb-uri-external-fetch-types.js";
export declare function fetchExternalBuffers(input: {
    readonly root: Record<string, unknown>;
    readonly sourceUrl: string;
    readonly fetcher: LoadGlbFromUriFetch;
    readonly cache?: LoadGlbFromUriCache;
    readonly provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined;
}): Promise<FetchExternalBuffersResult>;
export declare function fetchExternalImages(input: {
    readonly root: Record<string, unknown>;
    readonly sourceUrl: string;
    readonly fetcher: LoadGlbFromUriFetch;
    readonly cache?: LoadGlbFromUriCache;
    readonly provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined;
}): Promise<FetchExternalImagesResult>;
export declare function emptyExternalBuffers(): FetchExternalBuffersResult;
export declare function emptyExternalImages(): FetchExternalImagesResult;
//# sourceMappingURL=glb-uri-external-fetch.d.ts.map