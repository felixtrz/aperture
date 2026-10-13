import type {
  GltfTextureMappingDiagnostic,
  GltfTextureMappingOptions,
  PreparedGltfTextureMapping,
} from "./gltf-texture-types.js";
import {
  createGltfTextureMappingReport as result,
  preparedReport,
} from "./gltf-texture-result.js";
import {
  createMappedSampler,
  mapSamplerIndex,
} from "./gltf-texture-sampler-mapping.js";
import {
  inspectTextureExtensions,
  mapImageIndex,
  mapImageSource,
} from "./gltf-texture-source-mapping.js";
import {
  isNonNegativeInteger,
  isRecord,
  toDiagnosticValue,
} from "./gltf-texture-utils.js";

export function prepareGltfTextureMapping(
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
