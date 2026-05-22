import {
  createNoFetchGltfSourceLoaderReport,
  type CreateNoFetchGltfSourceLoaderReportOptions,
  type NoFetchGltfSourceLoaderReport,
} from "./gltf-source-loader-facade.js";
import {
  loadGltfTextureAsync,
  type GltfDecodedImageData,
  type GltfImageBytesDecoder,
  type GltfImageDataResolver,
  type GltfImageDataResolverInput,
  type GltfImageSourceRef,
} from "../materials/gltf-texture.js";
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

interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly context: "source" | "buffer" | "image";
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly cache?: LoadGltfFromUriCache;
}

type FetchBytesResult =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

async function fetchBytes(input: FetchBytesInput): Promise<FetchBytesResult> {
  if (input.cache !== undefined) {
    return fetchBytesWithCache(input);
  }

  return fetchBytesWithoutCache(input);
}

class CachedFetchDiagnosticError extends Error {
  constructor(readonly diagnostic: LoadGltfFromUriDiagnostic) {
    super(diagnostic.message);
  }
}

async function fetchBytesWithCache(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  const cache = input.cache;

  if (cache === undefined) {
    return fetchBytesWithoutCache(input);
  }

  let cached = cache.bytes.get(input.url);

  if (cached === undefined) {
    cached = fetchBytesWithoutCache(input).then((result) => {
      if (!result.ok) {
        cache.bytes.delete(input.url);
        throw new CachedFetchDiagnosticError(result.diagnostic);
      }

      return result.bytes;
    });
    cache.bytes.set(input.url, cached);
  }

  try {
    return { ok: true, bytes: await cached };
  } catch (error) {
    if (error instanceof CachedFetchDiagnosticError) {
      return {
        ok: false,
        diagnostic: diagnosticForFetchInput(error.diagnostic, input),
      };
    }

    return {
      ok: false,
      diagnostic: {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Fetching glTF URI '${input.url}' failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
  }
}

function diagnosticForFetchInput(
  diagnostic: LoadGltfFromUriDiagnostic,
  input: FetchBytesInput,
): LoadGltfFromUriDiagnostic {
  return {
    code: fetchDiagnosticCodeForContext(diagnostic.code, input.context),
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.status === undefined ? {} : { status: diagnostic.status }),
    ...(diagnostic.statusText === undefined
      ? {}
      : { statusText: diagnostic.statusText }),
    uri: diagnostic.uri ?? input.url,
    ...(input.bufferIndex === undefined
      ? {}
      : { bufferIndex: input.bufferIndex }),
    ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
  };
}

function fetchDiagnosticCodeForContext(
  code: LoadGltfFromUriDiagnosticCode,
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (code) {
    case "loadGltfFromUri.fetchFailed":
    case "loadGltfFromUri.bufferFetchFailed":
    case "loadGltfFromUri.imageFetchFailed":
      return fetchFailedCode(context);
    case "loadGltfFromUri.httpError":
    case "loadGltfFromUri.bufferHttpError":
    case "loadGltfFromUri.imageHttpError":
      return httpErrorCode(context);
    case "loadGltfFromUri.readFailed":
    case "loadGltfFromUri.bufferReadFailed":
    case "loadGltfFromUri.imageReadFailed":
      return readFailedCode(context);
    default:
      return code;
  }
}

async function fetchBytesWithoutCache(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  let response: LoadGltfFromUriFetchResponse;

  try {
    response = await input.fetcher(input.url);
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Fetching glTF URI '${input.url}' failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: {
        code: httpErrorCode(input.context),
        severity: "error",
        status: response.status,
        statusText: response.statusText,
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
        message: `Fetching glTF URI '${input.url}' failed with HTTP ${response.status}.`,
      },
    };
  }

  try {
    return { ok: true, bytes: await response.arrayBuffer() };
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code: readFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Reading glTF URI '${input.url}' response bytes failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
  }
}

function fetchFailedCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.fetchFailed";
    case "buffer":
      return "loadGltfFromUri.bufferFetchFailed";
    case "image":
      return "loadGltfFromUri.imageFetchFailed";
  }
}

function httpErrorCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.httpError";
    case "buffer":
      return "loadGltfFromUri.bufferHttpError";
    case "image":
      return "loadGltfFromUri.imageHttpError";
  }
}

function readFailedCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.readFailed";
    case "buffer":
      return "loadGltfFromUri.bufferReadFailed";
    case "image":
      return "loadGltfFromUri.imageReadFailed";
  }
}

type ParseGltfJsonResult =
  | { readonly ok: true; readonly root: Record<string, unknown> }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function parseGltfJson(url: string, bytes: ArrayBuffer): ParseGltfJsonResult {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return invalidJson(url, error);
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) {
      return invalidJson(url, null);
    }

    return { ok: true, root: parsed };
  } catch (error) {
    return invalidJson(url, error);
  }
}

function invalidJson(
  url: string,
  error: unknown,
): { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic } {
  return {
    ok: false,
    diagnostic: {
      code: "loadGltfFromUri.invalidJson",
      severity: "error",
      uri: url,
      message: errorMessage(error, `glTF URI '${url}' did not contain JSON.`),
    },
  };
}

interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

interface ExternalFetchCandidate {
  readonly index: number;
  readonly url: string;
}

type ExternalFetchContext = "buffer" | "image";

type IndexedExternalFetchResult =
  | { readonly index: number; readonly bytes: ArrayBuffer }
  | { readonly index: number; readonly diagnostic: LoadGltfFromUriDiagnostic };

async function fetchExternalBuffers(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly cache?: LoadGltfFromUriCache;
}): Promise<FetchExternalBuffersResult> {
  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  buffers.forEach((buffer, bufferIndex) => {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      return;
    }

    const bufferUrl = resolveSameOriginBufferUrl({
      sourceUrl,
      uri: buffer.uri,
      bufferIndex,
    });

    if (!bufferUrl.ok) {
      diagnostics.push(bufferUrl.diagnostic);
      return;
    }

    candidates.push({ index: bufferIndex, url: bufferUrl.url });
  });

  const results = await fetchDeduplicatedExternalBytes({
    candidates,
    fetcher: input.fetcher,
    context: "buffer",
    ...(input.cache === undefined ? {} : { cache: input.cache }),
  });

  for (const result of results) {
    if ("diagnostic" in result) {
      diagnostics.push(result.diagnostic);
    } else {
      bytes.set(result.index, result.bytes);
    }
  }

  return { bytes, diagnostics };
}

interface FetchExternalImagesResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

async function fetchExternalImages(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly cache?: LoadGltfFromUriCache;
  readonly provided:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined;
}): Promise<FetchExternalImagesResult> {
  const images = Array.isArray(input.root.images) ? input.root.images : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  images.forEach((image, imageIndex) => {
    if (!isRecord(image) || typeof image.uri !== "string") {
      return;
    }

    if (image.uri.startsWith("data:")) {
      return;
    }

    const imageUrl = resolveSameOriginImageUrl({
      sourceUrl,
      image,
      imageIndex,
    });

    if (!imageUrl.ok) {
      diagnostics.push(imageUrl.diagnostic);
      return;
    }

    if (input.provided?.has(imageIndex) === true) {
      return;
    }

    candidates.push({ index: imageIndex, url: imageUrl.url });
  });

  const results = await fetchDeduplicatedExternalBytes({
    candidates,
    fetcher: input.fetcher,
    context: "image",
    ...(input.cache === undefined ? {} : { cache: input.cache }),
  });

  for (const result of results) {
    if ("diagnostic" in result) {
      diagnostics.push(result.diagnostic);
    } else {
      bytes.set(result.index, result.bytes);
    }
  }

  return { bytes, diagnostics };
}

