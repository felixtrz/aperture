import { materialTextureBindings } from "./bindings.js";
import { customWgslColorTargetsPipelineKeySegment } from "./color-targets.js";
import { isCustomWgslMaterialAsset } from "./family-key.js";
import { APERTURE_LIT_PIPELINE_FEATURE } from "./lit-contract.js";
import type {
  MaterialAsset,
  MaterialPipelineKeyInput,
  SamplerAsset,
  SourceMaterialAsset,
  StencilStateDescriptor,
} from "./types.js";

export function createMaterialPipelineKeyInput(
  material: SourceMaterialAsset,
): MaterialPipelineKeyInput {
  if (isCustomWgslMaterialAsset(material)) {
    return {
      shaderFamily: material.familyKey,
      features: [
        ...material.pipelineKey.features,
        // The lit-contract feature participates ONLY when lighting is "lit"
        // so unlit/absent materials keep byte-identical keys (A1, mirroring
        // the shadow-vs segment rule), and carries the contract version so a
        // future group(3) layout change cannot collide with cached pipelines.
        ...(material.lighting === "lit" ? [APERTURE_LIT_PIPELINE_FEATURE] : []),
        // The MRT feature participates ONLY when colorTargets is declared
        // (B3, same byte-identity rule as the lit segment).
        ...customWgslColorTargetFeatures(material.colorTargets),
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
      // D1: present only when authored, so non-stencil custom materials keep
      // byte-identical keys.
      ...(material.renderState.stencil === undefined
        ? {}
        : { stencil: material.renderState.stencil }),
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

  return {
    shaderFamily: material.kind,
    features: features.sort(),
    alphaMode: material.renderState.alphaMode,
    cullMode: material.renderState.cullMode,
    frontFace: material.renderState.frontFace,
    depth: material.renderState.depth,
    blend: material.renderState.blend,
    colorWriteMask: material.renderState.colorWriteMask,
    // D1: present only when authored, so non-stencil built-in materials keep
    // byte-identical keys.
    ...(material.renderState.stencil === undefined
      ? {}
      : { stencil: material.renderState.stencil }),
  };
}

function customWgslColorTargetFeatures(
  colorTargets: Parameters<typeof customWgslColorTargetsPipelineKeySegment>[0],
): readonly string[] {
  const segment = customWgslColorTargetsPipelineKeySegment(colorTargets);

  return segment === null ? [] : [segment];
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
    ...materialStencilPipelineFeatures(input.stencil),
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

// D1: the render state's trailing key segment is ALWAYS
// `alphaMode|cullMode|depthCompare|blendPreset` (four parts the backend parses
// as `parts.length - 4`). Stencil therefore rides a FEATURE token — like
// `depth-bias:…` / `front-face:cw` — emitted ONLY when authored so non-stencil
// materials keep byte-identical keys. The token is a single `|`-free string of
// `:`-separated fields (no field contains `:`), so the backend round-trips the
// full state from the key:
//   stencil:<readMask>:<writeMask>:<reference>
//     :<frontCompare>:<frontFail>:<frontDepthFail>:<frontPass>
//     :<backCompare>:<backFail>:<backDepthFail>:<backPass>
export function materialStencilPipelineFeatures(
  stencil: StencilStateDescriptor | undefined,
): readonly string[] {
  return stencil === undefined ? [] : [materialStencilPipelineToken(stencil)];
}

export function materialStencilPipelineToken(
  stencil: StencilStateDescriptor,
): string {
  return [
    "stencil",
    stencil.readMask >>> 0,
    stencil.writeMask >>> 0,
    stencil.reference >>> 0,
    stencil.front.compare,
    stencil.front.failOp,
    stencil.front.depthFailOp,
    stencil.front.passOp,
    stencil.back.compare,
    stencil.back.failOp,
    stencil.back.depthFailOp,
    stencil.back.passOp,
  ].join(":");
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
