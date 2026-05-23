import { materialTextureBindings } from "./bindings.js";
import type {
  MaterialAsset,
  MaterialPipelineKeyInput,
  SamplerAsset,
} from "./types.js";

export function createMaterialPipelineKeyInput(
  material: MaterialAsset,
): MaterialPipelineKeyInput {
  const features = materialTextureBindings(material)
    .filter(([, binding]) => binding.texture !== null)
    .map(([field]) => field);

  if (usesStandardTexCoord1(material)) {
    features.push("uv1");
  }

  if (usesStandardClearcoat(material)) {
    features.push("clearcoat");
  }

  if (usesStandardTransmission(material)) {
    features.push("transmission");
  }

  if (usesStandardSheen(material)) {
    features.push("sheen");
  }

  return {
    shaderFamily: material.kind,
    features: features.sort(),
    alphaMode: material.renderState.alphaMode,
    cullMode: material.renderState.cullMode,
    frontFace: material.renderState.frontFace,
    depth: material.renderState.depth,
    blend: material.renderState.blend,
    colorWriteMask: material.renderState.colorWriteMask,
  };
}

function usesStandardTexCoord1(material: MaterialAsset): boolean {
  return (
    material.kind === "standard" &&
    materialTextureBindings(material).some(
      ([, binding]) => binding.texture !== null && binding.texCoord === 1,
    )
  );
}

function usesStandardClearcoat(material: MaterialAsset): boolean {
  return material.kind === "standard" && material.clearcoatFactor > 0;
}

function usesStandardTransmission(material: MaterialAsset): boolean {
  return material.kind === "standard" && material.transmissionFactor > 0;
}

function usesStandardSheen(material: MaterialAsset): boolean {
  return (
    material.kind === "standard" &&
    (material.sheenColorFactor[0] > 0 ||
      material.sheenColorFactor[1] > 0 ||
      material.sheenColorFactor[2] > 0)
  );
}

export function materialPipelineKeyInputToKey(
  input: MaterialPipelineKeyInput,
): string {
  return [
    input.shaderFamily,
    ...input.features,
    input.alphaMode,
    input.cullMode,
    input.depth.compare,
    input.blend.preset,
  ].join("|");
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
