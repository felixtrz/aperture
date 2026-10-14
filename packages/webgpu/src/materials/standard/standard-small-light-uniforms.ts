import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

/** The packed f32/i32 words retain their storage-route order and arithmetic. */
export const STANDARD_SMALL_LIGHT_FLOAT_BYTES = 240;
export const STANDARD_SMALL_LIGHT_METADATA_BYTES = 64;

export function supportsStandardSmallLightUniforms(
  features: StandardTextureShaderFeatures,
): boolean {
  const layout = features.knownLightKindLayout;
  return (
    layout?.length === 2 &&
    ((layout[0] === 0 && layout[1] === 1) ||
      (layout[0] === 1 && layout[1] === 0)) &&
    features.lightKindMask === 3 &&
    features.fixedSingleShadowLightIndex === layout.indexOf(1) &&
    features.fixedDirectionalShadowFilter === 1 &&
    features.shadowMap === true &&
    !features.cascadedShadowMap &&
    !features.pointShadowMap &&
    !features.directionalPointShadowMap &&
    !features.spotShadowMap &&
    !features.iblDiffuse &&
    !features.iblSpecularProof &&
    !features.iblSpecularBrdf &&
    !features.clearcoat &&
    !features.transmission &&
    !features.sheen &&
    !features.iridescence &&
    !features.clearcoatTexture &&
    !features.clearcoatRoughnessTexture &&
    !features.transmissionTexture &&
    !features.sheenColorTexture &&
    !features.sheenRoughnessTexture &&
    !features.iridescenceTexture &&
    !features.iridescenceThicknessTexture &&
    !features.fogLinear &&
    !features.fogExp &&
    !features.fogExp2 &&
    !features.skinned &&
    !features.morphed &&
    !features.clusteredLocalLights &&
    !features.clusteredLocalLightCookies &&
    !features.clusteredLocalLightShadowCookies &&
    !features.clusteredLocalLightArrayCookies &&
    !features.clusteredLocalLightCubeCookies &&
    !features.clusteredLocalLightArrayShadows &&
    !features.clusteredLocalLightPointArrayShadows
  );
}

/** Change only the light transport after ordinary lighting composition. */
export function applyStandardSmallLightUniforms(
  source: string,
  features: StandardTextureShaderFeatures,
): string {
  if (features.smallLightUniforms === undefined) return source;
  if (!supportsStandardSmallLightUniforms(features)) {
    throw new Error(
      "Small light uniforms require one ambient and one PCF sun.",
    );
  }
  let code = source
    .replace(
      "@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;",
      `@group(3) @binding(0) var<uniform> smallLightFloats: array<vec4f, 15>;

fn smallLightFloat(index: u32) -> f32 {
  return smallLightFloats[index / 4u][index % 4u];
}`,
    )
    .replace(
      "@group(3) @binding(1) var<storage, read> lightMetadata: array<i32>;",
      `@group(3) @binding(1) var<uniform> smallLightMetadata: array<vec4i, 4>;

fn smallLightMetadataWord(index: u32) -> i32 {
  return smallLightMetadata[index / 4u][index % 4u];
}`,
    );
  if (code === source || code.includes("var<storage, read> light")) {
    throw new Error(
      "Small light uniform declarations did not match the schema.",
    );
  }
  code = code
    .replaceAll(
      "arrayLength(&lightMetadata) / PACKED_LIGHT_METADATA_STRIDE",
      "min(u32(max(smallLightMetadata[3].x, 0)), 2u)",
    )
    .replaceAll(
      "arrayLength(&lightFloats)",
      "min(u32(max(smallLightMetadata[3].y, 0)), 58u)",
    );
  code = replaceArrayReads(code, "lightFloats", "smallLightFloat");
  code = replaceArrayReads(code, "lightMetadata", "smallLightMetadataWord");
  return code;
}

function replaceArrayReads(
  source: string,
  name: string,
  accessor: string,
): string {
  const marker = `${name}[`;
  let result = "";
  let cursor = 0;
  for (;;) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) return result + source.slice(cursor);
    let end = start + marker.length;
    let depth = 1;
    while (end < source.length && depth > 0) {
      if (source[end] === "[") depth++;
      if (source[end] === "]") depth--;
      end++;
    }
    if (depth !== 0)
      throw new Error("Incomplete generated light array access.");
    result +=
      source.slice(cursor, start) +
      accessor +
      "(" +
      source.slice(start + marker.length, end - 1) +
      ")";
    cursor = end;
  }
}
