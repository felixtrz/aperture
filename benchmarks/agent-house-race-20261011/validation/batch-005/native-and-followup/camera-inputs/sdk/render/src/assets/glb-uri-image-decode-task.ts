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
import {
  externalImageSourceKind,
  imageSourceRefFromImage,
  imageStatusUri,
  isRecord,
} from "./glb-uri-image-sources.js";
import type {
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriExternalImageStatus,
} from "./glb-uri-loader.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export interface GlbExternalImageDecodeTaskResult {
  readonly decoded?: {
    readonly imageIndex: number;
    readonly image: GltfDecodedImageData;
  };
  readonly statuses: readonly LoadGlbFromUriExternalImageStatus[];
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

export async function decodeGlbExternalImage(input: {
  readonly image: unknown;
  readonly imageIndex: number;
  readonly root: Record<string, unknown>;
  readonly binary: Uint8Array | null;
  readonly sourceUrl: URL;
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
  readonly decodeCache: Map<string, Promise<GltfDecodedImageData>>;
  readonly byteObjectId: (bytes: ArrayBuffer | ArrayBufferView) => number;
  readonly getCreatedBasisTranscoder: () => Promise<Ktx2BasisTranscoder> | null;
  readonly setCreatedBasisTranscoder: (
    promise: Promise<Ktx2BasisTranscoder>,
  ) => void;
}): Promise<GlbExternalImageDecodeTaskResult | null> {
  if (!isRecord(input.image)) {
    return null;
  }

  const source = imageSourceRefFromImage(input.image);

  if (!source.ok) {
    if (
      typeof input.image.uri === "string" ||
      Number.isInteger(input.image.bufferView)
    ) {
      return {
        diagnostics: [
          {
            code: "loadGlbFromUri.unsupportedImageUri",
            severity: "error",
            imageIndex: input.imageIndex,
            ...(typeof input.image.uri === "string"
              ? { uri: input.image.uri }
              : {}),
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
    imageIndex: input.imageIndex,
    externalBufferBytes: input.externalBufferBytes,
    externalImageBytes: input.externalImageBytes,
  });

  if (!imageBytes.ok) {
    return {
      diagnostics: [imageBytes.diagnostic],
      statuses: [
        {
          imageIndex: input.imageIndex,
          sourceKind: externalImageSourceKind(source.source),
          uri: imageStatusUri(source.source),
          status: "blocked",
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
      sourceUrl: input.sourceUrl,
      bytes: imageBytes.bytes,
      byteObjectId: input.byteObjectId,
      ...imageDecodeOptionsKeyField({
        source: source.source,
        ...(input.ktx2TextureCompression === undefined
          ? {}
          : { textureCompression: input.ktx2TextureCompression }),
      }),
    });
    let decodedPromise = input.decodeCache.get(decodeCacheKey);

    if (decodedPromise === undefined) {
      const basisTranscoder =
        input.decodeImageData === undefined
          ? await resolveBasisKtx2Transcoder({
              source: source.source,
              provided: input.basisTranscoder,
              create: input.createBasisKtx2Transcoder,
              getCreated: input.getCreatedBasisTranscoder,
              setCreated: input.setCreatedBasisTranscoder,
            })
          : undefined;

      decodedPromise = loadGltfTextureAsync({
        source: source.source,
        ...(imageBytes.bytes === undefined ? {} : { bytes: imageBytes.bytes }),
        ...(input.decodeImageData === undefined
          ? {}
          : { decodeImageData: input.decodeImageData }),
        ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
        ...(input.ktx2TextureCompression === undefined
          ? {}
          : { ktx2TextureCompression: input.ktx2TextureCompression }),
      }).catch((error: unknown) => {
        input.decodeCache.delete(decodeCacheKey);
        throw error;
      });
      input.decodeCache.set(decodeCacheKey, decodedPromise);
    }

    const decoded = await decodedPromise;

    return {
      decoded: { imageIndex: input.imageIndex, image: decoded },
      diagnostics: [],
      statuses: [
        {
          imageIndex: input.imageIndex,
          sourceKind: externalImageSourceKind(source.source),
          uri: imageStatusUri(source.source),
          status: "loaded",
          byteLength:
            imageBytes.bytes === undefined
              ? decoded.sourceData.bytes.byteLength
              : byteLengthOf(imageBytes.bytes),
          ...(source.source.mimeType === undefined
            ? {}
            : { mimeType: source.source.mimeType }),
          ...(source.source.kind === "uri" &&
          !source.source.uri.startsWith("data:")
            ? { url: new URL(source.source.uri, input.sourceUrl).href }
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
          code: "loadGlbFromUri.imageReadFailed",
          severity: "error",
          imageIndex: input.imageIndex,
          uri,
          message: errorMessage(
            error,
            `Decoding GLB image ${input.imageIndex} '${uri}' failed.`,
          ),
        },
      ],
      statuses: [
        {
          imageIndex: input.imageIndex,
          sourceKind: externalImageSourceKind(source.source),
          uri,
          status: "blocked",
          byteLength:
            imageBytes.bytes === undefined
              ? null
              : byteLengthOf(imageBytes.bytes),
          ...(source.source.mimeType === undefined
            ? {}
            : { mimeType: source.source.mimeType }),
          diagnosticCode: "loadGlbFromUri.imageReadFailed",
        },
      ],
    };
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
