import {
  createNoFetchGltfSourceLoaderReport,
  type CreateNoFetchGltfSourceLoaderReportOptions,
  type NoFetchGltfSourceLoaderReport,
} from "./gltf-source-loader-facade.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
} from "../materials/gltf-texture.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";
import {
  createMergedImageDataResolver,
  decodeExternalImages,
  normalizeConcurrency,
} from "./gltf-uri-images.js";
import {
  fetchBytes,
  fetchExternalBuffers,
  fetchExternalImages,
  mergeExternalBufferBytes,
  mergeExternalImageBytes,
  parseGltfJson,
} from "./gltf-uri-fetch.js";
import { normalizeUrl } from "./gltf-uri-shared.js";

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

export function createGltfUriLoadCache(): LoadGltfFromUriCache {
  return {
    bytes: new Map(),
    decodedImages: new Map(),
  };
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

export async function loadGltfFromUri(
  url: string,
  options: LoadGltfFromUriOptions = {},
): Promise<LoadGltfFromUriReport> {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    return failure(url, {
      code: "loadGltfFromUri.invalidUrl",
      severity: "error",
      message: `glTF URI '${url}' is not a valid absolute URL.`,
    });
  }

  const fetcher =
    options.fetch ??
    (globalThis.fetch === undefined
      ? undefined
      : (requestUrl: string) => globalThis.fetch(requestUrl));

  if (fetcher === undefined) {
    return failure(normalizedUrl, {
      code: "loadGltfFromUri.fetchUnavailable",
      severity: "error",
      message:
        "glTF URI loading requires globalThis.fetch or an explicit fetch option.",
    });
  }

  const source = await fetchBytes({
    url: normalizedUrl,
    fetcher,
    context: "source",
    ...(options.cache === undefined ? {} : { cache: options.cache }),
  });

  if (!source.ok) {
    return failure(normalizedUrl, source.diagnostic);
  }

  const parsed = parseGltfJson(normalizedUrl, source.bytes);

  if (!parsed.ok) {
    return failure(normalizedUrl, parsed.diagnostic, source.bytes.byteLength);
  }

  const [externalBuffers, externalImages] = await Promise.all([
    fetchExternalBuffers({
      root: parsed.root,
      sourceUrl: normalizedUrl,
      fetcher,
      ...(options.cache === undefined ? {} : { cache: options.cache }),
    }),
    fetchExternalImages({
      root: parsed.root,
      sourceUrl: normalizedUrl,
      fetcher,
      provided: options.externalImageBytes,
      ...(options.cache === undefined ? {} : { cache: options.cache }),
    }),
  ]);
  const {
    fetch: _fetch,
    cache: _cache,
    decodeImageData,
    basisTranscoder,
    createBasisKtx2Transcoder,
    ktx2TextureCompression,
    imageDecodeConcurrency,
    externalBufferBytes: providedBuffers,
    externalImageBytes: providedImages,
    resolveImageData,
    ...loaderOptions
  } = options;
  const mergedExternalBuffers = mergeExternalBufferBytes(
    providedBuffers,
    externalBuffers.bytes,
  );
  const mergedExternalImages = mergeExternalImageBytes(
    providedImages,
    externalImages.bytes,
  );
  const decodedImages = await decodeExternalImages({
    root: parsed.root,
    sourceUrl: normalizedUrl,
    externalBufferBytes: mergedExternalBuffers,
    externalImageBytes: mergedExternalImages,
    ...(decodeImageData === undefined ? {} : { decodeImageData }),
    ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
    ...(createBasisKtx2Transcoder === undefined
      ? {}
      : { createBasisKtx2Transcoder }),
    ...(ktx2TextureCompression === undefined ? {} : { ktx2TextureCompression }),
    imageDecodeConcurrency: normalizeConcurrency(imageDecodeConcurrency, 4),
    ...(options.cache === undefined ? {} : { cache: options.cache }),
  });
  const loader = createNoFetchGltfSourceLoaderReport({
    ...loaderOptions,
    root: parsed.root,
    sourceByteLength: source.bytes.byteLength,
    externalBufferBytes: mergedExternalBuffers,
    externalImageBytes: mergedExternalImages,
    decodedImageData: decodedImages.images,
    resolveImageData: createMergedImageDataResolver({
      decodedImages: decodedImages.images,
      fallback: resolveImageData,
    }),
  });
  const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
    code: "loadGltfFromUri.loaderDiagnostic" as const,
    severity: "error" as const,
    loaderCode: diagnostic.code,
    message: diagnostic.message,
  }));
  const diagnostics = [
    ...externalBuffers.diagnostics,
    ...externalImages.diagnostics,
    ...decodedImages.diagnostics,
    ...loaderDiagnostics,
  ];

  return {
    ok: loader.status.status === "loaded" && diagnostics.length === 0,
    url: normalizedUrl,
    byteLength: source.bytes.byteLength,
    loader,
    externalImages: decodedImages.statuses,
    diagnostics,
  };
}

function failure(
  url: string,
  diagnostic: LoadGltfFromUriDiagnostic,
  byteLength: number | null = null,
): LoadGltfFromUriReport {
  return {
    ok: false,
    url,
    byteLength,
    loader: null,
    externalImages: [],
    diagnostics: [diagnostic],
  };
}
