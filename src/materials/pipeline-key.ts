import { materialTextureBindings } from "./bindings.js";
import type {
  MaterialAsset,
  MaterialPipelineKeyInput,
  SamplerAsset,
} from "./types.js";

export function createMaterialPipelineKeyInput(
  material: MaterialAsset,
): MaterialPipelineKeyInput {
  return {
    shaderFamily: material.kind,
    features: materialTextureBindings(material)
      .filter(([, binding]) => binding.texture !== null)
      .map(([field]) => field)
      .sort(),
    alphaMode: material.renderState.alphaMode,
    cullMode: material.renderState.cullMode,
    frontFace: material.renderState.frontFace,
    depth: material.renderState.depth,
    blend: material.renderState.blend,
    colorWriteMask: material.renderState.colorWriteMask,
  };
}

export function samplerPipelineKey(sampler: SamplerAsset): string {
  return [
    sampler.addressModeU,
    sampler.addressModeV,
    sampler.addressModeW,
    sampler.magFilter,
    sampler.minFilter,
    sampler.mipmapFilter,
    sampler.lodMinClamp,
    sampler.lodMaxClamp,
    sampler.maxAnisotropy,
  ].join("|");
}