async function fetchDeduplicatedExternalBytes(input: {
  readonly candidates: readonly ExternalFetchCandidate[];
  readonly fetcher: LoadGltfFromUriFetch;
  readonly context: ExternalFetchContext;
  readonly cache?: LoadGltfFromUriCache;
}): Promise<IndexedExternalFetchResult[]> {
  const candidatesByUrl = new Map<string, ExternalFetchCandidate[]>();

  for (const candidate of input.candidates) {
    const existing = candidatesByUrl.get(candidate.url);

    if (existing === undefined) {
      candidatesByUrl.set(candidate.url, [candidate]);
    } else {
      existing.push(candidate);
    }
  }

  const resultGroups = await Promise.all(
    [...candidatesByUrl.entries()].map(async ([url, candidates]) => {
      const first = candidates[0];

      if (first === undefined) {
        return [];
      }

      const fetched = await fetchBytes({
        url,
        fetcher: input.fetcher,
        context: input.context,
        ...(input.cache === undefined ? {} : { cache: input.cache }),
        ...fetchIndexField(input.context, first.index),
      });

      if (!fetched.ok) {
        return candidates.map((candidate) => ({
          index: candidate.index,
          diagnostic: diagnosticForExternalFetchIndex(
            fetched.diagnostic,
            input.context,
            candidate.index,
          ),
        }));
      }

      return candidates.map((candidate) => ({
        index: candidate.index,
        bytes: fetched.bytes,
      }));
    }),
  );

  return resultGroups.flat();
}

function fetchIndexField(
  context: ExternalFetchContext,
  index: number,
): Pick<FetchBytesInput, "bufferIndex" | "imageIndex"> {
  return context === "buffer" ? { bufferIndex: index } : { imageIndex: index };
}

function diagnosticForExternalFetchIndex(
  diagnostic: LoadGltfFromUriDiagnostic,
  context: ExternalFetchContext,
  index: number,
): LoadGltfFromUriDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.status === undefined ? {} : { status: diagnostic.status }),
    ...(diagnostic.statusText === undefined
      ? {}
      : { statusText: diagnostic.statusText }),
    ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
    ...(diagnostic.loaderCode === undefined
      ? {}
      : { loaderCode: diagnostic.loaderCode }),
    ...fetchIndexField(context, index),
  };
}

