import { describe, expect, it } from "vitest";
import {
  createTextureAssetFromGltfTextureAsync,
  createTextureAssetFromGltfTexture,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  gltfTextureMappingReportToJson,
  gltfTextureMappingReportToJsonValue,
  loadGltfTextureAsync,
  type GltfImageDataResolver,
} from "@aperture-engine/render";

const onePixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

const resolveImageData: GltfImageDataResolver = () => decodedImage;

describe("glTF texture mapping", () => {
  it("loads a base64 PNG bufferView through the async image decode contract", async () => {
    const image = await loadGltfTextureAsync({
      source: { kind: "bufferView", bufferView: 0, mimeType: "image/png" },
      bytes: pngBytesFromBase64(onePixelPngBase64),
      decodeImageData: async ({ bytes, mimeType, source }) => {
        const dimensions = pngDimensions(bytes);

        expect(source).toMatchObject({
          kind: "bufferView",
          bufferView: 0,
          mimeType: "image/png",
        });
        expect(mimeType).toBe("image/png");

        return {
          width: dimensions.width,
          height: dimensions.height,
          sourceData: {
            bytes: new Uint8Array([255, 0, 0, 255]),
            bytesPerRow: dimensions.width * 4,
            rowsPerImage: dimensions.height,
          },
        };
      },
    });

    expect(image).toMatchObject({
      width: 1,
      height: 1,
      sourceData: {
        bytesPerRow: 4,
        rowsPerImage: 1,
      },
    });
    expect(Array.from(image.sourceData.bytes)).toEqual([255, 0, 0, 255]);
  });

  it("passes provided image byte ranges to decoders without cloning", async () => {
    const sourceBytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const imageBytes = sourceBytes.subarray(1, 5);
    const decodedInput: { current: Uint8Array | null } = { current: null };

    await loadGltfTextureAsync({
      source: { kind: "bufferView", bufferView: 3, mimeType: "image/png" },
      bytes: imageBytes,
      decodeImageData: async ({ bytes }) => {
        decodedInput.current = bytes;
        return decodedImage;
      },
    });

    expect(decodedInput.current).not.toBeNull();
    expect(decodedInput.current?.buffer).toBe(sourceBytes.buffer);
    expect(decodedInput.current?.byteOffset).toBe(imageBytes.byteOffset);
    expect(decodedInput.current?.byteLength).toBe(imageBytes.byteLength);
  });

  it("reuses browser ImageData bytes without cloning after canvas decode", async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const previousCreateImageBitmap = globals.createImageBitmap;
    const previousOffscreenCanvas = globals.OffscreenCanvas;
    const decodedPixels = new Uint8ClampedArray([12, 34, 56, 255]);
    let bitmapClosed = false;

    class FakeOffscreenCanvas {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}

      getContext(type: string): unknown {
        expect(type).toBe("2d");
        return {
          drawImage: () => {},
          getImageData: () => ({ data: decodedPixels }),
        };
      }
    }

    globals.createImageBitmap = async () => ({
      width: 1,
      height: 1,
      close: () => {
        bitmapClosed = true;
      },
    });
    globals.OffscreenCanvas = FakeOffscreenCanvas;

    try {
      const image = await loadGltfTextureAsync({
        source: { kind: "bufferView", bufferView: 3, mimeType: "image/png" },
        bytes: pngBytesFromBase64(onePixelPngBase64),
      });

      expect(image.sourceData.bytes.buffer).toBe(decodedPixels.buffer);
      expect(image.sourceData.bytes.byteOffset).toBe(decodedPixels.byteOffset);
      expect(image.sourceData.bytes.byteLength).toBe(decodedPixels.byteLength);
      expect(Array.from(image.sourceData.bytes)).toEqual([12, 34, 56, 255]);
      expect(bitmapClosed).toBe(true);
    } finally {
      if (previousCreateImageBitmap === undefined) {
        Reflect.deleteProperty(globals, "createImageBitmap");
      } else {
        globals.createImageBitmap = previousCreateImageBitmap;
      }

      if (previousOffscreenCanvas === undefined) {
        Reflect.deleteProperty(globals, "OffscreenCanvas");
      } else {
        globals.OffscreenCanvas = previousOffscreenCanvas;
      }
    }
  });

  it("maps decoded GLB bufferView image data into a TextureAsset and SamplerAsset", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0, sampler: 0, name: "BaseColorTexture" }],
      images: [{ bufferView: 2, mimeType: "image/png" }],
      samplers: [
        {
          wrapS: GLTF_SAMPLER_WRAP.CLAMP_TO_EDGE,
          wrapT: GLTF_SAMPLER_WRAP.REPEAT,
          magFilter: GLTF_SAMPLER_FILTER.LINEAR,
          minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        },
      ],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report).toMatchObject({
      textureIndex: 0,
      imageIndex: 0,
      samplerIndex: 0,
      texture: {
        label: "BaseColorTexture",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
      },
      sampler: {
        addressModeU: "clamp-to-edge",
        addressModeV: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      },
    });
    expect(report.texture?.sourceData?.bytes.byteLength).toBe(16);
  });

  it("maps decoded image data from an async resolver", async () => {
    const report = await createTextureAssetFromGltfTextureAsync({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0, name: "AsyncBaseColorTexture" }],
      images: [{ bufferView: 0, mimeType: "image/png" }],
      resolveImageData: async () => decodedImage,
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.texture).toMatchObject({
      label: "AsyncBaseColorTexture",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
    });
  });

  it("keeps the sync mapper honest when an async resolver is passed", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0 }],
      images: [{ bufferView: 0, mimeType: "image/png" }],
      resolveImageData: async () => decodedImage,
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.imageResolverFailed",
        severity: "error",
        imageIndex: 0,
      },
    ]);
    expect(report.diagnostics[0]?.message).toContain(
      "createTextureAssetFromGltfTextureAsync",
    );
  });

  it("maps data texture slots to data color space and default sampler state", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "normalTexture",
      textures: [{ source: 0 }],
      images: [{ uri: "normal.png" }],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.sampler).toMatchObject({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });
    expect(report.texture).toMatchObject({
      semantic: "normal",
      colorSpace: "data",
      format: "rgba8unorm",
    });
  });

  it("maps iridescence thickness textures to green-channel data metadata", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "iridescenceThicknessTexture",
      textures: [{ source: 0, name: "FilmThickness" }],
      images: [{ uri: "thickness.png" }],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.texture).toMatchObject({
      label: "FilmThickness",
      semantic: "iridescence-thickness",
      colorSpace: "data",
      format: "rgba8unorm",
    });
  });

  it("maps clearcoat roughness textures to green-channel data metadata", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "clearcoatRoughnessTexture",
      textures: [{ source: 0, name: "CoatingRoughness" }],
      images: [{ uri: "clearcoat-roughness.png" }],
      resolveImageData,
    });

    expect(report.valid).toBe(true);
    expect(report.texture).toMatchObject({
      label: "CoatingRoughness",
      semantic: "clearcoat-roughness",
      colorSpace: "data",
      format: "rgba8unorm",
    });
  });

  it("reports unsupported texture extensions and resolver failures", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "emissiveTexture",
      textures: [
        {
          source: 0,
          extensions: { EXT_texture_webp: { source: 1 } },
        },
      ],
      images: [{ bufferView: 4, mimeType: "image/png" }],
      extensionsRequired: ["EXT_texture_webp"],
      resolveImageData: () => ({
        diagnostics: [
          {
            message: "Decoded image data was not available.",
          },
        ],
      }),
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.sampler).toMatchObject({ kind: "sampler" });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.unsupportedRequiredTextureExtension",
        severity: "error",
        extensionName: "EXT_texture_webp",
      },
      {
        code: "gltfTexture.imageResolverFailed",
        severity: "error",
        imageIndex: 0,
        message: "Decoded image data was not available.",
      },
    ]);
  });

  it("maps KHR_texture_basisu image sources through image/ktx2 decode", () => {
    const ktx2Bytes = createKtx2Rgba8Bytes({
      vkFormat: 43,
      width: 1,
      height: 1,
      pixels: new Uint8Array([12, 34, 56, 255]),
    });
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ extensions: { KHR_texture_basisu: { source: 1 } } }],
      images: [
        { bufferView: 0, mimeType: "image/png" },
        { bufferView: 1, mimeType: "image/ktx2" },
      ],
      extensionsRequired: ["KHR_texture_basisu"],
      resolveImageData: ({ source }) => {
        expect(source).toEqual({
          kind: "bufferView",
          bufferView: 1,
          mimeType: "image/ktx2",
        });
        return loadGltfTextureAsync({
          source,
          bytes: ktx2Bytes,
        });
      },
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.imageResolverFailed",
        severity: "error",
      },
    ]);
    expect(report.diagnostics[0]?.message).toContain(
      "createTextureAssetFromGltfTextureAsync",
    );
  });

  it("maps async KHR_texture_basisu image sources through image/ktx2 decode", async () => {
    const ktx2Bytes = createKtx2Rgba8Bytes({
      vkFormat: 43,
      width: 1,
      height: 1,
      pixels: new Uint8Array([12, 34, 56, 255]),
    });
    const report = await createTextureAssetFromGltfTextureAsync({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ extensions: { KHR_texture_basisu: { source: 1 } } }],
      images: [
        { bufferView: 0, mimeType: "image/png" },
        { bufferView: 1, mimeType: "image/ktx2" },
      ],
      extensionsRequired: ["KHR_texture_basisu"],
      resolveImageData: ({ source }) =>
        loadGltfTextureAsync({
          source,
          bytes: ktx2Bytes,
        }),
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.imageIndex).toBe(1);
    expect(report.texture).toMatchObject({
      width: 1,
      height: 1,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
    });
    expect(Array.from(report.texture?.sourceData?.bytes ?? [])).toEqual([
      12, 34, 56, 255,
    ]);
  });

  it("marks mip-filtered glTF textures with a generated mip chain count", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0, sampler: 0 }],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      samplers: [
        {
          magFilter: GLTF_SAMPLER_FILTER.LINEAR,
          minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        },
      ],
      resolveImageData: () => ({
        width: 256,
        height: 256,
        sourceData: {
          bytes: new Uint8Array(256 * 256 * 4),
          bytesPerRow: 256 * 4,
          rowsPerImage: 256,
        },
      }),
    });

    expect(report.valid).toBe(true);
    expect(report.texture?.mipLevelCount).toBe(9);
  });

  it("loads image/ktx2 data URIs through the built-in KTX2 decoder", async () => {
    const ktx2Bytes = createKtx2Rgba8Bytes({
      vkFormat: 37,
      width: 1,
      height: 1,
      pixels: new Uint8Array([1, 2, 3, 255]),
    });
    const image = await loadGltfTextureAsync({
      source: {
        kind: "uri",
        uri: `data:image/ktx2;base64,${Buffer.from(ktx2Bytes).toString("base64")}`,
      },
    });

    expect(image).toMatchObject({
      width: 1,
      height: 1,
      format: "rgba8unorm",
      sourceData: {
        bytesPerRow: 4,
        rowsPerImage: 1,
      },
    });
    expect(Array.from(image.sourceData.bytes)).toEqual([1, 2, 3, 255]);
  });

  it("reports invalid image and sampler metadata with JSON-safe output", () => {
    const report = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "metallicRoughnessTexture",
      textures: [{ source: 0, sampler: 1 }],
      images: [{ bufferView: 2, mimeType: "image/webp" }],
      samplers: [{}, "bad"],
      resolveImageData,
    });

    expect(report.valid).toBe(false);
    expect(report.texture).toBeNull();
    expect(report.sampler).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfTexture.invalidSamplerIndex",
        severity: "error",
        field: "samplers[1]",
        samplerIndex: 1,
      },
      {
        code: "gltfTexture.unsupportedImageMimeType",
        severity: "error",
        imageIndex: 0,
        value: "image/webp",
      },
    ]);
    expect(JSON.parse(gltfTextureMappingReportToJson(report))).toEqual(
      gltfTextureMappingReportToJsonValue(report),
    );
  });
});

function pngBytesFromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function pngDimensions(bytes: Uint8Array): {
  readonly width: number;
  readonly height: number;
} {
  expect(Array.from(bytes.slice(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function createKtx2Rgba8Bytes(input: {
  readonly vkFormat: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
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
  view.setBigUint64(80, BigInt(dataOffset), true);
  view.setBigUint64(88, BigInt(input.pixels.byteLength), true);
  view.setBigUint64(96, BigInt(input.pixels.byteLength), true);
  bytes.set(input.pixels, dataOffset);
  return bytes;
}
