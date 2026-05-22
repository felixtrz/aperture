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

export interface Ktx2BasisTranscoderSource {
  readonly jsSource?: string;
  readonly jsUrl?: string;
  readonly wasmBinary?: ArrayBuffer | ArrayBufferView;
  readonly wasmUrl?: string;
  readonly fetchText?: (url: string) => PromiseLike<string>;
  readonly fetchBinary?: (
    url: string,
  ) => PromiseLike<ArrayBuffer | ArrayBufferView>;
}

export interface Ktx2BasisTranscoder {
  readonly decode: (
    source: ArrayBuffer | ArrayBufferView,
  ) => GltfDecodedImageData;
}

export interface Ktx2DecodeOptions {
  readonly basisTranscoder?: Ktx2BasisTranscoder;
}

const KTX2_IDENTIFIER = new Uint8Array([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const KTX2_HEADER_BYTE_LENGTH = 80;
const KTX2_LEVEL_INDEX_BYTE_LENGTH = 24;
const KTX2_SUPERCOMPRESSION_NONE = 0;
const KTX2_SUPERCOMPRESSION_BASIS_LZ = 1;
const KTX2_VK_FORMAT_UNDEFINED = 0;
const KHR_DF_TRANSFER_SRGB = 2;
const VK_FORMAT_R8G8B8A8_UNORM = 37;
const VK_FORMAT_R8G8B8A8_SRGB = 43;
const BASIS_TRANSCODER_FORMAT_RGBA32 = 13;

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

  return options.basisTranscoder.decode(source);
}

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
    decode(sourceBytes) {
      return transcodeBasisKtx2TextureData(sourceBytes, basisModule);
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

interface BasisModuleFactoryInput {
  readonly wasmBinary: ArrayBuffer;
}

interface BasisModule {
  readonly initializeBasis: () => void;
  readonly KTX2File: new (bytes: Uint8Array) => BasisKtx2File;
}

interface BasisKtx2File {
  readonly isValid: () => boolean;
  readonly isETC1S?: () => boolean;
  readonly isUASTC?: () => boolean;
  readonly isHDR?: () => boolean;
  readonly getWidth: () => number;
  readonly getHeight: () => number;
  readonly getLevels: () => number;
  readonly getLayers: () => number;
  readonly getFaces: () => number;
  readonly getHasAlpha: () => number;
  readonly startTranscoding: () => number;
  readonly getImageTranscodedSizeInBytes: (
    level: number,
    layer: number,
    face: number,
    format: number,
  ) => number;
  readonly transcodeImage: (
    dst: Uint8Array,
    level: number,
    layer: number,
    face: number,
    format: number,
    decodeFlags: number,
    outputRowPitchInBlocksOrPixels: number,
    outputRowsInPixels: number,
  ) => number;
  readonly close: () => void;
  readonly delete: () => void;
}

type BasisModuleFactory = (
  input: BasisModuleFactoryInput,
) => PromiseLike<BasisModule>;

function transcodeBasisKtx2TextureData(
  source: ArrayBuffer | ArrayBufferView,
  basisModule: BasisModule,
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
        "BasisU HDR KTX2 textures are not supported by the RGBA8 upload path.",
      );
    }

    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const levels = ktx2File.getLevels();
    const faces = ktx2File.getFaces();
    const layers = ktx2File.getLayers() || 1;

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
      BASIS_TRANSCODER_FORMAT_RGBA32,
    );
    const level0 = new Uint8Array(byteLength);
    const ok = ktx2File.transcodeImage(
      level0,
      0,
      0,
      0,
      BASIS_TRANSCODER_FORMAT_RGBA32,
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
      format: textureFormatFromDfdTransfer(container, bytes),
      sourceData: {
        bytes: level0,
        bytesPerRow: width * 4,
        rowsPerImage: height,
      },
    };
  } finally {
    ktx2File.close();
    ktx2File.delete();
  }
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

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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