interface DecodeExternalImagesResult {
  readonly images: ReadonlyMap<number, GltfDecodedImageData>;
  readonly statuses: readonly LoadGltfFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

async function decodeExternalImages(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly externalImageBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly decodeImageData?: GltfImageBytesDecoder;
  readonly basisTranscoder?: Ktx2BasisTranscoder;
  readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
  readonly imageDecodeConcurrency: number;
  readonly cache?: LoadGltfFromUriCache;
}): Promise<DecodeExternalImagesResult> {
  const images = Array.isArray(input.root.images) ? input.root.images : [];
  const sourceUrl = new URL(input.sourceUrl);
  const decodedImages = new Map<number, GltfDecodedImageData>();
  const statuses: LoadGltfFromUriExternalImageStatus[] = [];
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];
  const decodeCache =
    input.cache?.decodedImages ??
    new Map<string, Promise<GltfDecodedImageData>>();
  const byteObjectIds = new WeakMap<object, number>();
  let nextByteObjectId = 0;
  let createdBasisTranscoder: Promise<Ktx2BasisTranscoder> | null = null;

  const byteObjectId = (bytes: ArrayBuffer | ArrayBufferView): number => {
    const object = bytes as object;
    const existing = byteObjectIds.get(object);

    if (existing !== undefined) {
      return existing;
    }

    const id = nextByteObjectId;
    nextByteObjectId += 1;
    byteObjectIds.set(object, id);
    return id;
  };

  const results = await mapWithConcurrency(
    images.map((image, imageIndex) => ({ image, imageIndex })),
    input.imageDecodeConcurrency,
    async ({ image, imageIndex }) => {
      if (!isRecord(image)) {
        return null;
      }

      const source = imageSourceRefFromImage(image);

      if (!source.ok) {
        if (
          typeof image.uri === "string" ||
          Number.isInteger(image.bufferView)
        ) {
          return {
            diagnostics: [
              {
                code: "loadGltfFromUri.unsupportedImageUri" as const,
                severity: "error" as const,
                imageIndex,
                ...(typeof image.uri === "string" ? { uri: image.uri } : {}),
                message: source.message,
              },
            ],
            statuses: [],
          };
        }
        return null;
      }

      const imageBytes = bytesForImageSource({
        root: input.root,
        source: source.source,
        imageIndex,
        externalBufferBytes: input.externalBufferBytes,
        externalImageBytes: input.externalImageBytes,
      });

      if (!imageBytes.ok) {
        return {
          diagnostics: [imageBytes.diagnostic],
          statuses: [
            {
              imageIndex,
              sourceKind: externalImageSourceKind(source.source),
              uri: imageStatusUri(source.source),
              status: "blocked" as const,
              byteLength: null,
              ...(source.source.mimeType === undefined
                ? {}
                : { mimeType: source.source.mimeType }),
              ...(imageBytes.diagnostic.uri === undefined
                ? {}
                : { url: imageBytes.diagnostic.uri }),
              diagnosticCode: imageBytes.diagnostic.code,
            },
          ],
        };
      }

      try {
        const decodeCacheKey = imageDecodeCacheKey({
          source: source.source,
          sourceUrl,
          bytes: imageBytes.bytes,
          byteObjectId,
          ...imageDecodeOptionsKeyField({
            source: source.source,
            ...(input.ktx2TextureCompression === undefined
              ? {}
              : { textureCompression: input.ktx2TextureCompression }),
          }),
        });
        let decodedPromise = decodeCache.get(decodeCacheKey);

        if (decodedPromise === undefined) {
          const basisTranscoder =
            input.decodeImageData === undefined
              ? await resolveBasisKtx2Transcoder({
                  source: source.source,
                  provided: input.basisTranscoder,
                  create: input.createBasisKtx2Transcoder,
                  getCreated: () => createdBasisTranscoder,
                  setCreated: (promise) => {
                    createdBasisTranscoder = promise;
                  },
                })
              : undefined;

          decodedPromise = loadGltfTextureAsync({
            source: source.source,
            ...(imageBytes.bytes === undefined
              ? {}
              : { bytes: imageBytes.bytes }),
            ...(input.decodeImageData === undefined
              ? {}
              : { decodeImageData: input.decodeImageData }),
            ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
            ...(input.ktx2TextureCompression === undefined
              ? {}
              : { ktx2TextureCompression: input.ktx2TextureCompression }),
          }).catch((error: unknown) => {
            decodeCache.delete(decodeCacheKey);
            throw error;
          });
          decodeCache.set(decodeCacheKey, decodedPromise);
        }

        const decoded = await decodedPromise;
        return {
          decoded: { imageIndex, image: decoded },
          diagnostics: [],
          statuses: [
            {
              imageIndex,
              sourceKind: externalImageSourceKind(source.source),
              uri: imageStatusUri(source.source),
              status: "loaded" as const,
              byteLength:
                imageBytes.bytes === undefined
                  ? decoded.sourceData.bytes.byteLength
                  : byteLengthOf(imageBytes.bytes),
              ...(source.source.mimeType === undefined
                ? {}
                : { mimeType: source.source.mimeType }),
              ...(source.source.kind === "uri" &&
              !source.source.uri.startsWith("data:")
                ? { url: new URL(source.source.uri, sourceUrl).href }
                : {}),
              width: decoded.width,
              height: decoded.height,
            },
          ],
        };
      } catch (error) {
        const uri = imageStatusUri(source.source);
        return {
          diagnostics: [
            {
              code: "loadGltfFromUri.imageReadFailed" as const,
              severity: "error" as const,
              imageIndex,
              uri,
              message: errorMessage(
                error,
                `Decoding glTF image ${imageIndex} '${uri}' failed.`,
              ),
            },
          ],
          statuses: [
            {
              imageIndex,
              sourceKind: externalImageSourceKind(source.source),
              uri,
              status: "blocked" as const,
              byteLength:
                imageBytes.bytes === undefined
                  ? null
                  : byteLengthOf(imageBytes.bytes),
              ...(source.source.mimeType === undefined
                ? {}
                : { mimeType: source.source.mimeType }),
              diagnosticCode: "loadGltfFromUri.imageReadFailed" as const,
            },
          ],
        };
      }
    },
  );

  for (const result of results) {
    if (result === null) {
      continue;
    }

    if (result.decoded !== undefined) {
      decodedImages.set(result.decoded.imageIndex, result.decoded.image);
    }

    diagnostics.push(...result.diagnostics);
    statuses.push(...result.statuses);
  }

  return { images: decodedImages, statuses, diagnostics };
}

