import type {
  GltfDecodedImageData,
  GltfImageBytesDecoder,
} from "../materials/gltf-texture-types.js";
import { decodeGltfExternalImage } from "./gltf-uri-image-decode-task.js";
import { mapWithConcurrency } from "./gltf-uri-image-merge.js";
import type {
  LoadGltfFromUriCache,
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriExternalImageStatus,
} from "./gltf-uri-loader.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export {
  createMergedImageDataResolver,
  normalizeConcurrency,
} from "./gltf-uri-image-merge.js";

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
    ({ image, imageIndex }) =>
      decodeGltfExternalImage({
        image,
        imageIndex,
        root: input.root,
        sourceUrl,
        externalBufferBytes: input.externalBufferBytes,
        externalImageBytes: input.externalImageBytes,
        ...(input.decodeImageData === undefined
          ? {}
          : { decodeImageData: input.decodeImageData }),
        ...(input.basisTranscoder === undefined
          ? {}
          : { basisTranscoder: input.basisTranscoder }),
        ...(input.createBasisKtx2Transcoder === undefined
          ? {}
          : { createBasisKtx2Transcoder: input.createBasisKtx2Transcoder }),
        ...(input.ktx2TextureCompression === undefined
          ? {}
          : { ktx2TextureCompression: input.ktx2TextureCompression }),
        decodeCache,
        byteObjectId,
        getCreatedBasisTranscoder: () => createdBasisTranscoder,
        setCreatedBasisTranscoder: (promise) => {
          createdBasisTranscoder = promise;
        },
      }),
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
