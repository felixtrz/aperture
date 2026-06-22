import {
  isDecodedImageData,
  isImageDataResolverReport,
  isPromiseLike,
  validDecodedImage,
} from "./gltf-texture-utils.js";
import type {
  GltfDecodedImageData,
  GltfImageDataResolverResult,
  GltfImageSourceRef,
  GltfTextureMappingDiagnostic,
  GltfTextureMappingOptions,
} from "./gltf-texture-types.js";

export function resolveDecodedImage(input: {
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

export async function resolveDecodedImageAsync(input: {
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
