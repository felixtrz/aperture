import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

/** Move draw-constant arithmetic across stages without interpolating its result. */
export function applyStandardDrawConstants(
  source: string,
  features: StandardTextureShaderFeatures,
): string {
  if (features.fixedLightStorage === undefined) return source;
  const sun = features.knownLightKindLayout?.indexOf(1);
  const ambient = features.knownLightKindLayout?.indexOf(0);
  if (sun === undefined || ambient === undefined || sun < 0 || ambient < 0)
    throw new Error("Draw constants require the admitted sun/ambient plan.");

  const output = source.slice(
    source.indexOf("struct VertexOutput {"),
    source.indexOf("};", source.indexOf("struct VertexOutput {")),
  );
  const firstLocation =
    Math.max(
      -1,
      ...[...output.matchAll(/@location\((\d+)\)/gu)].map((match) =>
        Number(match[1]),
      ),
    ) + 1;
  // Pack after existing varyings rather than leaving holes in the interface.
  // All admitted built-in variants fit the portable sixteen-location limit.
  if (firstLocation + 3 >= 16)
    throw new Error("Standard draw constants exceed the varying budget.");

  let code = replaceOnce(
    source,
    "  // @aperture-standard-vertex-output-fields:end",
    `  @location(${firstLocation}) @interpolate(flat) standardSunDirectionStrength: vec4f,
  @location(${firstLocation + 1}) @interpolate(flat) standardSunRadianceBias: vec4f,
  @location(${firstLocation + 2}) @interpolate(flat) standardAmbientRadianceNormalBias: vec4f,
  @location(${firstLocation + 3}) @interpolate(flat) standardUvRotationFilter: vec4f,
  // @aperture-standard-vertex-output-fields:end`,
  );
  const rotation =
    features.baseColorTexture === true
      ? "cos(material.baseColorTextureRotation), sin(material.baseColorTextureRotation)"
      : "1.0, 0.0";
  code = replaceOnce(
    code,
    "  // @aperture-standard-vertex-post-uv-output:end",
    `  let standardDrawShadow = resolveSingleShadowParameters();
  output.standardSunDirectionStrength = vec4f(directionalLightDirection(${sun}u), standardDrawShadow.strength);
  output.standardSunRadianceBias = vec4f(lightRadiance(${sun}u), standardDrawShadow.depthBias);
  output.standardAmbientRadianceNormalBias = vec4f(lightRadiance(${ambient}u), standardDrawShadow.normalBias);
  output.standardUvRotationFilter = vec4f(${rotation}, standardDrawShadow.filterRadius, f32(standardDrawShadow.filterType));
  // @aperture-standard-vertex-post-uv-output:end`,
  );

  code = replaceOnce(
    code,
    "fn sampleDirectionalShadowFactor(worldPosition: vec3f, normal: vec3f) -> f32 {",
    "fn sampleDirectionalShadowFactor(worldPosition: vec3f, normal: vec3f, shadowParameters: SingleShadowParameters) -> f32 {",
  );
  code = replaceOnce(
    code,
    "  let shadowParameters = resolveSingleShadowParameters();",
    "",
  );

  if (features.baseColorTexture === true) {
    const start = code.indexOf("fn standardTextureTransformUv(");
    const end = code.indexOf("\n}", start) + 2;
    if (start < 0 || end <= start)
      throw new Error("Standard texture transform helper is missing.");
    const original = code.slice(start, end);
    const prepared = original
      .replace(
        "standardTextureTransformUv",
        "standardPreparedTextureTransformUv",
      )
      .replace("rotation: f32", "rotation: vec2f")
      .replace("cos(rotation)", "rotation.x")
      .replace("sin(rotation)", "rotation.y");
    code = replaceOnce(code, original, original + "\n\n" + prepared);
  }

  const fragmentStart = code.indexOf("@fragment\nfn fs_main(");
  if (fragmentStart < 0)
    throw new Error("Standard fragment entry point is missing.");
  let fragment = code.slice(fragmentStart);
  fragment = replaceOnce(
    fragment,
    `directionalLightDirection(${sun}u)`,
    "input.standardSunDirectionStrength.xyz",
  );
  fragment = replaceOnce(
    fragment,
    `lightRadiance(${sun}u)`,
    "input.standardSunRadianceBias.xyz",
  );
  fragment = replaceOnce(
    fragment,
    `lightRadiance(${ambient}u)`,
    "input.standardAmbientRadianceNormalBias.xyz",
  );
  fragment = replaceOnce(
    fragment,
    "sampleDirectionalShadowFactor(input.worldPosition, normal)",
    `sampleDirectionalShadowFactor(input.worldPosition, normal, SingleShadowParameters(
        input.standardSunDirectionStrength.w,
        input.standardSunRadianceBias.w,
        input.standardAmbientRadianceNormalBias.w,
        input.standardUvRotationFilter.z,
        u32(input.standardUvRotationFilter.w),
      ))`,
  );
  if (features.baseColorTexture === true) {
    fragment = replaceOnce(
      fragment,
      "let baseColorUv = standardTextureTransformUv(",
      "let baseColorUv = standardPreparedTextureTransformUv(",
    );
    fragment = replaceOnce(
      fragment,
      "    material.baseColorTextureRotation,",
      "    input.standardUvRotationFilter.xy,",
    );
  }
  return code.slice(0, fragmentStart) + fragment;
}

function replaceOnce(source: string, before: string, after: string): string {
  if (source.split(before).length !== 2)
    throw new Error("Standard draw-constant source seam must occur once.");
  return source.replace(before, after);
}
