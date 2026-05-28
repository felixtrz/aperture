import type {
  GltfDecodedImageData,
  TextureFormat,
} from "../materials/index.js";
import {
  KTX2_SUPERCOMPRESSION_BASIS_LZ,
  KTX2_SUPERCOMPRESSION_NONE,
  KTX2_VK_FORMAT_UNDEFINED,
  VK_FORMAT_R8G8B8A8_SRGB,
  VK_FORMAT_R8G8B8A8_UNORM,
} from "./ktx2-constants.js";
import { parseKtx2Container } from "./ktx2-container.js";
import type {
  Ktx2DecodeOptions,
  Ktx2FeatureSetLike,
  Ktx2TextureCompressionFeature,
  Ktx2TextureCompressionSupport,
} from "./ktx2-types.js";
import { bytesView, featureSetHas } from "./ktx2-utils.js";

export { parseKtx2Container } from "./ktx2-container.js";
export { createBasisUniversalKtx2Transcoder } from "./ktx2-basis-transcoder.js";
export type {
  Ktx2BasisTranscodeOptions,
  Ktx2BasisTranscoder,
  Ktx2BasisTranscoderSource,
  Ktx2ContainerInfo,
  Ktx2DecodeOptions,
  Ktx2FeatureSetLike,
  Ktx2LevelIndex,
  Ktx2TextureCompressionFeature,
  Ktx2TextureCompressionSupport,
} from "./ktx2-types.js";

export function decodeKtx2TextureData(
  source: ArrayBuffer | ArrayBufferView,
): GltfDecodedImageData {
  const bytes = bytesView(source);
  const container = parseKtx2Container(bytes);

  if (container.supercompressionScheme !== KTX2_SUPERCOMPRESSION_NONE) {
    throw new Error(
      "Only uncompressed KTX2 textures are supported by the built-in decoder; BasisU supercompression requires a transcoder.",
    );
  }

  const format = textureFormatFromVkFormat(container.vkFormat);
  const level = container.levels[0];
  if (level === undefined) {
    throw new Error("KTX2 texture does not contain a level 0 payload.");
  }

  const expectedByteLength = container.pixelWidth * container.pixelHeight * 4;
  if (level.byteLength < expectedByteLength) {
    throw new Error("KTX2 level 0 payload is smaller than expected.");
  }

  const levelBytes = bytes.subarray(
    level.byteOffset,
    level.byteOffset + expectedByteLength,
  );

  return {
    width: container.pixelWidth,
    height: container.pixelHeight,
    format,
    sourceData: {
      bytes: new Uint8Array(levelBytes),
      bytesPerRow: container.pixelWidth * 4,
      rowsPerImage: container.pixelHeight,
    },
  };
}

export async function decodeKtx2TextureDataAsync(
  source: ArrayBuffer | ArrayBufferView,
  options: Ktx2DecodeOptions = {},
): Promise<GltfDecodedImageData> {
  const container = parseKtx2Container(source);

  if (container.supercompressionScheme === KTX2_SUPERCOMPRESSION_NONE) {
    return decodeKtx2TextureData(source);
  }

  if (
    container.supercompressionScheme !== KTX2_SUPERCOMPRESSION_BASIS_LZ ||
    container.vkFormat !== KTX2_VK_FORMAT_UNDEFINED
  ) {
    throw new Error(
      `Unsupported KTX2 supercompression scheme ${container.supercompressionScheme}.`,
    );
  }

  if (options.basisTranscoder === undefined) {
    throw new Error(
      "BasisU-compressed KTX2 textures require a configured Basis Universal transcoder.",
    );
  }

  return options.basisTranscoder.decode(source, options);
}

export function createKtx2TextureCompressionSupportFromFeatures(
  features:
    | Ktx2FeatureSetLike
    | Iterable<Ktx2TextureCompressionFeature | string>
    | null
    | undefined,
): Ktx2TextureCompressionSupport {
  return {
    astc: featureSetHas(features, "texture-compression-astc"),
    bc: featureSetHas(features, "texture-compression-bc"),
    etc2: featureSetHas(features, "texture-compression-etc2"),
  };
}

function textureFormatFromVkFormat(vkFormat: number): TextureFormat {
  switch (vkFormat) {
    case VK_FORMAT_R8G8B8A8_UNORM:
      return "rgba8unorm";
    case VK_FORMAT_R8G8B8A8_SRGB:
      return "rgba8unorm-srgb";
    default:
      throw new Error(`Unsupported KTX2 vkFormat ${vkFormat}.`);
  }
}
