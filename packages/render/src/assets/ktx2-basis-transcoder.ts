import type {
  GltfDecodedImageData,
  TextureFormat,
} from "../materials/index.js";
import {
  BASIS_TRANSCODER_FORMAT_ASTC_4X4,
  BASIS_TRANSCODER_FORMAT_BC7_M5,
  BASIS_TRANSCODER_FORMAT_ETC1,
  BASIS_TRANSCODER_FORMAT_ETC2,
  BASIS_TRANSCODER_FORMAT_RGBA32,
  KHR_DF_TRANSFER_SRGB,
  KTX2_SUPERCOMPRESSION_BASIS_LZ,
  KTX2_VK_FORMAT_UNDEFINED,
} from "./ktx2-constants.js";
import { parseKtx2Container } from "./ktx2-container.js";
import type {
  BasisKtx2Encoding,
  BasisKtx2File,
  BasisKtx2TranscodeTarget,
  BasisModule,
  BasisModuleFactory,
  Ktx2BasisTranscodeOptions,
  Ktx2BasisTranscoder,
  Ktx2BasisTranscoderSource,
  Ktx2ContainerInfo,
  Ktx2TextureCompressionSupport,
} from "./ktx2-types.js";
import { arrayBufferFromBytes, bytesView } from "./ktx2-utils.js";

export async function createBasisUniversalKtx2Transcoder(
  source: Ktx2BasisTranscoderSource,
): Promise<Ktx2BasisTranscoder> {
  const [jsSource, wasmBinary] = await Promise.all([
    resolveTranscoderJsSource(source),
    resolveTranscoderWasmBinary(source),
  ]);
  const basisFactory = compileBasisFactory(jsSource);
  const basisModule = await basisFactory({
    wasmBinary: arrayBufferFromBytes(wasmBinary),
  });

  if (typeof basisModule.initializeBasis !== "function") {
    throw new Error(
      "Basis Universal transcoder did not expose initializeBasis().",
    );
  }
  if (typeof basisModule.KTX2File !== "function") {
    throw new Error("Basis Universal transcoder does not support KTX2File.");
  }

  basisModule.initializeBasis();

  return {
    decode(sourceBytes, options = {}) {
      return transcodeBasisKtx2TextureData(sourceBytes, basisModule, options);
    },
  };
}

export function transcodeBasisKtx2TextureData(
  source: ArrayBuffer | ArrayBufferView,
  basisModule: BasisModule,
  options: Ktx2BasisTranscodeOptions,
): GltfDecodedImageData {
  const bytes = bytesView(source);
  const container = parseKtx2Container(bytes);

  if (
    container.supercompressionScheme !== KTX2_SUPERCOMPRESSION_BASIS_LZ ||
    container.vkFormat !== KTX2_VK_FORMAT_UNDEFINED
  ) {
    throw new Error("KTX2 payload is not BasisU supercompressed texture data.");
  }

  const ktx2File = new basisModule.KTX2File(new Uint8Array(bytes));

  try {
    if (!ktx2File.isValid()) {
      throw new Error("BasisU KTX2 texture is invalid or unsupported.");
    }
    if (ktx2File.isHDR?.() === true) {
      throw new Error(
        "BasisU HDR KTX2 textures are not supported by the built-in transcoder.",
      );
    }

    const encoding = basisKtx2Encoding(ktx2File);
    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const levels = ktx2File.getLevels();
    const faces = ktx2File.getFaces();
    const layers = ktx2File.getLayers() || 1;
    const hasAlpha = ktx2File.getHasAlpha() !== 0;
    const target = chooseBasisKtx2TranscodeTarget({
      encoding,
      width,
      height,
      hasAlpha,
      srgb: textureFormatFromDfdTransfer(container, bytes).endsWith("-srgb"),
      ...(options.textureCompression === undefined
        ? {}
        : { textureCompression: options.textureCompression }),
    });

    if (width <= 0 || height <= 0 || levels <= 0) {
      throw new Error("BasisU KTX2 texture dimensions are invalid.");
    }
    if (faces !== 1 || layers !== 1) {
      throw new Error(
        "Only single-layer 2D BasisU KTX2 textures are supported.",
      );
    }
    if (ktx2File.startTranscoding() !== 1) {
      throw new Error("BasisU KTX2 transcoder failed to start.");
    }

    const byteLength = ktx2File.getImageTranscodedSizeInBytes(
      0,
      0,
      0,
      target.transcoderFormat,
    );
    const level0 = new Uint8Array(byteLength);
    const ok = ktx2File.transcodeImage(
      level0,
      0,
      0,
      0,
      target.transcoderFormat,
      0,
      -1,
      -1,
    );

    if (ok !== 1) {
      throw new Error("BasisU KTX2 level 0 transcode failed.");
    }

    return {
      width,
      height,
      format: target.textureFormat,
      sourceData: {
        bytes: level0,
        bytesPerRow: textureLevelBytesPerRow(width, target),
        rowsPerImage: textureLevelRowsPerImage(height, target),
      },
    };
  } finally {
    ktx2File.close();
    ktx2File.delete();
  }
}

