import type {
  GltfDecodedImageData,
  TextureFormat,
} from "../materials/index.js";

export interface Ktx2LevelIndex {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly uncompressedByteLength: number;
}

export interface Ktx2ContainerInfo {
  readonly vkFormat: number;
  readonly typeSize: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly pixelDepth: number;
  readonly layerCount: number;
  readonly faceCount: number;
  readonly levelCount: number;
  readonly supercompressionScheme: number;
  readonly dfdByteOffset: number;
  readonly dfdByteLength: number;
  readonly kvdByteOffset: number;
  readonly kvdByteLength: number;
  readonly sgdByteOffset: number;
  readonly sgdByteLength: number;
  readonly levels: readonly Ktx2LevelIndex[];
}

const KTX2_IDENTIFIER = new Uint8Array([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const KTX2_HEADER_BYTE_LENGTH = 80;
const KTX2_LEVEL_INDEX_BYTE_LENGTH = 24;
const KTX2_SUPERCOMPRESSION_NONE = 0;
const VK_FORMAT_R8G8B8A8_UNORM = 37;
const VK_FORMAT_R8G8B8A8_SRGB = 43;

export function parseKtx2Container(
  source: ArrayBuffer | ArrayBufferView,
): Ktx2ContainerInfo {
  const bytes = bytesView(source);

  if (bytes.byteLength < KTX2_HEADER_BYTE_LENGTH) {
    throw new Error("KTX2 data is too small to contain a header.");
  }

  for (let index = 0; index < KTX2_IDENTIFIER.byteLength; index += 1) {
    if (bytes[index] !== KTX2_IDENTIFIER[index]) {
      throw new Error("KTX2 data has an invalid file identifier.");
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = {
    vkFormat: view.getUint32(12, true),
    typeSize: view.getUint32(16, true),
    pixelWidth: view.getUint32(20, true),
    pixelHeight: view.getUint32(24, true),
    pixelDepth: view.getUint32(28, true),
    layerCount: view.getUint32(32, true),
    faceCount: view.getUint32(36, true),
    levelCount: view.getUint32(40, true),
    supercompressionScheme: view.getUint32(44, true),
    dfdByteOffset: view.getUint32(48, true),
    dfdByteLength: view.getUint32(52, true),
    kvdByteOffset: view.getUint32(56, true),
    kvdByteLength: view.getUint32(60, true),
    sgdByteOffset: readUint64(view, 64),
    sgdByteLength: readUint64(view, 72),
  };

  if (header.pixelWidth <= 0 || header.pixelHeight <= 0) {
    throw new Error("KTX2 texture dimensions must be positive.");
  }
  if (header.faceCount !== 1) {
    throw new Error("Only 2D KTX2 textures with one face are supported.");
  }
  if (header.pixelDepth !== 0) {
    throw new Error("3D KTX2 textures are not supported.");
  }
  if (header.layerCount > 1) {
    throw new Error("Array KTX2 textures are not supported.");
  }

  const levelCount = Math.max(1, header.levelCount);
  const levelIndexEnd =
    KTX2_HEADER_BYTE_LENGTH + levelCount * KTX2_LEVEL_INDEX_BYTE_LENGTH;
  if (bytes.byteLength < levelIndexEnd) {
    throw new Error("KTX2 data is too small to contain the level index.");
  }

  const levels: Ktx2LevelIndex[] = [];
  for (let level = 0; level < levelCount; level += 1) {
    const offset =
      KTX2_HEADER_BYTE_LENGTH + level * KTX2_LEVEL_INDEX_BYTE_LENGTH;
    const byteOffset = readUint64(view, offset);
    const byteLength = readUint64(view, offset + 8);
    const uncompressedByteLength = readUint64(view, offset + 16);
    const byteEnd = byteOffset + byteLength;

    if (byteEnd > bytes.byteLength) {
      throw new Error(`KTX2 level ${level} byte range exceeds the input.`);
    }

    levels.push({ byteOffset, byteLength, uncompressedByteLength });
  }

  return { ...header, levels };
}

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

function bytesView(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function readUint64(view: DataView, byteOffset: number): number {
  const value = view.getBigUint64(byteOffset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "KTX2 64-bit offset exceeds JavaScript's safe integer range.",
    );
  }
  return Number(value);
}
