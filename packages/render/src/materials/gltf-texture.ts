import { createTextureAsset } from "./factories.js";
import {
  createSamplerAssetFromGltfSampler,
  type GltfSamplerMappingDiagnostic,
  type GltfSamplerSource,
} from "./gltf-sampler.js";
import type { GltfMaterialTextureSlot } from "./gltf-material.js";
import type {
  SamplerAsset,
  TextureAsset,
  TextureColorSpace,
  TextureFormat,
  TextureSemantic,
  TextureSourceData,
} from "./types.js";
import {
  decodeKtx2TextureDataAsync,
  type Ktx2BasisTranscoder,
  type Ktx2TextureCompressionSupport,
} from "../assets/ktx2-decoder.js";

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

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/ktx2",
]);
const UNSUPPORTED_TEXTURE_EXTENSIONS = new Set([
  "EXT_texture_webp",
  "EXT_texture_avif",
]);

type PreparedGltfTextureMapping =
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

export function createTextureAssetFromGltfTexture(
  options: GltfTextureMappingOptions,
): GltfTextureMappingReport {
  const prepared = prepareGltfTextureMapping(options);

  if (prepared.kind === "report") {
    return prepared.report;
  }

  const decoded = resolveDecodedImage({
    options,
    image: prepared.image,
    imageIndex: prepared.imageIndex,
    source: prepared.source,
    diagnostics: prepared.diagnostics,
  });

  return createTextureMappingReportFromDecoded({
    ...prepared,
    decoded,
  });
}

export async function createTextureAssetFromGltfTextureAsync(
  options: GltfTextureMappingOptions,
): Promise<GltfTextureMappingReport> {
  const prepared = prepareGltfTextureMapping(options);

  if (prepared.kind === "report") {
    return prepared.report;
  }

  const decoded = await resolveDecodedImageAsync({
    options,
    image: prepared.image,
    imageIndex: prepared.imageIndex,
    source: prepared.source,
    diagnostics: prepared.diagnostics,
  });

  return createTextureMappingReportFromDecoded({
    ...prepared,
    decoded,
  });
}

export async function loadGltfTextureAsync(
  source: GltfTextureAsyncLoadSource,
): Promise<GltfDecodedImageData> {
  const bytes = await loadGltfImageBytes(source);
  const mimeType = mimeTypeFromImageSource(source.source);

  if (mimeType === "image/ktx2" && source.decodeImageData === undefined) {
    const image = await decodeKtx2TextureDataAsync(bytes, {
      ...(source.basisTranscoder === undefined
        ? {}
        : { basisTranscoder: source.basisTranscoder }),
      ...(source.ktx2TextureCompression === undefined
        ? {}
        : { textureCompression: source.ktx2TextureCompression }),
    });

    if (!validDecodedImage(image)) {
      throw new Error(
        "Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.",
      );
    }

    return image;
  }

  const decoder = source.decodeImageData ?? decodeImageBytesWithBrowserCanvas;
  const image = await decoder({
    source: source.source,
    bytes,
    ...(mimeType === undefined ? {} : { mimeType }),
  });

  if (!validDecodedImage(image)) {
    throw new Error(
      "Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.",
    );
  }

  return image;
}

