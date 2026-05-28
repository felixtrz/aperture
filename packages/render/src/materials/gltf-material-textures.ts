import type {
  GltfMaterialMappingDiagnostic,
  GltfMaterialTextureBindingResolver,
  GltfMaterialTextureSlot,
} from "./gltf-material-types.js";
import {
  mapTextureIndex,
  mapTextureInfoSource,
  mapTextureTexCoord,
} from "./gltf-material-texture-info.js";
import { resolveTextureBindingResult } from "./gltf-material-texture-resolver.js";
import { mapTextureTransform } from "./gltf-material-texture-transform.js";
import type { MaterialTextureBinding } from "./types.js";

export function mapTextureBinding(input: {
  readonly materialKey: string;
  readonly slot: GltfMaterialTextureSlot;
  readonly field: string;
  readonly value: unknown;
  readonly resolver: GltfMaterialTextureBindingResolver | undefined;
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): MaterialTextureBinding | null {
  if (input.value === undefined) {
    return null;
  }

  const textureInfo = mapTextureInfoSource(input);
  if (textureInfo === null) {
    return null;
  }

  const textureInput = { ...input, value: textureInfo };
  const textureIndex = mapTextureIndex(textureInput);
  const texCoord = mapTextureTexCoord(textureInput);
  const transform = mapTextureTransform(textureInput);

  if (textureIndex === null || texCoord === null) {
    return null;
  }

  const resolved = input.resolver?.({
    materialKey: input.materialKey,
    slot: input.slot,
    field: input.field,
    textureInfo,
    textureIndex,
    texCoord,
    ...(transform === undefined ? {} : { transform }),
  });

  const binding = resolveTextureBindingResult({
    materialKey: input.materialKey,
    field: input.field,
    slot: input.slot,
    textureIndex,
    resolved,
    diagnostics: input.diagnostics,
  });

  if (binding === null) {
    return null;
  }

  return {
    texture: binding.texture,
    sampler: binding.sampler,
    texCoord,
    ...(transform === undefined ? {} : { transform }),
  };
}
