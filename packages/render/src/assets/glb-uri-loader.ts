import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
import { parseGlbContainer } from "./glb-container.js";
import {
  createNoFetchGlbSourceLoaderReport,
  type CreateNoFetchGlbSourceLoaderReportOptions,
  type NoFetchGlbSourceLoaderReport,
} from "./glb-source-loader-facade.js";
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
import {
  emptyExternalBuffers,
  emptyExternalImages,
  fetchBytes,
  fetchExternalBuffers,
  fetchExternalImages,
  mergeExternalBufferBytes,
  mergeExternalImageBytes,
} from "./glb-uri-fetch.js";

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

export function createGlbUriLoadCache(): LoadGlbFromUriCache {
  return {
    bytes: new Map(),
    decodedImages: new Map(),
  };
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

export async function loadGlbFromUri(
  url: string,
  options: LoadGlbFromUriOptions = {},
): Promise<LoadGlbFromUriReport> {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    return failure(url, {
      code: "loadGlbFromUri.invalidUrl",
      severity: "error",
      message: `GLB URI '${url}' is not a valid absolute URL.`,
    });
  }

  const fetcher =
    options.fetch ??
    (globalThis.fetch === undefined
      ? undefined
      : (requestUrl: string) => globalThis.fetch(requestUrl));

  if (fetcher === undefined) {
    return failure(normalizedUrl, {
      code: "loadGlbFromUri.fetchUnavailable",
      severity: "error",
      message:
        "GLB URI loading requires globalThis.fetch or an explicit fetch option.",
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

  const container = parseGlbContainer(source.bytes);
  const root = container.container?.json ?? null;
  const binary = container.container?.binaryChunk ?? null;
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
    decodedImageData: providedDecodedImages,
    resolveImageData,
    dracoDecoder: providedDracoDecoder,
    meshoptDecoder: providedMeshoptDecoder,
    createDracoDecoder,
    createMeshoptDecoder,
    ...loaderOptions
  } = options;
  const externalBuffers =
    root === null
      ? emptyExternalBuffers()
      : await fetchExternalBuffers({
          root,
          sourceUrl: normalizedUrl,
          fetcher,
          provided: providedBuffers,
          ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
  const mergedExternalBuffers = mergeExternalBufferBytes(
    providedBuffers,
    externalBuffers.bytes,
  );
  const externalImages =
    root === null
      ? emptyExternalImages()
      : await fetchExternalImages({
          root,
          sourceUrl: normalizedUrl,
          fetcher,
          provided: providedImages,
          ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
  const mergedExternalImages = mergeExternalImageBytes(
    providedImages,
    externalImages.bytes,
  );
  const decodedImages =
    root === null
      ? emptyDecodedImages()
      : await decodeExternalImages({
          root,
          binary,
          sourceUrl: normalizedUrl,
          externalBufferBytes: mergedExternalBuffers,
          externalImageBytes: mergedExternalImages,
          ...(decodeImageData === undefined ? {} : { decodeImageData }),
          ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
          ...(createBasisKtx2Transcoder === undefined
            ? {}
            : { createBasisKtx2Transcoder }),
          ...(ktx2TextureCompression === undefined
            ? {}
            : { ktx2TextureCompression }),
          imageDecodeConcurrency: normalizeConcurrency(
            imageDecodeConcurrency,
            4,
          ),
          ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
  const mergedDecodedImages = mergeDecodedImageData(
    providedDecodedImages,
    decodedImages.images,
  );
  const [dracoDecoder, meshoptDecoder] = await Promise.all([
    resolveDracoDecoder({
      root,
      provided: providedDracoDecoder,
      create: createDracoDecoder,
    }),
    resolveMeshoptDecoder({
      root,
      provided: providedMeshoptDecoder,
      create: createMeshoptDecoder,
    }),
  ]);
  const loader = createNoFetchGlbSourceLoaderReport({
    ...loaderOptions,
    source: source.bytes,
    externalBufferBytes: mergedExternalBuffers,
    decodedImageData: mergedDecodedImages,
    resolveImageData: createMergedImageDataResolver({
      decodedImages: mergedDecodedImages,
      fallback: resolveImageData,
    }),
    ...(dracoDecoder === undefined ? {} : { dracoDecoder }),
    ...(meshoptDecoder === undefined ? {} : { meshoptDecoder }),
  });
  const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
    code: "loadGlbFromUri.loaderDiagnostic" as const,
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

interface DecodeExternalImagesResult {
  readonly images: ReadonlyMap<number, GltfDecodedImageData>;
  readonly statuses: readonly LoadGlbFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

async function decodeExternalImages(input: {
  readonly root: Record<string, unknown>;
  readonly binary: Uint8Array | null;
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
  readonly cache?: LoadGlbFromUriCache;
}): Promise<DecodeExternalImagesResult> {
  const images = Array.isArray(input.root.images) ? input.root.images : [];
  const sourceUrl = new URL(input.sourceUrl);
  const decodedImages = new Map<number, GltfDecodedImageData>();
  const statuses: LoadGlbFromUriExternalImageStatus[] = [];
  const diagnostics: LoadGlbFromUriDiagnostic[] = [];
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
                code: "loadGlbFromUri.unsupportedImageUri" as const,
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
        binary: input.binary,
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
              code: "loadGlbFromUri.imageReadFailed" as const,
              severity: "error" as const,
              imageIndex,
              uri,
              message: errorMessage(
                error,
                `Decoding GLB image ${imageIndex} '${uri}' failed.`,
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
              diagnosticCode: "loadGlbFromUri.imageReadFailed" as const,
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
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic };

function bytesForImageSource(input: {
  readonly root: Record<string, unknown>;
  readonly binary: Uint8Array | null;
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
          code: "loadGlbFromUri.imageReadFailed",
          severity: "error",
          imageIndex: input.imageIndex,
          uri: input.source.uri,
          message: `GLB image ${input.imageIndex} URI '${input.source.uri}' bytes were not available.`,
        },
      };
    }

    return { ok: true, bytes };
  }

  const bytes = bufferViewBytesForImageSource({
    root: input.root,
    binary: input.binary,
    bufferViewIndex: input.source.bufferView,
    externalBufferBytes: input.externalBufferBytes,
  });

  if (!bytes.ok) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGlbFromUri.imageReadFailed",
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
  readonly binary: Uint8Array | null;
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
      message: `GLB image bufferView ${input.bufferViewIndex} is missing or malformed.`,
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
      message: `GLB image bufferView ${input.bufferViewIndex} has invalid byte layout.`,
    };
  }

  const bufferBytes = glbBufferBytes({
    root: input.root,
    binary: input.binary,
    bufferIndex,
    externalBufferBytes: input.externalBufferBytes,
  });

  if (bufferBytes === null) {
    return {
      ok: false,
      message: `GLB image bufferView ${input.bufferViewIndex} references unavailable buffer ${bufferIndex}.`,
    };
  }

  const view = bytesView(bufferBytes);
  const byteEnd = byteOffset + byteLength;

  if (byteEnd > view.byteLength) {
    return {
      ok: false,
      message: `GLB image bufferView ${input.bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
    };
  }

  return { ok: true, bytes: view.subarray(byteOffset, byteEnd) };
}

function glbBufferBytes(input: {
  readonly root: Record<string, unknown>;
  readonly binary: Uint8Array | null;
  readonly bufferIndex: number;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
}): ArrayBuffer | ArrayBufferView | null {
  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const buffer = buffers[input.bufferIndex];
  const isExternal = isRecord(buffer) && typeof buffer.uri === "string";

  if (isExternal) {
    return input.externalBufferBytes.get(input.bufferIndex) ?? null;
  }

  return input.bufferIndex === 0 ? input.binary : null;
}

function mergeDecodedImageData(
  provided: ReadonlyMap<number, GltfDecodedImageData> | undefined,
  decoded: ReadonlyMap<number, GltfDecodedImageData>,
): ReadonlyMap<number, GltfDecodedImageData> {
  if (provided === undefined || provided.size === 0) {
    return decoded;
  }

  const merged = new Map<number, GltfDecodedImageData>(provided);

  for (const [imageIndex, image] of decoded.entries()) {
    if (!merged.has(imageIndex)) {
      merged.set(imageIndex, image);
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
): LoadGlbFromUriExternalImageSourceKind {
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

async function resolveDracoDecoder(input: {
  readonly root: Record<string, unknown> | null;
  readonly provided: DracoMeshDecoder | undefined;
  readonly create: (() => PromiseLike<DracoMeshDecoder>) | undefined;
}): Promise<DracoMeshDecoder | undefined> {
  if (input.provided !== undefined || !gltfUsesDraco(input.root)) {
    return input.provided;
  }

  return input.create?.();
}

async function resolveMeshoptDecoder(input: {
  readonly root: Record<string, unknown> | null;
  readonly provided: MeshoptBufferDecoder | undefined;
  readonly create: (() => PromiseLike<MeshoptBufferDecoder>) | undefined;
}): Promise<MeshoptBufferDecoder | undefined> {
  if (input.provided !== undefined || !gltfUsesMeshopt(input.root)) {
    return input.provided;
  }

  return input.create?.();
}

function gltfUsesDraco(root: Record<string, unknown> | null): boolean {
  return (
    root !== null &&
    (stringArray(root.extensionsUsed).includes("KHR_draco_mesh_compression") ||
      stringArray(root.extensionsRequired).includes(
        "KHR_draco_mesh_compression",
      ))
  );
}

function gltfUsesMeshopt(root: Record<string, unknown> | null): boolean {
  if (root === null) {
    return false;
  }

  const used = stringArray(root.extensionsUsed);
  const required = stringArray(root.extensionsRequired);

  return (
    used.includes("EXT_meshopt_compression") ||
    used.includes("KHR_meshopt_compression") ||
    required.includes("EXT_meshopt_compression") ||
    required.includes("KHR_meshopt_compression")
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function emptyDecodedImages(): DecodeExternalImagesResult {
  return { images: new Map(), statuses: [], diagnostics: [] };
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

function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
  diagnostic: LoadGlbFromUriDiagnostic,
): LoadGlbFromUriReport {
  return {
    ok: false,
    url,
    byteLength: null,
    loader: null,
    externalImages: [],
    diagnostics: [diagnostic],
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