function imageDecodeCacheKey(input: {
  readonly source: GltfImageSourceRef;
  readonly sourceUrl: URL;
  readonly bytes: ArrayBuffer | ArrayBufferView | undefined;
  readonly byteObjectId: (bytes: ArrayBuffer | ArrayBufferView) => number;
  readonly decodeOptionsKey?: string;
}): string {
  const mimeType = input.source.mimeType ?? "";
  const decodeOptionsKey =
    input.decodeOptionsKey === undefined
      ? ""
      : `:decode:${input.decodeOptionsKey}`;

  if (input.source.kind === "uri") {
    const uri = input.source.uri.startsWith("data:")
      ? input.source.uri
      : new URL(input.source.uri, input.sourceUrl).href;

    return `uri:${uri}:mime:${mimeType}${decodeOptionsKey}`;
  }

  const bytesKey =
    input.bytes === undefined
      ? "inline"
      : `bytes:${input.byteObjectId(input.bytes)}`;

  return `bufferView:${input.sourceUrl.href}:${input.source.bufferView}:mime:${mimeType}:${bytesKey}${decodeOptionsKey}`;
}

function imageDecodeOptionsKey(input: {
  readonly source: GltfImageSourceRef;
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}): string | undefined {
  if (input.source.mimeType !== "image/ktx2") {
    return undefined;
  }

  const compression = input.textureCompression;

  return (
    [
      compression?.astc === true ? "astc" : null,
      compression?.bc === true ? "bc" : null,
      compression?.etc2 === true ? "etc2" : null,
    ]
      .filter((feature): feature is string => feature !== null)
      .join(",") || "rgba"
  );
}

function imageDecodeOptionsKeyField(input: {
  readonly source: GltfImageSourceRef;
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}): { readonly decodeOptionsKey?: string } {
  const decodeOptionsKey = imageDecodeOptionsKey(input);
  return decodeOptionsKey === undefined ? {} : { decodeOptionsKey };
}

async function resolveBasisKtx2Transcoder(input: {
  readonly source: GltfImageSourceRef;
  readonly provided: Ktx2BasisTranscoder | undefined;
  readonly create: (() => PromiseLike<Ktx2BasisTranscoder>) | undefined;
  readonly getCreated: () => Promise<Ktx2BasisTranscoder> | null;
  readonly setCreated: (promise: Promise<Ktx2BasisTranscoder>) => void;
}): Promise<Ktx2BasisTranscoder | undefined> {
  if (input.source.mimeType !== "image/ktx2") {
    return undefined;
  }
  if (input.provided !== undefined) {
    return input.provided;
  }
  if (input.create === undefined) {
    return undefined;
  }

  const existing = input.getCreated();
  if (existing !== null) {
    return existing;
  }

  const created = Promise.resolve(input.create());
  input.setCreated(created);
  return created;
}

async function mapWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];

      if (item !== undefined) {
        results[index] = await mapper(item);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}