function basisKtx2Encoding(ktx2File: BasisKtx2File): BasisKtx2Encoding {
  if (ktx2File.isETC1S?.() === true) {
    return "etc1s";
  }
  if (ktx2File.isUASTC?.() === true) {
    return "uastc";
  }
  throw new Error("BasisU KTX2 texture uses an unknown Basis encoding.");
}

function chooseBasisKtx2TranscodeTarget(input: {
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

function textureLevelBytesPerRow(
  width: number,
  target: BasisKtx2TranscodeTarget,
): number {
  return Math.ceil(width / target.blockWidth) * target.blockByteLength;
}

function textureLevelRowsPerImage(
  height: number,
  target: BasisKtx2TranscodeTarget,
): number {
  return Math.ceil(height / target.blockHeight);
}

function textureFormatFromDfdTransfer(
  container: Ktx2ContainerInfo,
  bytes: Uint8Array,
): TextureFormat {
  return ktx2DfdTransferFunction(container, bytes) === KHR_DF_TRANSFER_SRGB
    ? "rgba8unorm-srgb"
    : "rgba8unorm";
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

async function resolveTranscoderJsSource(
  source: Ktx2BasisTranscoderSource,
): Promise<string> {
  if (source.jsSource !== undefined) {
    return source.jsSource;
  }
  if (source.jsUrl === undefined) {
    throw new Error("Basis Universal transcoder requires jsSource or jsUrl.");
  }

  if (source.fetchText !== undefined) {
    return source.fetchText(source.jsUrl);
  }
  if (typeof fetch !== "function") {
    throw new Error(
      "No fetch implementation is available for Basis Universal JS glue.",
    );
  }

  const response = await fetch(source.jsUrl);
  if (!response.ok) {
    throw new Error(
      `Fetching Basis Universal JS glue failed with HTTP ${response.status}.`,
    );
  }
  return response.text();
}

async function resolveTranscoderWasmBinary(
  source: Ktx2BasisTranscoderSource,
): Promise<Uint8Array> {
  if (source.wasmBinary !== undefined) {
    return new Uint8Array(bytesView(source.wasmBinary));
  }
  if (source.wasmUrl === undefined) {
    throw new Error(
      "Basis Universal transcoder requires wasmBinary or wasmUrl.",
    );
  }

  if (source.fetchBinary !== undefined) {
    return new Uint8Array(bytesView(await source.fetchBinary(source.wasmUrl)));
  }
  if (typeof fetch !== "function") {
    throw new Error(
      "No fetch implementation is available for Basis Universal WASM.",
    );
  }

  const response = await fetch(source.wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Fetching Basis Universal WASM failed with HTTP ${response.status}.`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function compileBasisFactory(jsSource: string): BasisModuleFactory {
  const moduleObject: { exports?: unknown } = {};
  const evaluator = new Function(
    "module",
    "exports",
    "process",
    "__filename",
    "__dirname",
    "window",
    "document",
    "importScripts",
    `${jsSource}\nreturn module.exports || BASIS;`,
  ) as (
    module: { exports?: unknown },
    exports: Record<string, unknown>,
    processValue: undefined,
    filename: undefined,
    dirname: undefined,
    windowValue: Record<string, unknown>,
    documentValue: undefined,
    importScriptsValue: undefined,
  ) => unknown;
  const factory = evaluator(
    moduleObject,
    {},
    undefined,
    undefined,
    undefined,
    {},
    undefined,
    undefined,
  );

  if (typeof factory !== "function") {
    throw new Error("Basis Universal JS glue did not expose a factory.");
  }

  return factory as BasisModuleFactory;
}
