import { loadGltfTextureAsync } from "../materials/gltf-texture-loading.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
} from "../materials/gltf-texture-types.js";
import {
  imageDecodeCacheKey,
  imageDecodeOptionsKeyField,
  resolveBasisKtx2Transcoder,
} from "./glb-uri-image-cache.js";
import { byteLengthOf, bytesForImageSource } from "./glb-uri-image-bytes.js";
import { mapWithConcurrency } from "./glb-uri-image-merge.js";
import {
  externalImageSourceKind,
  imageSourceRefFromImage,
  imageStatusUri,
  isRecord,
} from "./glb-uri-image-sources.js";
import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriExternalImageStatus,
} from "./glb-uri-loader.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export {
  createMergedImageDataResolver,
  emptyDecodedImages,
  mergeDecodedImageData,
  normalizeConcurrency,
} from "./glb-uri-image-merge.js";

export interface DecodeExternalImagesResult {
  readonly images: ReadonlyMap<number, GltfDecodedImageData>;
  readonly statuses: readonly LoadGlbFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

export async function decodeExternalImages(input: {
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