function normalizeConcurrency(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

type ResolveBufferUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function resolveSameOriginBufferUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly bufferIndex: number;
}): ResolveBufferUrlResult {
  if (input.uri.startsWith("data:")) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} uses a data URI; this loader currently expects same-origin external buffer files.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(input.uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}

type ResolveImageUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function resolveSameOriginImageUrl(input: {
  readonly sourceUrl: URL;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
}): ResolveImageUrlResult {
  const uri = input.image.uri;

  if (typeof uri !== "string") {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        message: `glTF image ${input.imageIndex} does not provide a URI.`,
      },
    };
  }

  const mimeType = mimeTypeFromImage(input.image, uri);

  if (mimeType === null) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' has an unsupported or unknown image format.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}

type ImageSourceRefResult =
  | { readonly ok: true; readonly source: GltfImageSourceRef }
  | { readonly ok: false; readonly message: string };

function imageSourceRefFromImage(
  image: Record<string, unknown>,
): ImageSourceRefResult {
  const bufferView =
    typeof image.bufferView === "number" && Number.isInteger(image.bufferView)
      ? image.bufferView
      : null;

  if (bufferView !== null) {
    if (typeof image.mimeType !== "string") {
      return {
        ok: false,
        message: "BufferView images must declare a MIME type.",
      };
    }

    if (!isSupportedImageMimeType(image.mimeType)) {
      return {
        ok: false,
        message: `Image MIME type '${image.mimeType}' is not supported.`,
      };
    }

    return {
      ok: true,
      source: {
        kind: "bufferView",
        bufferView,
        mimeType: image.mimeType,
      },
    };
  }

  if (typeof image.uri === "string") {
    const mimeType = mimeTypeFromImage(image, image.uri);

    if (mimeType === null) {
      return {
        ok: false,
        message: `Image URI '${image.uri}' has an unsupported or unknown image format.`,
      };
    }

    return {
      ok: true,
      source: {
        kind: "uri",
        uri: image.uri,
        mimeType,
      },
    };
  }

  return {
    ok: false,
    message: "Image must provide a URI or bufferView source.",
  };
}

type BytesForImageSourceResult =
  | { readonly ok: true; readonly bytes?: ArrayBuffer | ArrayBufferView }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function bytesForImageSource(input: {
  readonly root: Record<string, unknown>;
  readonly source: GltfImageSourceRef;
  readonly imageIndex: number;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly externalImageBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
}): BytesForImageSourceResult {
  if (input.source.kind === "uri") {
    if (input.source.uri.startsWith("data:")) {
      return { ok: true };
    }

    const bytes = input.externalImageBytes.get(input.imageIndex);
    if (bytes === undefined) {
      return {
        ok: false,
        diagnostic: {
          code: "loadGltfFromUri.imageReadFailed",
          severity: "error",
          imageIndex: input.imageIndex,
          uri: input.source.uri,
          message: `glTF image ${input.imageIndex} URI '${input.source.uri}' bytes were not available.`,
        },
      };
    }

    return { ok: true, bytes };
  }

  const bytes = bufferViewBytesForImageSource({
    root: input.root,
    bufferViewIndex: input.source.bufferView,
    externalBufferBytes: input.externalBufferBytes,
  });

  if (!bytes.ok) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.imageReadFailed",
        severity: "error",
        imageIndex: input.imageIndex,
        uri: `bufferView:${input.source.bufferView}`,
        message: bytes.message,
      },
    };
  }

  return { ok: true, bytes: bytes.bytes };
}

type BufferViewBytesForImageResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string };

