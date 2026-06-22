import type { LoadGltfFromUriDiagnostic } from "./gltf-uri-loader.js";

export interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

export interface FetchExternalImagesResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

export interface ExternalFetchCandidate {
  readonly index: number;
  readonly url: string;
}

export type ExternalFetchContext = "buffer" | "image";

export type IndexedExternalFetchResult =
  | { readonly index: number; readonly bytes: ArrayBuffer }
  | { readonly index: number; readonly diagnostic: LoadGltfFromUriDiagnostic };

export type ResolveBufferUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

export type ResolveImageUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };
