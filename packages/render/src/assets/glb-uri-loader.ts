import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
import { parseGlbContainer } from "./glb-container.js";
import {
  createNoFetchGlbSourceLoaderReport,
  type CreateNoFetchGlbSourceLoaderReportOptions,
  type NoFetchGlbSourceLoaderReport,
} from "./glb-source-loader-facade.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
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
import {
  createMergedImageDataResolver,
  decodeExternalImages,
  emptyDecodedImages,
  mergeDecodedImageData,
  normalizeConcurrency,
} from "./glb-uri-images.js";

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