function bufferViewBytesForImageSource(input: {
  readonly root: Record<string, unknown>;
  readonly bufferViewIndex: number;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
}): BufferViewBytesForImageResult {
  const bufferViews = Array.isArray(input.root.bufferViews)
    ? input.root.bufferViews
    : [];
  const bufferView = bufferViews[input.bufferViewIndex];

  if (!isRecord(bufferView)) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} is missing or malformed.`,
    };
  }

  const bufferIndex =
    typeof bufferView.buffer === "number" && Number.isInteger(bufferView.buffer)
      ? bufferView.buffer
      : null;
  const byteOffset =
    typeof bufferView.byteOffset === "number" &&
    Number.isInteger(bufferView.byteOffset)
      ? bufferView.byteOffset
      : 0;
  const byteLength =
    typeof bufferView.byteLength === "number" &&
    Number.isInteger(bufferView.byteLength)
      ? bufferView.byteLength
      : null;

  if (bufferIndex === null || byteOffset < 0 || byteLength === null) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} has invalid byte layout.`,
    };
  }

  const bufferBytes = input.externalBufferBytes.get(bufferIndex);
  if (bufferBytes === undefined) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} references unavailable buffer ${bufferIndex}.`,
    };
  }

  const view = bytesView(bufferBytes);
  const byteEnd = byteOffset + byteLength;

  if (byteEnd > view.byteLength) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
    };
  }

  return { ok: true, bytes: view.subarray(byteOffset, byteEnd) };
}

function mergeExternalBufferBytes(
  provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined,
  fetched: ReadonlyMap<number, ArrayBuffer>,
): ReadonlyMap<number, ArrayBuffer | ArrayBufferView> {
  if (provided === undefined || provided.size === 0) {
    return fetched;
  }

  const merged = new Map<number, ArrayBuffer | ArrayBufferView>(provided);

  for (const [bufferIndex, bytes] of fetched.entries()) {
    if (!merged.has(bufferIndex)) {
      merged.set(bufferIndex, bytes);
    }
  }

  return merged;
}

function mergeExternalImageBytes(
  provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined,
  fetched: ReadonlyMap<number, ArrayBuffer>,
): ReadonlyMap<number, ArrayBuffer | ArrayBufferView> {
  if (provided === undefined || provided.size === 0) {
    return fetched;
  }

  const merged = new Map<number, ArrayBuffer | ArrayBufferView>(provided);

  for (const [imageIndex, bytes] of fetched.entries()) {
    if (!merged.has(imageIndex)) {
      merged.set(imageIndex, bytes);
    }
  }

  return merged;
}

function createMergedImageDataResolver(input: {
  readonly decodedImages: ReadonlyMap<number, GltfDecodedImageData>;
  readonly fallback: GltfImageDataResolver | undefined;
}): GltfImageDataResolver {
  return (resolverInput: GltfImageDataResolverInput) => {
    const decoded = input.decodedImages.get(resolverInput.imageIndex);
    if (decoded !== undefined) {
      return decoded;
    }

    return input.fallback?.(resolverInput) ?? null;
  };
}

function externalImageSourceKind(
  source: GltfImageSourceRef,
): LoadGltfFromUriExternalImageSourceKind {
  if (source.kind === "bufferView") {
    return "buffer-view";
  }
  return source.uri.startsWith("data:") ? "data-uri" : "uri";
}

function imageStatusUri(source: GltfImageSourceRef): string {
  return source.kind === "bufferView"
    ? `bufferView:${source.bufferView}`
    : source.uri;
}

function mimeTypeFromImage(
  image: Record<string, unknown>,
  uri: string,
): string | null {
  const mimeType =
    typeof image.mimeType === "string" ? image.mimeType : mimeTypeFromUri(uri);

  return mimeType !== null && isSupportedImageMimeType(mimeType)
    ? mimeType
    : null;
}

function mimeTypeFromUri(uri: string): string | null {
  const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
  if (dataPrefix?.[1] !== undefined) {
    return dataPrefix[1];
  }

  let pathname: string;

  try {
    pathname = new URL(uri, "https://example.invalid/").pathname;
  } catch {
    pathname = uri;
  }

  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".ktx2")) {
    return "image/ktx2";
  }
  return null;
}

function isSupportedImageMimeType(mimeType: string): boolean {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/ktx2"
  );
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function normalizeUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
