import type { LoadGlbFromUriCache, LoadGlbFromUriFetch } from "./glb-uri-loader.js";
import type { ExternalFetchCandidate, ExternalFetchContext, IndexedExternalFetchResult } from "./glb-uri-external-fetch-types.js";
export declare function fetchDeduplicatedExternalBytes(input: {
    readonly candidates: readonly ExternalFetchCandidate[];
    readonly fetcher: LoadGlbFromUriFetch;
    readonly context: ExternalFetchContext;
    readonly cache?: LoadGlbFromUriCache;
}): Promise<IndexedExternalFetchResult[]>;
//# sourceMappingURL=glb-uri-external-fetch-dedupe.d.ts.map