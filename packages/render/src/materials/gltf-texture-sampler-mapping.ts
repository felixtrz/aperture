import {
  createSamplerAssetFromGltfSampler,
  type GltfSamplerMappingDiagnostic,
  type GltfSamplerSource,
} from "./gltf-sampler.js";
import type { GltfMaterialTextureSlot } from "./gltf-material-types.js";
import type { GltfTextureMappingDiagnostic } from "./gltf-texture-types.js";
import type { SamplerAsset } from "./types.js";
import {
  isNonNegativeInteger,
  isRecord,
  toDiagnosticValue,
} from "./gltf-texture-utils.js";

export function mapSamplerIndex(input: {
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

export function createMappedSampler(input: {
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
