import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "../assets/ktx2-decoder.js";
import type { GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type {
  SamplerAsset,
  TextureAsset,
  TextureFormat,
  TextureSourceData,
} from "./types.js";

export type GltfTextureMappingDiagnosticSeverity = "error" | "warning";

export type GltfTextureMappingDiagnosticCode =
  | "gltfTexture.malformedTexture"
  | "gltfTexture.invalidTextureSource"
  | "gltfTexture.invalidSamplerIndex"
  | "gltfTexture.malformedImage"
  | "gltfTexture.missingImageSource"
  | "gltfTexture.unsupportedImageMimeType"
  | "gltfTexture.unsupportedTextureExtension"
  | "gltfTexture.unsupportedRequiredTextureExtension"
  | "gltfTexture.imageResolverFailed"
  | "gltfTexture.invalidDecodedImage"
  | "gltfTexture.invalidSampler";

export type GltfTextureDiagnosticValue = string | number | boolean | null;

export interface GltfTextureMappingDiagnostic {
  readonly code: GltfTextureMappingDiagnosticCode;
  readonly severity: GltfTextureMappingDiagnosticSeverity;
  readonly message: string;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly field?: string;
  readonly imageIndex?: number;
  readonly samplerIndex?: number;
  readonly extensionName?: string;
  readonly value?: GltfTextureDiagnosticValue;
}

export type GltfImageSourceRef =
  | {
      readonly kind: "uri";
      readonly uri: string;
      readonly mimeType?: string;
    }
  | {
      readonly kind: "bufferView";
      readonly bufferView: number;
      readonly mimeType: string;
    };

export interface GltfDecodedImageData {
  readonly width: number;
  readonly height: number;
  readonly format?: TextureFormat;
  readonly sourceData: TextureSourceData;
}

export interface GltfImageDataResolverInput {
  readonly textureIndex: number;
  readonly imageIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly image: Record<string, unknown>;
  readonly source: GltfImageSourceRef;
}

export interface GltfImageDataResolverDiagnostic {
  readonly code?: GltfTextureMappingDiagnosticCode;
  readonly severity?: GltfTextureMappingDiagnosticSeverity;
  readonly message: string;
  readonly field?: string;
  readonly value?: GltfTextureDiagnosticValue;
}

export interface GltfImageDataResolverReport {
  readonly image?: GltfDecodedImageData | null;
  readonly diagnostics?: readonly GltfImageDataResolverDiagnostic[];
}

export type GltfImageDataResolverResult =
  | GltfDecodedImageData
  | GltfImageDataResolverReport
  | null
  | undefined;

export type GltfImageDataResolverAsyncResult =
  | GltfImageDataResolverResult
  | PromiseLike<GltfImageDataResolverResult>;

export type GltfImageDataResolver = (
  input: GltfImageDataResolverInput,
) => GltfImageDataResolverAsyncResult;

export interface GltfImageFetchInput {
  readonly uri: string;
  readonly source: GltfImageSourceRef;
  readonly mimeType?: string;
}

export type GltfImageFetchResult =
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | Response;

export type GltfImageBytesFetcher = (
  input: GltfImageFetchInput,
) => PromiseLike<GltfImageFetchResult>;

export interface GltfImageBytesDecoderInput {
  readonly source: GltfImageSourceRef;
  readonly bytes: Uint8Array;
  readonly mimeType?: string;
}

export type GltfImageBytesDecoder = (
  input: GltfImageBytesDecoderInput,
) => GltfDecodedImageData | PromiseLike<GltfDecodedImageData>;

export interface GltfTextureAsyncLoadSource {
  readonly source: GltfImageSourceRef;
  readonly bytes?: ArrayBuffer | ArrayBufferView;
  readonly fetchImageBytes?: GltfImageBytesFetcher;
  readonly decodeImageData?: GltfImageBytesDecoder;
  readonly basisTranscoder?: Ktx2BasisTranscoder;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}

export interface GltfTextureMappingOptions {
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly textures: readonly unknown[];
  readonly images: readonly unknown[];
  readonly samplers?: readonly unknown[];
  readonly resolveImageData: GltfImageDataResolver;
  readonly label?: string;
  readonly extensionsRequired?: readonly string[];
}

export interface GltfTextureMappingReport {
  readonly valid: boolean;
  readonly texture: TextureAsset | null;
  readonly sampler: SamplerAsset | null;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly imageIndex?: number;
  readonly samplerIndex?: number;
  readonly diagnostics: readonly GltfTextureMappingDiagnostic[];
}

export interface GltfTextureMappingReportJsonValue {
  readonly valid: boolean;
  readonly texture: Record<string, unknown> | null;
  readonly sampler: SamplerAsset | null;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly imageIndex?: number;
  readonly samplerIndex?: number;
  readonly diagnostics: readonly GltfTextureMappingDiagnostic[];
}

export type PreparedGltfTextureMapping =
  | {
      readonly kind: "report";
      readonly report: GltfTextureMappingReport;
    }
  | {
      readonly kind: "image";
      readonly options: GltfTextureMappingOptions;
      readonly diagnostics: GltfTextureMappingDiagnostic[];
      readonly texture: Record<string, unknown>;
      readonly image: Record<string, unknown>;
      readonly imageIndex: number;
      readonly samplerIndex?: number | undefined;
      readonly sampler: SamplerAsset | null;
      readonly source: GltfImageSourceRef;
    };
