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
    options?: Ktx2BasisTranscodeOptions,
  ) => GltfDecodedImageData;
}

export type Ktx2TextureCompressionFeature =
  | "texture-compression-astc"
  | "texture-compression-bc"
  | "texture-compression-etc2";

export interface Ktx2TextureCompressionSupport {
  readonly astc?: boolean;
  readonly bc?: boolean;
  readonly etc2?: boolean;
}

export interface Ktx2FeatureSetLike {
  readonly has?: (feature: Ktx2TextureCompressionFeature) => boolean;
}

export interface Ktx2BasisTranscodeOptions {
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}

export interface Ktx2DecodeOptions extends Ktx2BasisTranscodeOptions {
  readonly basisTranscoder?: Ktx2BasisTranscoder;
}

export type BasisKtx2Encoding = "etc1s" | "uastc";

export interface BasisKtx2TranscodeTarget {
  readonly transcoderFormat: number;
  readonly textureFormat: TextureFormat;
  readonly blockWidth: number;
  readonly blockHeight: number;
  readonly blockByteLength: number;
}

interface BasisModuleFactoryInput {
  readonly wasmBinary: ArrayBuffer;
}

export interface BasisModule {
  readonly initializeBasis: () => void;
  readonly KTX2File: new (bytes: Uint8Array) => BasisKtx2File;
}

export interface BasisKtx2File {
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

export type BasisModuleFactory = (
  input: BasisModuleFactoryInput,
) => PromiseLike<BasisModule>;
