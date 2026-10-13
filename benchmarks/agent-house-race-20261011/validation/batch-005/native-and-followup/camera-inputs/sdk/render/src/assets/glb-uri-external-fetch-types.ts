import type { LoadGlbFromUriDiagnostic } from "./glb-uri-loader.js";

export interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

export interface FetchExternalImagesResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

export interface ExternalFetchCandidate {
  readonly index: number;
  readonly url: string;
}

export type ExternalFetchContext = "buffer" | "image";

export type IndexedExternalFetchResult =
  | { readonly index: number; readonly bytes: ArrayBuffer }
  | { readonly index: number; readonly diagnostic: LoadGlbFromUriDiagnostic };

export type ResolveExternalUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic };
