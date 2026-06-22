import type {
  CreateNoFetchGltfSourceLoaderReportOptions,
  NoFetchGltfSourceLoaderReport,
} from "./gltf-source-loader-facade.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
} from "../materials/gltf-texture-types.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export type LoadGltfFromUriDiagnosticCode =
  | "loadGltfFromUri.invalidUrl"
  | "loadGltfFromUri.fetchUnavailable"
  | "loadGltfFromUri.fetchFailed"
  | "loadGltfFromUri.httpError"
  | "loadGltfFromUri.readFailed"
  | "loadGltfFromUri.invalidJson"
  | "loadGltfFromUri.unsupportedBufferUri"
  | "loadGltfFromUri.bufferFetchFailed"
  | "loadGltfFromUri.bufferHttpError"
  | "loadGltfFromUri.bufferReadFailed"
  | "loadGltfFromUri.unsupportedImageUri"
  | "loadGltfFromUri.imageFetchFailed"
  | "loadGltfFromUri.imageHttpError"
  | "loadGltfFromUri.imageReadFailed"
  | "loadGltfFromUri.loaderDiagnostic";

export interface LoadGltfFromUriDiagnostic {
  readonly code: LoadGltfFromUriDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly uri?: string;
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly loaderCode?: string;
}

export interface LoadGltfFromUriFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export type LoadGltfFromUriFetch = (
  url: string,
) => Promise<LoadGltfFromUriFetchResponse>;

export interface LoadGltfFromUriCache {
  readonly bytes: Map<string, Promise<ArrayBuffer>>;
  readonly decodedImages: Map<string, Promise<GltfDecodedImageData>>;
}

export interface LoadGltfFromUriOptions extends Omit<
  CreateNoFetchGltfSourceLoaderReportOptions,
  "decodedImageData" | "root"
> {
  readonly fetch?: LoadGltfFromUriFetch;
  readonly decodeImageData?: GltfImageBytesDecoder;
  readonly basisTranscoder?: Ktx2BasisTranscoder;
  readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
  readonly imageDecodeConcurrency?: number;
  readonly cache?: LoadGltfFromUriCache;
}

export type LoadGltfFromUriExternalImageSourceKind =
  | "uri"
  | "data-uri"
  | "buffer-view";

export interface LoadGltfFromUriExternalImageStatus {
  readonly imageIndex: number;
  readonly sourceKind: LoadGltfFromUriExternalImageSourceKind;
  readonly uri: string;
  readonly status: "loaded" | "blocked";
  readonly byteLength: number | null;
  readonly mimeType?: string;
  readonly url?: string;
  readonly width?: number;
  readonly height?: number;
  readonly diagnosticCode?: LoadGltfFromUriDiagnosticCode;
}

export interface LoadGltfFromUriReport {
  readonly ok: boolean;
  readonly url: string;
  readonly byteLength: number | null;
  readonly loader: NoFetchGltfSourceLoaderReport | null;
  readonly externalImages: readonly LoadGltfFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}
