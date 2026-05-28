import type { TextureFormat } from "../materials/index.js";
import {
  BASIS_TRANSCODER_FORMAT_ASTC_4X4,
  BASIS_TRANSCODER_FORMAT_BC7_M5,
  BASIS_TRANSCODER_FORMAT_ETC1,
  BASIS_TRANSCODER_FORMAT_ETC2,
  BASIS_TRANSCODER_FORMAT_RGBA32,
  KHR_DF_TRANSFER_SRGB,
} from "./ktx2-constants.js";
import type {
  BasisKtx2Encoding,
  BasisKtx2TranscodeTarget,
  Ktx2ContainerInfo,
  Ktx2TextureCompressionSupport,
} from "./ktx2-types.js";

export function chooseBasisKtx2TranscodeTarget(input: {
  readonly encoding: BasisKtx2Encoding;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly srgb: boolean;
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}): BasisKtx2TranscodeTarget {
  const support = input.textureCompression ?? {};
  const compressedCandidates =
    input.encoding === "uastc"
      ? [
          support.astc === true ? astc4x4Target(input.srgb) : null,
          support.bc === true ? bc7Target(input.srgb) : null,
          support.etc2 === true ? etc2Target(input.hasAlpha, input.srgb) : null,
        ]
      : [
          support.etc2 === true ? etc2Target(input.hasAlpha, input.srgb) : null,
          support.bc === true ? bc7Target(input.srgb) : null,
          support.astc === true ? astc4x4Target(input.srgb) : null,
        ];

  for (const candidate of compressedCandidates) {
    if (candidate !== null && textureDimensionsFitTarget(input, candidate)) {
      return candidate;
    }
  }

  return rgba32Target(input.srgb);
}

export function textureLevelBytesPerRow(
  width: number,
  target: BasisKtx2TranscodeTarget,
): number {
  return Math.ceil(width / target.blockWidth) * target.blockByteLength;
}

export function textureLevelRowsPerImage(
  height: number,
  target: BasisKtx2TranscodeTarget,
): number {
  return Math.ceil(height / target.blockHeight);
}

export function textureFormatFromDfdTransfer(
  container: Ktx2ContainerInfo,
  bytes: Uint8Array,
): TextureFormat {
  return ktx2DfdTransferFunction(container, bytes) === KHR_DF_TRANSFER_SRGB
    ? "rgba8unorm-srgb"
    : "rgba8unorm";
}

function rgba32Target(srgb: boolean): BasisKtx2TranscodeTarget {
  return {
    transcoderFormat: BASIS_TRANSCODER_FORMAT_RGBA32,
    textureFormat: srgb ? "rgba8unorm-srgb" : "rgba8unorm",
    blockWidth: 1,
    blockHeight: 1,
    blockByteLength: 4,
  };
}

function etc2Target(
  hasAlpha: boolean,
  srgb: boolean,
): BasisKtx2TranscodeTarget {
  return hasAlpha
    ? {
        transcoderFormat: BASIS_TRANSCODER_FORMAT_ETC2,
        textureFormat: srgb ? "etc2-rgba8unorm-srgb" : "etc2-rgba8unorm",
        blockWidth: 4,
        blockHeight: 4,
        blockByteLength: 16,
      }
    : {
        transcoderFormat: BASIS_TRANSCODER_FORMAT_ETC1,
        textureFormat: srgb ? "etc2-rgb8unorm-srgb" : "etc2-rgb8unorm",
        blockWidth: 4,
        blockHeight: 4,
        blockByteLength: 8,
      };
}

function bc7Target(srgb: boolean): BasisKtx2TranscodeTarget {
  return {
    transcoderFormat: BASIS_TRANSCODER_FORMAT_BC7_M5,
    textureFormat: srgb ? "bc7-rgba-unorm-srgb" : "bc7-rgba-unorm",
    blockWidth: 4,
    blockHeight: 4,
    blockByteLength: 16,
  };
}

function astc4x4Target(srgb: boolean): BasisKtx2TranscodeTarget {
  return {
    transcoderFormat: BASIS_TRANSCODER_FORMAT_ASTC_4X4,
    textureFormat: srgb ? "astc-4x4-unorm-srgb" : "astc-4x4-unorm",
    blockWidth: 4,
    blockHeight: 4,
    blockByteLength: 16,
  };
}

function textureDimensionsFitTarget(
  input: { readonly width: number; readonly height: number },
  target: BasisKtx2TranscodeTarget,
): boolean {
  if (target.blockWidth === 1 && target.blockHeight === 1) {
    return true;
  }

  return input.width > 0 && input.height > 0;
}

function ktx2DfdTransferFunction(
  container: Ktx2ContainerInfo,
  bytes: Uint8Array,
): number | null {
  if (container.dfdByteLength < 15) {
    return null;
  }

  const byteOffset = container.dfdByteOffset + 14;
  if (byteOffset >= bytes.byteLength) {
    return null;
  }

  return bytes[byteOffset] ?? null;
}
