import type { ResolveExternalUrlResult } from "./glb-uri-external-fetch-types.js";
export declare function resolveSameOriginBufferUrl(input: {
    readonly sourceUrl: URL;
    readonly uri: string;
    readonly bufferIndex: number;
}): ResolveExternalUrlResult;
export declare function resolveSameOriginImageUrl(input: {
    readonly sourceUrl: URL;
    readonly image: Record<string, unknown>;
    readonly imageIndex: number;
}): ResolveExternalUrlResult;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
//# sourceMappingURL=glb-uri-external-fetch-resolve.d.ts.map