function prepareGltfTextureMapping(
  options: GltfTextureMappingOptions,
): PreparedGltfTextureMapping {
  const diagnostics: GltfTextureMappingDiagnostic[] = [];
  const textureIndex = options.textureIndex;
  const slot = options.slot;

  if (!isNonNegativeInteger(textureIndex)) {
    diagnostics.push({
      code: "gltfTexture.malformedTexture",
      severity: "error",
      textureIndex,
      slot,
      field: "textureIndex",
      value: toDiagnosticValue(textureIndex),
      message: "textureIndex must be a non-negative integer.",
    });
    return preparedReport(
      result({ options, diagnostics, texture: null, sampler: null }),
    );
  }

  const texture = options.textures[textureIndex];
  if (!isRecord(texture)) {
    diagnostics.push({
      code: "gltfTexture.malformedTexture",
      severity: "error",
      textureIndex,
      slot,
      field: `textures[${textureIndex}]`,
      value: toDiagnosticValue(texture),
      message: `textures[${textureIndex}] must be an object.`,
    });
    return preparedReport(
      result({ options, diagnostics, texture: null, sampler: null }),
    );
  }

  inspectTextureExtensions({
    texture,
    textureIndex,
    slot,
    required: options.extensionsRequired ?? [],
    diagnostics,
  });

  const imageIndex = mapImageIndex({
    texture,
    textureIndex,
    slot,
    diagnostics,
  });
  const samplerIndex = mapSamplerIndex({
    texture,
    textureIndex,
    slot,
    samplers: options.samplers,
    diagnostics,
  });

  const sampler = createMappedSampler({
    samplers: options.samplers,
    samplerIndex,
    textureIndex,
    slot,
    diagnostics,
  });

  if (imageIndex === null) {
    return preparedReport(
      result({
        options,
        diagnostics,
        texture: null,
        sampler,
        samplerIndex,
      }),
    );
  }

  const image = options.images[imageIndex];
  if (!isRecord(image)) {
    diagnostics.push({
      code: "gltfTexture.malformedImage",
      severity: "error",
      textureIndex,
      slot,
      imageIndex,
      field: `images[${imageIndex}]`,
      value: toDiagnosticValue(image),
      message: `images[${imageIndex}] must be an object.`,
    });
    return preparedReport(
      result({
        options,
        diagnostics,
        texture: null,
        sampler,
        imageIndex,
        samplerIndex,
      }),
    );
  }

  const source = mapImageSource({
    image,
    textureIndex,
    imageIndex,
    slot,
    diagnostics,
  });
  if (source === null) {
    return preparedReport(
      result({
        options,
        diagnostics,
        texture: null,
        sampler,
        imageIndex,
        samplerIndex,
      }),
    );
  }

  return {
    kind: "image",
    options,
    diagnostics,
    texture,
    image,
    imageIndex,
    samplerIndex,
    sampler,
    source,
  };
}

function preparedReport(
  report: GltfTextureMappingReport,
): PreparedGltfTextureMapping {
  return { kind: "report", report };
}

function createTextureMappingReportFromDecoded(
  input: Extract<PreparedGltfTextureMapping, { readonly kind: "image" }> & {
    readonly decoded: GltfDecodedImageData | null;
  },
): GltfTextureMappingReport {
  if (input.decoded === null) {
    return result({
      options: input.options,
      diagnostics: input.diagnostics,
      texture: null,
      sampler: input.sampler,
      imageIndex: input.imageIndex,
      samplerIndex: input.samplerIndex,
    });
  }

  const slotInfo = textureSlotInfo(input.options.slot);
  const textureAsset = createTextureAsset({
    label: textureLabel(input.options, input.texture, input.image),
    dimension: "2d",
    width: input.decoded.width,
    height: input.decoded.height,
    format: input.decoded.format ?? slotInfo.format,
    colorSpace: slotInfo.colorSpace,
    semantic: slotInfo.semantic,
    usage: ["sampled", "copy-dst"],
    sourceData: input.decoded.sourceData,
  });

  return result({
    options: input.options,
    diagnostics: input.diagnostics,
    texture: textureAsset,
    sampler: input.sampler,
    imageIndex: input.imageIndex,
    samplerIndex: input.samplerIndex,
  });
}

export function gltfTextureMappingReportToJsonValue(
  report: GltfTextureMappingReport,
): GltfTextureMappingReportJsonValue {
  return {
    valid: report.valid,
    texture:
      report.texture === null ? null : textureAssetToJsonValue(report.texture),
    sampler: report.sampler === null ? null : { ...report.sampler },
    textureIndex: report.textureIndex,
    slot: report.slot,
    ...(report.imageIndex === undefined
      ? {}
      : { imageIndex: report.imageIndex }),
    ...(report.samplerIndex === undefined
      ? {}
      : { samplerIndex: report.samplerIndex }),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfTextureMappingReportToJson(
  report: GltfTextureMappingReport,
): string {
  return JSON.stringify(gltfTextureMappingReportToJsonValue(report));
}

function result(input: {
  readonly options: GltfTextureMappingOptions;
  readonly diagnostics: readonly GltfTextureMappingDiagnostic[];
  readonly texture: TextureAsset | null;
  readonly sampler: SamplerAsset | null;
  readonly imageIndex?: number | undefined;
  readonly samplerIndex?: number | undefined;
}): GltfTextureMappingReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    texture: input.texture,
    sampler: input.sampler,
    textureIndex: input.options.textureIndex,
    slot: input.options.slot,
    ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
    ...(input.samplerIndex === undefined
      ? {}
      : { samplerIndex: input.samplerIndex }),
    diagnostics: input.diagnostics,
  };
}

