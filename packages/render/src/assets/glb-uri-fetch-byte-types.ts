import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriFetch,
} from "./glb-uri-loader.js";

export interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGlbFromUriFetch;
  readonly context: "source" | "buffer" | "image";
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly cache?: LoadGlbFromUriCache;
}

export type FetchBytesResult =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic };
