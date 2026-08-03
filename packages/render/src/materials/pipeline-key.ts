import { materialTextureBindings } from "./bindings.js";
import { isCustomWgslMaterialAsset } from "./family-key.js";
import type {
  MaterialAsset,
  MaterialPipelineKeyInput,
  MeshRenderStage,
  SamplerAsset,
  SourceMaterialAsset,
} from "./types.js";

export function createMaterialPipelineKeyInput(
  material: SourceMaterialAsset,
): MaterialPipelineKeyInput {
  if (isCustomWgslMaterialAsset(material)) {
    return {
      shaderFamily: material.familyKey,
      features: [
        ...material.pipelineKey.features,
        `specialization:${stableStringHash(
          JSON.stringify(material.pipelineKey.specialization),
        )}`,
        `bindings:${material.bindings
          .map((binding) => `${binding.binding}:${binding.kind}`)
          .sort()
          .join(",")}`,
      ].sort(),
      alphaMode: material.renderState.alphaMode,
      cullMode: material.renderState.cullMode,
      frontFace: material.renderState.frontFace,
      depth: material.renderState.depth,
      blend: material.renderState.blend,
      colorWriteMask: material.renderState.colorWriteMask,
    };
  }

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

  if (usesStandardIridescence(material)) {
    features.push("iridescence");
  }

  // The render stage picks a different color target, sample count, depth state
  // and output transform, so it must separate pipelines (and therefore draw
  // batches) exactly like a shader feature does. `tonemapped:false` only
  // matters inside a post-tonemap pipeline, so it is only keyed there.
  if (materialRenderStage(material) === "post-tonemap") {
    features.push(MATERIAL_POST_TONEMAP_STAGE_FEATURE);

    if (!materialToneMapped(material)) {
      features.push(MATERIAL_UNTONEMAPPED_FEATURE);
    }
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

/**
 * Pipeline-key feature marking a draw as belonging to the post-tonemap stage.
 * The renderer reads it back off the key to resolve the pipeline's color
 * target and depth state, so the token is part of the cross-package contract.
 */
export const MATERIAL_POST_TONEMAP_STAGE_FEATURE = "render-stage:post-tonemap";
/** Pipeline-key feature marking a post-tonemap draw as `toneMapped: false`. */
export const MATERIAL_UNTONEMAPPED_FEATURE = "tonemapped:false";

export function materialRenderStage(
  material: SourceMaterialAsset,
): MeshRenderStage {
  return !isCustomWgslMaterialAsset(material) && material.kind === "unlit"
    ? material.renderStage
    : "scene";
}

export function materialToneMapped(material: SourceMaterialAsset): boolean {
  return !isCustomWgslMaterialAsset(material) && material.kind === "unlit"
    ? material.toneMapped
    : true;
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

function usesStandardIridescence(material: MaterialAsset): boolean {
  return material.kind === "standard" && material.iridescenceFactor > 0;
}

export function materialPipelineKeyInputToKey(
  input: MaterialPipelineKeyInput,
): string {
  const features = [
    ...input.features,
    ...materialFrontFacePipelineFeatures(input.frontFace),
    ...materialDepthBiasPipelineFeatures(input.depth),
  ].sort();

  return [
    input.shaderFamily,
    ...features,
    input.alphaMode,
    input.cullMode,
    input.depth.compare,
    input.blend.preset,
  ].join("|");
}

function materialFrontFacePipelineFeatures(
  frontFace: MaterialPipelineKeyInput["frontFace"],
): readonly string[] {
  return frontFace === "cw" ? ["front-face:cw"] : [];
}

function materialDepthBiasPipelineFeatures(
  depth: MaterialPipelineKeyInput["depth"],
): readonly string[] {
  const depthBias = normalizeDepthBias(depth.bias);
  const depthBiasSlopeScale = normalizeDepthBiasSlopeScale(
    depth.biasSlopeScale,
  );

  return depthBias === 0 && depthBiasSlopeScale === 0
    ? []
    : [`depth-bias:${depthBias}:${depthBiasSlopeScale}`];
}

function normalizeDepthBias(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : 0;
}

function normalizeDepthBiasSlopeScale(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
