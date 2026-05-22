import { describe, expect, it } from "vitest";

import {
  decodeKtx2TextureData,
  parseKtx2Container,
} from "@aperture-engine/core";

describe("KTX2 decoder", () => {
  it("parses and decodes uncompressed RGBA8 KTX2 payloads", () => {
    const bytes = createKtx2Rgba8Bytes({
      vkFormat: 43,
      width: 2,
      height: 1,
      pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
    });

    const container = parseKtx2Container(bytes);
    expect(container).toMatchObject({
      vkFormat: 43,
      pixelWidth: 2,
      pixelHeight: 1,
      levelCount: 1,
      supercompressionScheme: 0,
    });
    expect(container.levels[0]).toMatchObject({
      byteOffset: 104,
      byteLength: 8,
      uncompressedByteLength: 8,
    });

    const decoded = decodeKtx2TextureData(bytes);
    expect(decoded).toMatchObject({
      width: 2,
      height: 1,
      format: "rgba8unorm-srgb",
      sourceData: {
        bytesPerRow: 8,
        rowsPerImage: 1,
      },
    });
    expect(Array.from(decoded.sourceData.bytes)).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255,
    ]);
  });

  it("reports BasisU supercompression as a required transcoder path", () => {
    const bytes = createKtx2Rgba8Bytes({
      vkFormat: 0,
      width: 1,
      height: 1,
      pixels: new Uint8Array([0, 0, 0, 255]),
      supercompressionScheme: 1,
    });

    expect(() => decodeKtx2TextureData(bytes)).toThrow(
      /BasisU supercompression requires a transcoder/u,
    );
  });
});

export function createKtx2Rgba8Bytes(input: {
  readonly vkFormat: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly supercompressionScheme?: number;
}): Uint8Array {
  const headerByteLength = 80;
  const levelIndexByteLength = 24;
  const dataOffset = headerByteLength + levelIndexByteLength;
  const bytes = new Uint8Array(dataOffset + input.pixels.byteLength);
  bytes.set(
    [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a],
    0,
  );

  const view = new DataView(bytes.buffer);
  view.setUint32(12, input.vkFormat, true);
  view.setUint32(16, 1, true);
  view.setUint32(20, input.width, true);
  view.setUint32(24, input.height, true);
  view.setUint32(36, 1, true);
  view.setUint32(40, 1, true);
  view.setUint32(44, input.supercompressionScheme ?? 0, true);
  view.setBigUint64(80, BigInt(dataOffset), true);
  view.setBigUint64(88, BigInt(input.pixels.byteLength), true);
  view.setBigUint64(96, BigInt(input.pixels.byteLength), true);
  bytes.set(input.pixels, dataOffset);
  return bytes;
}
