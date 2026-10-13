import type { ResolveBufferUrlResult, ResolveImageUrlResult } from "./gltf-uri-external-fetch-types.js";
export declare function resolveSameOriginBufferUrl(input: {
    readonly sourceUrl: URL;
    readonly uri: string;
    readonly bufferIndex: number;
}): ResolveBufferUrlResult;
export declare function resolveSameOriginImageUrl(input: {
    readonly sourceUrl: URL;
    readonly image: Record<string, unknown>;
    readonly imageIndex: number;
}): ResolveImageUrlResult;
//# sourceMappingURL=gltf-uri-external-fetch-resolve.d.ts.map