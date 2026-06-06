import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  createBasisUniversalKtx2Transcoder,
  decodeKtx2TextureDataAsync,
  parseKtx2Container,
} from "@aperture-engine/render";
import { decodeKtx2TextureData } from "../../packages/render/src/assets/ktx2-decoder.js";

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

  it("preserves uncompressed KTX2 mip levels as texture source levels", () => {
    const bytes = createKtx2Rgba8Bytes({
      vkFormat: 43,
      width: 4,
      height: 4,
      levels: [
        new Uint8Array(4 * 4 * 4).fill(10),
        new Uint8Array(2 * 2 * 4).fill(20),
        new Uint8Array(1 * 1 * 4).fill(30),
      ],
    });

    const container = parseKtx2Container(bytes);
    const decoded = decodeKtx2TextureData(bytes);

    expect(container.levelCount).toBe(3);
    expect(decoded.sourceData.mipLevels).toHaveLength(3);
    expect(decoded.sourceData.mipLevels?.map((level) => level.width)).toEqual([
      4, 2, 1,
    ]);
    expect(decoded.sourceData.mipLevels?.map((level) => level.height)).toEqual([
      4, 2, 1,
    ]);
    expect(
      decoded.sourceData.mipLevels?.map((level) => level.bytes[0]),
    ).toEqual([10, 20, 30]);
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

  it("transcodes a committed BasisU ETC1S KTX2 sample into uploadable RGBA8 bytes", async () => {
    const [ktx2Bytes, jsSource, wasmBinary] = await Promise.all([
      readFile(new URL("./fixtures/basis-etc1s.ktx2", import.meta.url)),
      readFile(
        new URL(
          "../../examples/assets/basis/basis_transcoder.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../examples/assets/basis/basis_transcoder.wasm",
          import.meta.url,
        ),
      ),
    ]);
    const transcoder = await createBasisUniversalKtx2Transcoder({
      jsSource,
      wasmBinary,
    });

    const decoded = await decodeKtx2TextureDataAsync(ktx2Bytes, {
      basisTranscoder: transcoder,
    });

    expect(decoded).toMatchObject({
      width: 40,
      height: 40,
      format: "rgba8unorm-srgb",
      sourceData: {
        bytesPerRow: 160,
        rowsPerImage: 40,
      },
    });
    expect(decoded.sourceData.mipLevels).toHaveLength(6);
    expect(decoded.sourceData.mipLevels?.map((level) => level.width)).toEqual([
      40, 20, 10, 5, 2, 1,
    ]);
    expect(decoded.sourceData.bytes).toHaveLength(40 * 40 * 4);
    expect(Array.from(decoded.sourceData.bytes.slice(0, 4))).toEqual([
      181, 148, 16, 255,
    ]);
  });

  it("transcodes BasisU KTX2 to native compressed texture bytes when supported", async () => {
    const [ktx2Bytes, jsSource, wasmBinary] = await Promise.all([
      readFile(new URL("./fixtures/basis-etc1s.ktx2", import.meta.url)),
      readFile(
        new URL(
          "../../examples/assets/basis/basis_transcoder.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../examples/assets/basis/basis_transcoder.wasm",
          import.meta.url,
        ),
      ),
    ]);
    const transcoder = await createBasisUniversalKtx2Transcoder({
      jsSource,
      wasmBinary,
    });

    const decoded = await decodeKtx2TextureDataAsync(ktx2Bytes, {
      basisTranscoder: transcoder,
      textureCompression: { etc2: true },
    });

    expect(decoded.width).toBe(40);
    expect(decoded.height).toBe(40);
    expect(["etc2-rgb8unorm-srgb", "etc2-rgba8unorm-srgb"]).toContain(
      decoded.format,
    );
    expect(decoded.sourceData.mipLevels).toHaveLength(6);
    expect(decoded.sourceData.rowsPerImage).toBe(10);
    expect(decoded.sourceData.bytes.byteLength).toBeLessThan(40 * 40 * 4);
  });

  it("keeps async BasisU decode honest when no transcoder is configured", async () => {
    const ktx2Bytes = await readFile(
      new URL("./fixtures/basis-etc1s.ktx2", import.meta.url),
    );

    await expect(decodeKtx2TextureDataAsync(ktx2Bytes)).rejects.toThrow(
      /require a configured Basis Universal transcoder/u,
    );
  });
});

export function createKtx2Rgba8Bytes(input: {
  readonly vkFormat: number;
  readonly width: number;
  readonly height: number;
  readonly pixels?: Uint8Array;
  readonly levels?: readonly Uint8Array[];
  readonly supercompressionScheme?: number;
}): Uint8Array {
  const headerByteLength = 80;
  const levelIndexByteLength = 24;
  const levels = input.levels ?? [
    input.pixels ?? new Uint8Array(input.width * input.height * 4),
  ];
  const levelIndexLength = levelIndexByteLength * levels.length;
  const dataOffset = headerByteLength + levelIndexLength;
  const dataByteLength = levels.reduce(
    (total, level) => total + level.byteLength,
    0,
  );
  const bytes = new Uint8Array(dataOffset + dataByteLength);
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
  view.setUint32(40, levels.length, true);
  view.setUint32(44, input.supercompressionScheme ?? 0, true);

  let levelOffset = dataOffset;

  levels.forEach((level, index) => {
    const indexOffset = headerByteLength + index * levelIndexByteLength;

    view.setBigUint64(indexOffset, BigInt(levelOffset), true);
    view.setBigUint64(indexOffset + 8, BigInt(level.byteLength), true);
    view.setBigUint64(indexOffset + 16, BigInt(level.byteLength), true);
    bytes.set(level, levelOffset);
    levelOffset += level.byteLength;
  });

  return bytes;
}
