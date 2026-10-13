import type { LoadGltfFromUriCache, LoadGltfFromUriDiagnostic, LoadGltfFromUriFetch } from "./gltf-uri-loader.js";
export interface FetchBytesInput {
    readonly url: string;
    readonly fetcher: LoadGltfFromUriFetch;
    readonly context: "source" | "buffer" | "image";
    readonly bufferIndex?: number;
    readonly imageIndex?: number;
    readonly cache?: LoadGltfFromUriCache;
}
export type FetchBytesResult = {
    readonly ok: true;
    readonly bytes: ArrayBuffer;
} | {
    readonly ok: false;
    readonly diagnostic: LoadGltfFromUriDiagnostic;
};
//# sourceMappingURL=gltf-uri-fetch-byte-types.d.ts.map