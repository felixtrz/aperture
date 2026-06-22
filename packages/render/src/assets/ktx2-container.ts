import {
  KTX2_HEADER_BYTE_LENGTH,
  KTX2_IDENTIFIER,
  KTX2_LEVEL_INDEX_BYTE_LENGTH,
} from "./ktx2-constants.js";
import type { Ktx2ContainerInfo, Ktx2LevelIndex } from "./ktx2-types.js";
import { bytesView, readUint64 } from "./ktx2-utils.js";

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
