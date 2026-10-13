import type { LoadGltfFromUriCache, LoadGltfFromUriFetch } from "./gltf-uri-loader.js";
import type { ExternalFetchCandidate, ExternalFetchContext, IndexedExternalFetchResult } from "./gltf-uri-external-fetch-types.js";
export declare function fetchDeduplicatedExternalBytes(input: {
    readonly candidates: readonly ExternalFetchCandidate[];
    readonly fetcher: LoadGltfFromUriFetch;
    readonly context: ExternalFetchContext;
    readonly cache?: LoadGltfFromUriCache;
}): Promise<IndexedExternalFetchResult[]>;
//# sourceMappingURL=gltf-uri-external-fetch-dedupe.d.ts.map