function mapImageIndex(input: {
  readonly texture: Record<string, unknown>;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): number | null {
  const basisuSource = textureBasisuSource(input.texture);
  if (basisuSource !== undefined) {
    if (isNonNegativeInteger(basisuSource)) {
      return basisuSource;
    }

    input.diagnostics.push({
      code: "gltfTexture.invalidTextureSource",
      severity: "error",
      textureIndex: input.textureIndex,
      slot: input.slot,
      field: `textures[${input.textureIndex}].extensions.KHR_texture_basisu.source`,
      value: toDiagnosticValue(basisuSource),
      message: `textures[${input.textureIndex}].extensions.KHR_texture_basisu.source must be a non-negative image index.`,
    });
    return null;
  }

  if (isNonNegativeInteger(input.texture.source)) {
    return input.texture.source;
  }

  input.diagnostics.push({
    code: "gltfTexture.invalidTextureSource",
    severity: "error",
    textureIndex: input.textureIndex,
    slot: input.slot,
    field: `textures[${input.textureIndex}].source`,
    value: toDiagnosticValue(input.texture.source),
    message: `textures[${input.textureIndex}].source must be a non-negative image index.`,
  });
  return null;
}

function textureBasisuSource(texture: Record<string, unknown>): unknown {
  const extensions = recordField(texture, "extensions");
  if (extensions === undefined) {
    return undefined;
  }
  return recordField(extensions, "KHR_texture_basisu")?.source;
}

function mapSamplerIndex(input: {
  readonly texture: Record<string, unknown>;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly samplers: readonly unknown[] | undefined;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): number | undefined {
  if (input.texture.sampler === undefined) {
    return undefined;
  }

  if (
    isNonNegativeInteger(input.texture.sampler) &&
    input.texture.sampler < (input.samplers?.length ?? 0)
  ) {
    return input.texture.sampler;
  }

  input.diagnostics.push({
    code: "gltfTexture.invalidSamplerIndex",
    severity: "error",
    textureIndex: input.textureIndex,
    slot: input.slot,
    field: `textures[${input.textureIndex}].sampler`,
    value: toDiagnosticValue(input.texture.sampler),
    ...(isNonNegativeInteger(input.texture.sampler)
      ? { samplerIndex: input.texture.sampler }
      : {}),
    message: `textures[${input.textureIndex}].sampler must reference an existing sampler.`,
  });
  return undefined;
}

function createMappedSampler(input: {
  readonly samplers: readonly unknown[] | undefined;
  readonly samplerIndex: number | undefined;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): SamplerAsset | null {
  const samplerSource =
    input.samplerIndex === undefined
      ? undefined
      : input.samplers?.[input.samplerIndex];

  if (samplerSource !== undefined && !isRecord(samplerSource)) {
    input.diagnostics.push({
      code: "gltfTexture.invalidSamplerIndex",
      severity: "error",
      textureIndex: input.textureIndex,
      slot: input.slot,
      ...(input.samplerIndex === undefined
        ? {}
        : { samplerIndex: input.samplerIndex }),
      field: `samplers[${input.samplerIndex}]`,
      value: toDiagnosticValue(samplerSource),
      message: `samplers[${input.samplerIndex}] must be an object.`,
    });
    return null;
  }

  const samplerReport = createSamplerAssetFromGltfSampler(
    samplerSource as GltfSamplerSource | undefined,
  );
  for (const diagnostic of samplerReport.diagnostics) {
    input.diagnostics.push(
      samplerDiagnosticToTextureDiagnostic(input, diagnostic),
    );
  }
  return samplerReport.sampler;
}

function samplerDiagnosticToTextureDiagnostic(
  input: {
    readonly textureIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly samplerIndex: number | undefined;
  },
  diagnostic: GltfSamplerMappingDiagnostic,
): GltfTextureMappingDiagnostic {
  return {
    code: "gltfTexture.invalidSampler",
    severity: "error",
    textureIndex: input.textureIndex,
    slot: input.slot,
    ...(input.samplerIndex === undefined
      ? {}
      : { samplerIndex: input.samplerIndex }),
    field: `sampler.${diagnostic.field}`,
    value: diagnostic.value,
    message: diagnostic.message,
  };
}

function inspectTextureExtensions(input: {
  readonly texture: Record<string, unknown>;
  readonly textureIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly required: readonly string[];
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): void {
  const extensions = recordField(input.texture, "extensions");
  if (extensions === undefined) {
    return;
  }

  const required = new Set(input.required);
  for (const extensionName of Object.keys(extensions)) {
    if (!UNSUPPORTED_TEXTURE_EXTENSIONS.has(extensionName)) {
      continue;
    }

    const requiredExtension = required.has(extensionName);
    input.diagnostics.push({
      code: requiredExtension
        ? "gltfTexture.unsupportedRequiredTextureExtension"
        : "gltfTexture.unsupportedTextureExtension",
      severity: requiredExtension ? "error" : "warning",
      textureIndex: input.textureIndex,
      slot: input.slot,
      extensionName,
      field: `textures[${input.textureIndex}].extensions.${extensionName}`,
      message: requiredExtension
        ? `Required glTF texture extension '${extensionName}' is not supported.`
        : `Optional glTF texture extension '${extensionName}' is not supported by the minimal mapper.`,
    });
  }
}

function mapImageSource(input: {
  readonly image: Record<string, unknown>;
  readonly textureIndex: number;
  readonly imageIndex: number;
  readonly slot: GltfMaterialTextureSlot;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfImageSourceRef | null {
  if (isNonNegativeInteger(input.image.bufferView)) {
    if (typeof input.image.mimeType !== "string") {
      input.diagnostics.push({
        code: "gltfTexture.missingImageSource",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        imageIndex: input.imageIndex,
        field: `images[${input.imageIndex}].mimeType`,
        value: toDiagnosticValue(input.image.mimeType),
        message: "BufferView images must declare a MIME type.",
      });
      return null;
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(input.image.mimeType)) {
      pushUnsupportedMimeType(input, input.image.mimeType);
      return null;
    }

    return {
      kind: "bufferView",
      bufferView: input.image.bufferView,
      mimeType: input.image.mimeType,
    };
  }

  if (typeof input.image.uri === "string") {
    const mimeType =
      typeof input.image.mimeType === "string"
        ? input.image.mimeType
        : mimeTypeFromUri(input.image.uri);

    if (mimeType !== undefined && !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      pushUnsupportedMimeType(input, mimeType);
      return null;
    }

    return {
      kind: "uri",
      uri: input.image.uri,
      ...(mimeType === undefined ? {} : { mimeType }),
    };
  }

  input.diagnostics.push({
    code: "gltfTexture.missingImageSource",
    severity: "error",
    textureIndex: input.textureIndex,
    slot: input.slot,
    imageIndex: input.imageIndex,
    field: `images[${input.imageIndex}]`,
    message: `images[${input.imageIndex}] must provide a URI or bufferView source.`,
  });
  return null;
}

function pushUnsupportedMimeType(
  input: {
    readonly textureIndex: number;
    readonly imageIndex: number;
    readonly slot: GltfMaterialTextureSlot;
    readonly diagnostics: GltfTextureMappingDiagnostic[];
  },
  mimeType: string,
): void {
  input.diagnostics.push({
    code: "gltfTexture.unsupportedImageMimeType",
    severity: "error",
    textureIndex: input.textureIndex,
    slot: input.slot,
    imageIndex: input.imageIndex,
    field: `images[${input.imageIndex}].mimeType`,
    value: mimeType,
    message: `Image MIME type '${mimeType}' is not supported by the minimal mapper.`,
  });
}

function resolveDecodedImage(input: {
  readonly options: GltfTextureMappingOptions;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
  readonly source: GltfImageSourceRef;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfDecodedImageData | null {
  const resolved = input.options.resolveImageData({
    textureIndex: input.options.textureIndex,
    imageIndex: input.imageIndex,
    slot: input.options.slot,
    image: input.image,
    source: input.source,
  });

  if (isPromiseLike(resolved)) {
    input.diagnostics.push({
      code: "gltfTexture.imageResolverFailed",
      severity: "error",
      textureIndex: input.options.textureIndex,
      slot: input.options.slot,
      imageIndex: input.imageIndex,
      message:
        "Image data resolver returned a Promise; use createTextureAssetFromGltfTextureAsync() for async glTF texture mapping.",
    });
    return null;
  }

  return normalizeAndValidateDecodedImage({
    options: input.options,
    imageIndex: input.imageIndex,
    resolved,
    diagnostics: input.diagnostics,
  });
}

async function resolveDecodedImageAsync(input: {
  readonly options: GltfTextureMappingOptions;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
  readonly source: GltfImageSourceRef;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): Promise<GltfDecodedImageData | null> {
  let resolved: GltfImageDataResolverResult;

  try {
    resolved = await input.options.resolveImageData({
      textureIndex: input.options.textureIndex,
      imageIndex: input.imageIndex,
      slot: input.options.slot,
      image: input.image,
      source: input.source,
    });
  } catch (error) {
    input.diagnostics.push({
      code: "gltfTexture.imageResolverFailed",
      severity: "error",
      textureIndex: input.options.textureIndex,
      slot: input.options.slot,
      imageIndex: input.imageIndex,
      message:
        error instanceof Error
          ? error.message
          : `Image ${input.imageIndex} async resolver rejected.`,
    });
    return null;
  }

  return normalizeAndValidateDecodedImage({
    options: input.options,
    imageIndex: input.imageIndex,
    resolved,
    diagnostics: input.diagnostics,
  });
}

function normalizeAndValidateDecodedImage(input: {
  readonly options: GltfTextureMappingOptions;
  readonly imageIndex: number;
  readonly resolved: GltfImageDataResolverResult;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfDecodedImageData | null {
  const image = normalizeResolvedImage({
    options: input.options,
    imageIndex: input.imageIndex,
    resolved: input.resolved,
    diagnostics: input.diagnostics,
  });

  if (image === null) {
    return null;
  }

  if (!validDecodedImage(image)) {
    input.diagnostics.push({
      code: "gltfTexture.invalidDecodedImage",
      severity: "error",
      textureIndex: input.options.textureIndex,
      slot: input.options.slot,
      imageIndex: input.imageIndex,
      message:
        "Decoded image data must include dimensions, row stride, and bytes.",
    });
    return null;
  }

  return image;
}

function normalizeResolvedImage(input: {
  readonly options: GltfTextureMappingOptions;
  readonly imageIndex: number;
  readonly resolved: GltfImageDataResolverResult;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): GltfDecodedImageData | null {
  if (isDecodedImageData(input.resolved)) {
    return input.resolved;
  }

  if (isImageDataResolverReport(input.resolved)) {
    const resolverDiagnostics = input.resolved.diagnostics ?? [];
    for (const diagnostic of resolverDiagnostics) {
      input.diagnostics.push({
        code: diagnostic.code ?? "gltfTexture.imageResolverFailed",
        severity: diagnostic.severity ?? "error",
        textureIndex: input.options.textureIndex,
        slot: input.options.slot,
        imageIndex: input.imageIndex,
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
      });
    }

    if (isDecodedImageData(input.resolved.image)) {
      return input.resolved.image;
    }

    if (resolverDiagnostics.length === 0) {
      pushImageResolverFailed(input);
    }
    return null;
  }

  pushImageResolverFailed(input);
  return null;
}

function pushImageResolverFailed(input: {
  readonly options: GltfTextureMappingOptions;
  readonly imageIndex: number;
  readonly diagnostics: GltfTextureMappingDiagnostic[];
}): void {
  input.diagnostics.push({
    code: "gltfTexture.imageResolverFailed",
    severity: "error",
    textureIndex: input.options.textureIndex,
    slot: input.options.slot,
    imageIndex: input.imageIndex,
    message: `Image ${input.imageIndex} could not be resolved to decoded texture data.`,
  });
}

function textureSlotInfo(slot: GltfMaterialTextureSlot): {
  readonly semantic: TextureSemantic;
  readonly colorSpace: TextureColorSpace;
  readonly format: TextureFormat;
} {
  switch (slot) {
    case "baseColorTexture":
      return {
        semantic: "base-color",
        colorSpace: "srgb",
        format: "rgba8unorm-srgb",
      };
    case "emissiveTexture":
      return {
        semantic: "emissive",
        colorSpace: "srgb",
        format: "rgba8unorm-srgb",
      };
    case "sheenColorTexture":
      return {
        semantic: "sheen-color",
        colorSpace: "srgb",
        format: "rgba8unorm-srgb",
      };
    case "sheenRoughnessTexture":
      return {
        semantic: "sheen-roughness",
        colorSpace: "data",
        format: "rgba8unorm",
      };
    case "iridescenceTexture":
      return {
        semantic: "iridescence",
        colorSpace: "data",
        format: "rgba8unorm",
      };
    case "iridescenceThicknessTexture":
      return {
        semantic: "iridescence-thickness",
        colorSpace: "data",
        format: "rgba8unorm",
      };
    case "metallicRoughnessTexture":
      return {
        semantic: "metallic-roughness",
        colorSpace: "data",
        format: "rgba8unorm",
      };
    case "clearcoatTexture":
    case "transmissionTexture":
      return { semantic: "data", colorSpace: "data", format: "rgba8unorm" };
    case "normalTexture":
      return { semantic: "normal", colorSpace: "data", format: "rgba8unorm" };
    case "occlusionTexture":
      return {
        semantic: "occlusion",
        colorSpace: "data",
        format: "rgba8unorm",
      };
  }
}

function textureLabel(
  options: GltfTextureMappingOptions,
  texture: Record<string, unknown>,
  image: Record<string, unknown>,
): string {
  if (options.label !== undefined) {
    return options.label;
  }
  if (typeof texture.name === "string" && texture.name.length > 0) {
    return texture.name;
  }
  if (typeof image.name === "string" && image.name.length > 0) {
    return image.name;
  }
  return `glTF Texture ${options.textureIndex} ${options.slot}`;
}

function textureAssetToJsonValue(
  texture: TextureAsset,
): Record<string, unknown> {
  return {
    ...texture,
    ...(texture.sourceData === undefined
      ? {}
      : {
          sourceData: {
            byteLength: texture.sourceData.bytes.byteLength,
            bytesPerRow: texture.sourceData.bytesPerRow,
            ...(texture.sourceData.rowsPerImage === undefined
              ? {}
              : { rowsPerImage: texture.sourceData.rowsPerImage }),
          },
        }),
  };
}

async function loadGltfImageBytes(
  input: GltfTextureAsyncLoadSource,
): Promise<Uint8Array> {
  if (input.bytes !== undefined) {
    return bytesView(input.bytes);
  }

  if (input.source.kind === "uri") {
    if (input.source.uri.startsWith("data:")) {
      return decodeDataUriBytes(input.source.uri);
    }

    return fetchGltfImageBytes(input);
  }

  throw new Error(
    `glTF bufferView image ${input.source.bufferView} requires bytes before async decode.`,
  );
}

async function fetchGltfImageBytes(
  input: GltfTextureAsyncLoadSource,
): Promise<Uint8Array> {
  if (input.source.kind !== "uri") {
    throw new Error("Only glTF URI image sources can be fetched.");
  }

  const mimeType = mimeTypeFromImageSource(input.source);
  const fetchResult =
    input.fetchImageBytes === undefined
      ? await fetchUriImageBytes(input.source.uri)
      : await input.fetchImageBytes({
          uri: input.source.uri,
          source: input.source,
          ...(mimeType === undefined ? {} : { mimeType }),
        });

  return bytesFromFetchResult(fetchResult);
}

async function fetchUriImageBytes(uri: string): Promise<GltfImageFetchResult> {
  if (typeof fetch !== "function") {
    throw new Error(
      "No fetch implementation is available for glTF URI image loading.",
    );
  }

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      `Fetching glTF image URI '${uri}' failed with HTTP ${response.status}.`,
    );
  }

  return response;
}

async function bytesFromFetchResult(
  resultValue: GltfImageFetchResult,
): Promise<Uint8Array> {
  if (isResponseLike(resultValue)) {
    if (!resultValue.ok) {
      throw new Error(
        `Fetching glTF image failed with HTTP ${resultValue.status}.`,
      );
    }

    return new Uint8Array(await resultValue.arrayBuffer());
  }

  if (isBlobLike(resultValue)) {
    return new Uint8Array(await resultValue.arrayBuffer());
  }

  return bytesView(resultValue);
}

async function decodeImageBytesWithBrowserCanvas(
  input: GltfImageBytesDecoderInput,
): Promise<GltfDecodedImageData> {
  if (input.mimeType === "image/ktx2") {
    return decodeKtx2TextureDataAsync(input.bytes);
  }

  if (typeof Blob === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error(
      "No browser image decoder is available; provide decodeImageData for this glTF image source.",
    );
  }

  const blob = new Blob([blobPartFromBytes(input.bytes)], {
    ...(input.mimeType === undefined ? {} : { type: input.mimeType }),
  });
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas = createImageDecodeCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (context === null) {
      throw new Error("Could not create a 2D canvas context for image decode.");
    }

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);

    return {
      width: bitmap.width,
      height: bitmap.height,
      sourceData: {
        bytes: new Uint8Array(
          pixels.data.buffer,
          pixels.data.byteOffset,
          pixels.data.byteLength,
        ),
        bytesPerRow: bitmap.width * 4,
        rowsPerImage: bitmap.height,
      },
    };
  } finally {
    bitmap.close();
  }
}

function blobPartFromBytes(
  bytes: Uint8Array,
): ArrayBuffer | ArrayBufferView<ArrayBuffer> {
  const buffer = bytes.buffer;

  if (buffer instanceof ArrayBuffer) {
    if (bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength) {
      return buffer;
    }

    return new Uint8Array(buffer, bytes.byteOffset, bytes.byteLength);
  }

  const copiedBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copiedBuffer).set(bytes);
  return copiedBuffer;
}

function createImageDecodeCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error(
    "No browser canvas implementation is available for image decode.",
  );
}

function decodeDataUriBytes(uri: string): Uint8Array {
  const match = /^data:([^,]*),(.*)$/u.exec(uri);

  if (match === null) {
    throw new Error("Malformed glTF data URI image source.");
  }

  const metadata = match[1] ?? "";
  const payload = match[2] ?? "";

  if (metadata.split(";").includes("base64")) {
    if (typeof atob !== "function") {
      throw new Error(
        "No base64 decoder is available for glTF data URI image.",
      );
    }

    const binary = atob(decodeURIComponent(payload));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  const text = decodeURIComponent(payload);
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function mimeTypeFromImageSource(
  source: GltfImageSourceRef,
): string | undefined {
  return source.kind === "bufferView"
    ? source.mimeType
    : (source.mimeType ?? mimeTypeFromUri(source.uri));
}

function isResponseLike(value: unknown): value is Response {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === "function" &&
    typeof value.ok === "boolean"
  );
}

function isBlobLike(value: unknown): value is Blob {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}

function mimeTypeFromUri(uri: string): string | undefined {
  const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
  if (dataPrefix?.[1] !== undefined) {
    return dataPrefix[1];
  }
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".ktx2")) {
    return "image/ktx2";
  }
  return undefined;
}

function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isDecodedImageData(value: unknown): value is GltfDecodedImageData {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    isRecord(value.sourceData)
  );
}

function isImageDataResolverReport(
  value: unknown,
): value is GltfImageDataResolverReport {
  return (
    isRecord(value) &&
    !isDecodedImageData(value) &&
    ("image" in value || "diagnostics" in value)
  );
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return isRecord(value) && typeof value.then === "function";
}

function validDecodedImage(image: GltfDecodedImageData): boolean {
  return (
    Number.isInteger(image.width) &&
    image.width > 0 &&
    Number.isInteger(image.height) &&
    image.height > 0 &&
    image.sourceData.bytes instanceof Uint8Array &&
    Number.isInteger(image.sourceData.bytesPerRow) &&
    image.sourceData.bytesPerRow > 0
  );
}

function toDiagnosticValue(value: unknown): GltfTextureDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
