import {
  loadGltfTextureAsync,
  type GltfDecodedImageData,
  type GltfImageBytesDecoder,
  type GltfImageDataResolver,
  type GltfImageDataResolverInput,
  type GltfImageSourceRef,
} from "../materials/gltf-texture.js";
import type {
  LoadGltfFromUriCache,
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriExternalImageSourceKind,
  LoadGltfFromUriExternalImageStatus,
} from "./gltf-uri-loader.js";
import {
  byteLengthOf,
  bytesView,
  errorMessage,
  isRecord,
  isSupportedImageMimeType,
  mimeTypeFromImage,
} from "./gltf-uri-shared.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export interface DecodeExternalImagesResult {
  readonly images: ReadonlyMap<number, GltfDecodedImageData>;
  readonly statuses: readonly LoadGltfFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

export async function decodeExternalImages(input: {
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

export function normalizeConcurrency(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
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

export function createMergedImageDataResolver(input: {
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
