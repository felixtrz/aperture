import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
} from "../materials/gltf-texture.js";
import type {
  CreateNoFetchGlbSourceLoaderReportOptions,
  NoFetchGlbSourceLoaderReport,
} from "./glb-source-loader-facade.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export type LoadGlbFromUriDiagnosticCode =
  | "loadGlbFromUri.invalidUrl"
  | "loadGlbFromUri.fetchUnavailable"
  | "loadGlbFromUri.fetchFailed"
  | "loadGlbFromUri.httpError"
  | "loadGlbFromUri.readFailed"
  | "loadGlbFromUri.unsupportedBufferUri"
  | "loadGlbFromUri.bufferFetchFailed"
  | "loadGlbFromUri.bufferHttpError"
  | "loadGlbFromUri.bufferReadFailed"
  | "loadGlbFromUri.unsupportedImageUri"
  | "loadGlbFromUri.imageFetchFailed"
  | "loadGlbFromUri.imageHttpError"
  | "loadGlbFromUri.imageReadFailed"
  | "loadGlbFromUri.loaderDiagnostic";

export interface LoadGlbFromUriDiagnostic {
  readonly code: LoadGlbFromUriDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly uri?: string;
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly loaderCode?: string;
}

export interface LoadGlbFromUriFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export type LoadGlbFromUriFetch = (
  url: string,
) => Promise<LoadGlbFromUriFetchResponse>;

export interface LoadGlbFromUriCache {
  readonly bytes: Map<string, Promise<ArrayBuffer>>;
  readonly decodedImages: Map<string, Promise<GltfDecodedImageData>>;
}

export type LoadGlbFromUriExternalImageSourceKind =
  | "uri"
  | "data-uri"
  | "buffer-view";

export interface LoadGlbFromUriExternalImageStatus {
  readonly imageIndex: number;
  readonly sourceKind: LoadGlbFromUriExternalImageSourceKind;
  readonly uri: string;
  readonly status: "loaded" | "blocked";
  readonly byteLength: number | null;
  readonly mimeType?: string;
  readonly url?: string;
  readonly width?: number;
  readonly height?: number;
  readonly diagnosticCode?: LoadGlbFromUriDiagnosticCode;
}

export interface LoadGlbFromUriOptions extends Omit<
  CreateNoFetchGlbSourceLoaderReportOptions,
  "source" | "decodedImageData"
> {
  readonly fetch?: LoadGlbFromUriFetch;
  readonly cache?: LoadGlbFromUriCache;
  readonly decodeImageData?: GltfImageBytesDecoder;
  readonly basisTranscoder?: Ktx2BasisTranscoder;
  readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
  readonly imageDecodeConcurrency?: number;
  readonly externalImageBytes?: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly decodedImageData?: ReadonlyMap<number, GltfDecodedImageData>;
  readonly createDracoDecoder?: () => PromiseLike<DracoMeshDecoder>;
  readonly createMeshoptDecoder?: () => PromiseLike<MeshoptBufferDecoder>;
}

export interface LoadGlbFromUriReport {
  readonly ok: boolean;
  readonly url: string;
  readonly byteLength: number | null;
  readonly loader: NoFetchGlbSourceLoaderReport | null;
  readonly externalImages: readonly LoadGlbFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}
