// A1 (three.js parity plan): the opt-in lit-surface bind contract for custom
// WGSL materials. When a `CustomWgslMaterialAsset` declares
// `lighting: "lit"`, the renderer binds a renderer-owned bind group at
// `@group(3)` (packed lights, directional shadow receiver resources, IBL
// textures, fog params) and prepends `APERTURE_LIT_WGSL_HEADER` to the user's
// WGSL module, so shaders call the `aperture*` lighting helpers without any
// app-side GPU wiring. See docs/LIGHT_SHADER_WGSL_CONTRACT.md ("Lit custom
// materials") and docs/DECISIONS.md 0024 for the contract and its versioning.
//
// This module is renderer-independent data: constants, binding metadata, and
// the WGSL header string. The WebGPU backend realizes the bind group layout
// from `APERTURE_LIT_BINDING_METADATA` and keeps its packing constants in
// sync (asserted by test/materials/custom-wgsl-lit-contract.test.ts against
// @aperture-engine/webgpu's light packing).

/**
 * Version of the group(3) lit contract. Participates in every lit pipeline
 * key (as `lit:v<N>`), so a future layout change can never collide with
 * cached pipelines built against an older contract.
 */
export const APERTURE_LIT_CONTRACT_VERSION = 1;

/** Pipeline-key segment/feature that marks a lit custom-WGSL pipeline. */
export const APERTURE_LIT_PIPELINE_FEATURE = `lit:v${APERTURE_LIT_CONTRACT_VERSION}`;

/** The reserved renderer bind group index used by the lit contract. */
export const APERTURE_LIT_BIND_GROUP = 3;

// Packed light layout (must equal @aperture-engine/webgpu light-packing).
export const APERTURE_LIT_LIGHT_FLOAT_STRIDE = 29;
export const APERTURE_LIT_LIGHT_METADATA_STRIDE = 6;

export const APERTURE_LIT_LIGHT_KIND_IDS = {
  ambient: 0,
  directional: 1,
  point: 2,
  spot: 3,
  environment: 4,
  rectArea: 5,
} as const;

/** `ApertureLitParams.iblFlags` bits. */
export const APERTURE_LIT_IBL_IRRADIANCE_FLAG = 1;
export const APERTURE_LIT_IBL_SPECULAR_FLAG = 2;
export const APERTURE_LIT_IBL_BRDF_LUT_FLAG = 4;

export type ApertureLitBindingKind =
  | "read-only-storage-buffer"
  | "uniform-buffer"
  | "depth-texture-2d"
  | "comparison-sampler"
  | "float-texture-cube"
  | "float-texture-2d"
  | "filtering-sampler";

export interface ApertureLitBindingMetadata {
  readonly binding: number;
  readonly name: string;
  readonly kind: ApertureLitBindingKind;
  readonly wgslType: string;
  /** What the renderer binds when the frame has no matching resource. */
  readonly fallback: string;
}

/**
 * The v1 group(3) layout, in binding order. Every binding is
 * fragment-visible only (lit helpers are fragment-stage in v1) and every
 * binding is ALWAYS present — bindings without a frame resource bind a
 * renderer-owned fallback (zeroed buffer, 1x1 black texture) so one explicit
 * pipeline layout works every frame with zero pipeline rebuilds.
 */
export const APERTURE_LIT_BINDING_METADATA: readonly ApertureLitBindingMetadata[] =
  [
    {
      binding: 0,
      name: "apertureLightFloats",
      kind: "read-only-storage-buffer",
      wgslType: "array<f32>",
      fallback: "16-byte zeroed buffer (lightCount is authoritative)",
    },
    {
      binding: 1,
      name: "apertureLightMetadata",
      kind: "read-only-storage-buffer",
      wgslType: "array<i32>",
      fallback: "16-byte zeroed buffer (lightCount is authoritative)",
    },
    {
      binding: 2,
      name: "apertureLitParams",
      kind: "uniform-buffer",
      wgslType: "ApertureLitParams",
      fallback: "always present (counts/flags zero, fog disabled)",
    },
    {
      binding: 3,
      name: "apertureDirectionalShadowMatrices",
      kind: "read-only-storage-buffer",
      wgslType: "array<mat4x4f>",
      fallback: "64-byte zeroed buffer (directionalShadowCount = 0)",
    },
    {
      binding: 4,
      name: "apertureDirectionalShadowMap",
      kind: "depth-texture-2d",
      wgslType: "texture_depth_2d",
      fallback: "1x1 depth texture (directionalShadowCount = 0)",
    },
    {
      binding: 5,
      name: "apertureDirectionalShadowSampler",
      kind: "comparison-sampler",
      wgslType: "sampler_comparison",
      fallback: "less-equal comparison sampler (always creatable)",
    },
    {
      binding: 6,
      name: "apertureIblIrradianceTexture",
      kind: "float-texture-cube",
      wgslType: "texture_cube<f32>",
      fallback: "1x1 black cube texture (samples as vec3f(0))",
    },
    {
      binding: 7,
      name: "apertureIblSpecularTexture",
      kind: "float-texture-cube",
      wgslType: "texture_cube<f32>",
      fallback: "1x1 black cube texture (samples as vec3f(0))",
    },
    {
      binding: 8,
      name: "apertureIblBrdfLutTexture",
      kind: "float-texture-2d",
      wgslType: "texture_2d<f32>",
      fallback: "1x1 black 2d texture (apertureEnvironmentBrdf is analytic)",
    },
    {
      binding: 9,
      name: "apertureIblSampler",
      kind: "filtering-sampler",
      wgslType: "sampler",
      fallback: "linear clamped sampler (always creatable)",
    },
  ];

/**
 * True when the WGSL source declares a `@group(3)` binding. Lit custom
 * materials must NOT declare group(3) themselves — the renderer owns it and
 * prepends the contract header (`customMaterialSource.litReservedBindGroup`).
 */
export function wgslSourceDeclaresLitBindGroup(code: string): boolean {
  return /@group\s*\(\s*3\s*\)/u.test(code);
}

const LIT_KINDS = APERTURE_LIT_LIGHT_KIND_IDS;

/**
 * The WGSL contract header prepended to a lit material's module. All
 * declarations and helpers are `aperture`-prefixed; user code must not
 * redeclare `@group(3)` or any `aperture*` symbol. Helpers are
 * fragment-stage only in v1.
 *
 * Math parity: apertureEvaluateLightSurface / apertureDirectionalShadow /
 * apertureSampleIbl* / apertureApplyFog mirror the StandardMaterial WGSL
 * (packages/webgpu standard-shader-source & friends) so a custom material
 * can reproduce the standard Lambert+GGX response. Documented deviations:
 * rect-area lights evaluate as a diffuse-only form-factor approximation (no
 * LTC textures in the v1 contract), and the directional shadow helper always
 * filters with 3x3 PCF (the standard PCF-soft/PCSS modes are approximated).
 */
export const APERTURE_LIT_WGSL_HEADER = `// === aperture lit custom-material contract v${APERTURE_LIT_CONTRACT_VERSION} (renderer-prepended) ===
struct ApertureLitParams {
  lightCount: u32,
  directionalShadowCount: u32,
  iblFlags: u32,
  contractVersion: u32,
  fogColor: vec4f,
  fogParams: vec4f,
};

@group(${APERTURE_LIT_BIND_GROUP}) @binding(0) var<storage, read> apertureLightFloats: array<f32>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(1) var<storage, read> apertureLightMetadata: array<i32>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(2) var<uniform> apertureLitParams: ApertureLitParams;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(3) var<storage, read> apertureDirectionalShadowMatrices: array<mat4x4f>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(4) var apertureDirectionalShadowMap: texture_depth_2d;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(5) var apertureDirectionalShadowSampler: sampler_comparison;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(6) var apertureIblIrradianceTexture: texture_cube<f32>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(7) var apertureIblSpecularTexture: texture_cube<f32>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(8) var apertureIblBrdfLutTexture: texture_2d<f32>;
@group(${APERTURE_LIT_BIND_GROUP}) @binding(9) var apertureIblSampler: sampler;

const APERTURE_LIT_PI: f32 = 3.141592653589793;
const APERTURE_LIT_LIGHT_FLOAT_STRIDE: u32 = ${APERTURE_LIT_LIGHT_FLOAT_STRIDE}u;
const APERTURE_LIT_LIGHT_METADATA_STRIDE: u32 = ${APERTURE_LIT_LIGHT_METADATA_STRIDE}u;
const APERTURE_LIT_LIGHT_KIND_AMBIENT: i32 = ${LIT_KINDS.ambient};
const APERTURE_LIT_LIGHT_KIND_DIRECTIONAL: i32 = ${LIT_KINDS.directional};
const APERTURE_LIT_LIGHT_KIND_POINT: i32 = ${LIT_KINDS.point};
const APERTURE_LIT_LIGHT_KIND_SPOT: i32 = ${LIT_KINDS.spot};
const APERTURE_LIT_LIGHT_KIND_ENVIRONMENT: i32 = ${LIT_KINDS.environment};
const APERTURE_LIT_LIGHT_KIND_RECT_AREA: i32 = ${LIT_KINDS.rectArea};
const APERTURE_LIT_IBL_IRRADIANCE_FLAG: u32 = ${APERTURE_LIT_IBL_IRRADIANCE_FLAG}u;
const APERTURE_LIT_IBL_SPECULAR_FLAG: u32 = ${APERTURE_LIT_IBL_SPECULAR_FLAG}u;
const APERTURE_LIT_IBL_BRDF_LUT_FLAG: u32 = ${APERTURE_LIT_IBL_BRDF_LUT_FLAG}u;

fn apertureCountLights() -> u32 {
  return apertureLitParams.lightCount;
}

fn apertureLitSaturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn apertureLitSafeNormalize(value: vec3f, fallback: vec3f) -> vec3f {
  let valueLength = length(value);

  if (valueLength <= 0.0001) {
    return fallback;
  }

  return value / valueLength;
}

fn apertureLitFloatOffset(lightIndex: u32) -> u32 {
  return lightIndex * APERTURE_LIT_LIGHT_FLOAT_STRIDE;
}

fn apertureLightKind(lightIndex: u32) -> i32 {
  return apertureLightMetadata[lightIndex * APERTURE_LIT_LIGHT_METADATA_STRIDE];
}

fn apertureLightRadiance(lightIndex: u32) -> vec3f {
  let offset = apertureLitFloatOffset(lightIndex);
  let color = vec3f(
    apertureLightFloats[offset],
    apertureLightFloats[offset + 1u],
    apertureLightFloats[offset + 2u],
  );

  return color * apertureLightFloats[offset + 4u];
}

fn apertureLightPosition(lightIndex: u32) -> vec3f {
  let offset = apertureLitFloatOffset(lightIndex);

  return vec3f(
    apertureLightFloats[offset + 12u],
    apertureLightFloats[offset + 13u],
    apertureLightFloats[offset + 14u],
  );
}

// The light's TRAVEL direction (the way photons go), like the standard shader.
fn apertureLightDirection(lightIndex: u32) -> vec3f {
  let offset = apertureLitFloatOffset(lightIndex);

  return apertureLitSafeNormalize(
    vec3f(
      apertureLightFloats[offset + 15u],
      apertureLightFloats[offset + 16u],
      apertureLightFloats[offset + 17u],
    ),
    vec3f(0.0, 0.0, -1.0),
  );
}

fn apertureLightRange(lightIndex: u32) -> f32 {
  return max(apertureLightFloats[apertureLitFloatOffset(lightIndex) + 5u], 0.0001);
}

fn apertureLitFresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - apertureLitSaturate(cosTheta), 5.0);
}

fn apertureLitDistributionGgx(normal: vec3f, halfVector: vec3f, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let nDotH = max(dot(normal, halfVector), 0.0);
  let denomTerm = nDotH * nDotH * (alpha2 - 1.0) + 1.0;

  return alpha2 / max(APERTURE_LIT_PI * denomTerm * denomTerm, 0.0001);
}

fn apertureLitGeometrySchlickGgx(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;

  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn apertureLitGeometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
  let nDotV = max(dot(normal, viewDir), 0.0);
  let nDotL = max(dot(normal, lightDir), 0.0);

  return apertureLitGeometrySchlickGgx(nDotV, roughness) *
    apertureLitGeometrySchlickGgx(nDotL, roughness);
}

// Lambert + GGX direct term, identical to the StandardMaterial WGSL
// evaluateDirectLight (lightDir is the surface->light direction).
fn apertureLitEvaluateDirect(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let nDotL = max(dot(normal, lightDir), 0.0);

  if (nDotL <= 0.0) {
    return vec3f(0.0);
  }

  let halfVector = normalize(viewDir + lightDir);
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = apertureLitFresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let distribution = apertureLitDistributionGgx(normal, halfVector, roughness);
  let visibility = apertureLitGeometrySmith(normal, viewDir, lightDir, roughness);
  let specular = (distribution * visibility * fresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let diffuse = ((vec3f(1.0) - fresnel) * (1.0 - metallic) * baseColor) / APERTURE_LIT_PI;

  return (diffuse + specular) * radiance * nDotL;
}

// Inverse-square falloff windowed by the authored range (StandardMaterial
// punctualDistanceAttenuation parity; range <= 0 disables the window).
fn apertureLitDistanceAttenuation(lightDistance: f32, lightRange: f32) -> f32 {
  let inverseSquare = 1.0 / max(lightDistance * lightDistance, 0.0001);

  if (lightRange <= 0.0) {
    return inverseSquare;
  }

  let ratio2 = (lightDistance * lightDistance) / (lightRange * lightRange);
  let window = apertureLitSaturate(1.0 - ratio2 * ratio2);

  return inverseSquare * window * window;
}

fn apertureLitSpotConeAttenuation(lightIndex: u32, lightToReceiver: vec3f) -> f32 {
  let offset = apertureLitFloatOffset(lightIndex);
  let inner = clamp(apertureLightFloats[offset + 6u], 0.0, 3.14159);
  let outer = clamp(apertureLightFloats[offset + 7u], inner, 3.14159);
  let cosTheta = dot(normalize(lightToReceiver), apertureLightDirection(lightIndex));
  let innerCos = cos(inner);
  let outerCos = cos(outer);

  return apertureLitSaturate((cosTheta - outerCos) / max(innerCos - outerCos, 0.0001));
}

// Diffuse-only rect-area approximation (documented deviation: the v1 lit
// contract does not expose the standard LTC textures).
fn apertureLitEvaluateRectAreaDiffuse(
  lightIndex: u32,
  worldPosition: vec3f,
  normal: vec3f,
  baseColor: vec3f,
  metallic: f32,
) -> vec3f {
  let center = apertureLightPosition(lightIndex);
  let lightNormal = apertureLightDirection(lightIndex);
  let toReceiver = worldPosition - center;

  if (dot(lightNormal, toReceiver) <= 0.0) {
    return vec3f(0.0);
  }

  let offset = apertureLitFloatOffset(lightIndex);
  let halfWidth = vec3f(
    apertureLightFloats[offset + 18u],
    apertureLightFloats[offset + 19u],
    apertureLightFloats[offset + 20u],
  );
  let halfHeight = vec3f(
    apertureLightFloats[offset + 21u],
    apertureLightFloats[offset + 22u],
    apertureLightFloats[offset + 23u],
  );
  let distance2 = max(dot(toReceiver, toReceiver), 0.0001);
  let lightDir = apertureLitSafeNormalize(-toReceiver, normal);
  let receiverFacing = apertureLitSaturate(dot(normal, lightDir));
  let lightFacing = apertureLitSaturate(dot(lightNormal, -lightDir));
  let area = APERTURE_LIT_PI *
    max(length(halfWidth), 0.0001) * max(length(halfHeight), 0.0001);
  let formFactor = apertureLitSaturate(
    (area * receiverFacing * lightFacing) / max(distance2 + area, 0.0001),
  );
  let diffuse = ((vec3f(1.0) - vec3f(0.04)) * (1.0 - metallic) * baseColor) /
    APERTURE_LIT_PI;

  return diffuse * formFactor * apertureLightRadiance(lightIndex);
}

// Full surface response of one packed light for an explicit Lambert+GGX
// surface — StandardMaterial parity for ambient/directional/point/spot
// (ambient matches the standard indirect term: radiance * baseColor *
// (1 - metallic) / PI). Rect-area lights use the diffuse approximation above;
// environment lights contribute through the IBL helpers instead.
fn apertureEvaluateLightSurface(
  lightIndex: u32,
  worldPosition: vec3f,
  normal: vec3f,
  viewDir: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  if (lightIndex >= apertureCountLights()) {
    return vec3f(0.0);
  }

  let kind = apertureLightKind(lightIndex);

  if (kind == APERTURE_LIT_LIGHT_KIND_AMBIENT) {
    return apertureLightRadiance(lightIndex) * baseColor * (1.0 - metallic) *
      (1.0 / APERTURE_LIT_PI);
  }

  if (kind == APERTURE_LIT_LIGHT_KIND_DIRECTIONAL) {
    return apertureLitEvaluateDirect(
      normal,
      viewDir,
      -apertureLightDirection(lightIndex),
      apertureLightRadiance(lightIndex),
      baseColor,
      metallic,
      roughness,
    );
  }

  if (kind == APERTURE_LIT_LIGHT_KIND_POINT) {
    let toLight = apertureLightPosition(lightIndex) - worldPosition;
    let lightDistance = length(toLight);
    let attenuation = apertureLitDistanceAttenuation(
      lightDistance,
      apertureLightRange(lightIndex),
    );

    if (attenuation <= 0.0 || lightDistance <= 0.0001) {
      return vec3f(0.0);
    }

    return apertureLitEvaluateDirect(
      normal,
      viewDir,
      toLight / lightDistance,
      apertureLightRadiance(lightIndex) * attenuation,
      baseColor,
      metallic,
      roughness,
    );
  }

  if (kind == APERTURE_LIT_LIGHT_KIND_SPOT) {
    let toLight = apertureLightPosition(lightIndex) - worldPosition;
    let lightDistance = length(toLight);
    let rangeAttenuation = apertureLitDistanceAttenuation(
      lightDistance,
      apertureLightRange(lightIndex),
    );

    if (rangeAttenuation <= 0.0 || lightDistance <= 0.0001) {
      return vec3f(0.0);
    }

    let lightDir = toLight / lightDistance;
    let coneAttenuation = apertureLitSpotConeAttenuation(lightIndex, -lightDir);

    return apertureLitEvaluateDirect(
      normal,
      viewDir,
      lightDir,
      apertureLightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
      baseColor,
      metallic,
      roughness,
    );
  }

  if (kind == APERTURE_LIT_LIGHT_KIND_RECT_AREA) {
    return apertureLitEvaluateRectAreaDiffuse(
      lightIndex,
      worldPosition,
      normal,
      baseColor,
      metallic,
    );
  }

  return vec3f(0.0);
}

// Convenience variant for a neutral white dielectric surface (baseColor
// white, metallic 0, roughness 0.5) — multiply by your albedo, or call
// apertureEvaluateLightSurface for exact StandardMaterial parity.
fn apertureEvaluateLight(
  lightIndex: u32,
  worldPosition: vec3f,
  normal: vec3f,
  viewDir: vec3f,
) -> vec3f {
  return apertureEvaluateLightSurface(
    lightIndex,
    worldPosition,
    normal,
    viewDir,
    vec3f(1.0),
    0.0,
    0.5,
  );
}

fn apertureLitFirstDirectionalLightIndex() -> u32 {
  for (var lightIndex = 0u; lightIndex < apertureCountLights(); lightIndex = lightIndex + 1u) {
    if (apertureLightKind(lightIndex) == APERTURE_LIT_LIGHT_KIND_DIRECTIONAL) {
      return lightIndex;
    }
  }

  return apertureCountLights();
}

fn apertureLitShadowParam(lightIndex: u32, slot: u32, fallback: f32) -> f32 {
  if (lightIndex >= apertureCountLights()) {
    return fallback;
  }

  return apertureLightFloats[apertureLitFloatOffset(lightIndex) + slot];
}

fn apertureLitShadowPcf(shadowUv: vec2f, receiverDepth: f32, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(apertureDirectionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize * filterRadiusTexels,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        apertureDirectionalShadowMap,
        apertureDirectionalShadowSampler,
        sampleUv,
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

// Directional shadow visibility at a world position: 1.0 fully lit, down to
// (1 - authored shadow strength) fully shadowed. Returns 1.0 when the frame
// has no directional shadow resources. Mirrors the StandardMaterial
// single-map receiver (normal-offset bias, authored depth bias, first shadow
// matrix, out-of-frustum = lit); all filter modes evaluate as 3x3 PCF in v1.
fn apertureDirectionalShadow(worldPosition: vec3f, normal: vec3f) -> f32 {
  if (apertureLitParams.directionalShadowCount == 0u) {
    return 1.0;
  }

  let lightIndex = apertureLitFirstDirectionalLightIndex();
  let normalBias = max(apertureLitShadowParam(lightIndex, 26u, 0.0), 0.0);
  let depthBias = max(apertureLitShadowParam(lightIndex, 25u, 0.0), 0.0004);
  let filterRadius = max(apertureLitShadowParam(lightIndex, 27u, 1.0), 1.0);
  let strength = clamp(apertureLitShadowParam(lightIndex, 24u, 1.0), 0.0, 1.0);
  let biasedPosition = worldPosition + normal * normalBias;
  let shadowPosition = apertureDirectionalShadowMatrices[0] * vec4f(biasedPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  // wgpu clip-space depth is [0, 1]; out-of-frustum receivers are lit.
  let shadowDepth = shadowClip.z;
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let projectionDistance = max(
    distance(shadowUv, clampedShadowUv),
    abs(shadowDepth - clampedShadowDepth),
  );

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let receiverDepth = clamp(clampedShadowDepth - depthBias, 0.0, 1.0);
  let rawVisibility = apertureLitShadowPcf(clampedShadowUv, receiverDepth, filterRadius);
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(1.0 - strength, 1.0, visibility);
}

// Cosine-convolved environment irradiance (vec3f(0) without an environment).
// Multiply by albedo * (1 - metallic) for the StandardMaterial diffuse term.
fn apertureSampleIblIrradiance(normal: vec3f) -> vec3f {
  return textureSampleLevel(
    apertureIblIrradianceTexture,
    apertureIblSampler,
    normal,
    0.0,
  ).rgb;
}

// Prefiltered (PMREM) environment radiance along reflectDir at the given
// roughness (vec3f(0) without an environment). Combine with
// apertureEnvironmentBrdf for the split-sum specular term.
fn apertureSampleIblSpecular(reflectDir: vec3f, roughness: f32) -> vec3f {
  let mipLevel = f32(max(textureNumLevels(apertureIblSpecularTexture), 1u) - 1u) *
    clamp(roughness, 0.0, 1.0);

  return textureSampleLevel(
    apertureIblSpecularTexture,
    apertureIblSampler,
    reflectDir,
    mipLevel,
  ).rgb;
}

// Split-sum environment-BRDF scale/bias (Karis/Lazarov analytic
// approximation — the same term the StandardMaterial BRDF variant uses):
// specular = prefiltered * (f0 * result.x + result.y).
fn apertureEnvironmentBrdf(roughness: f32, nDotV: f32) -> vec2f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let r = roughness * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * nDotV)) * r.x + r.y;

  return vec2f(-1.04, 1.04) * a004 + r.zw;
}

// Distance fog using the frame's authored fog packet (fogParams.x encodes the
// mode: 0 none, 1 linear, 2 exp, 3 exp2 — StandardMaterial formula parity).
fn apertureApplyFog(color: vec3f, worldPosition: vec3f, cameraPosition: vec3f) -> vec3f {
  let mode = u32(apertureLitParams.fogParams.x);

  if (mode == 0u) {
    return color;
  }

  let distanceToCamera = length(cameraPosition - worldPosition);
  var fogFactor = 0.0;

  if (mode == 1u) {
    fogFactor = 1.0 - apertureLitSaturate(
      (apertureLitParams.fogParams.w - distanceToCamera) /
        max(apertureLitParams.fogParams.w - apertureLitParams.fogParams.z, 0.0001),
    );
  } else if (mode == 2u) {
    fogFactor = 1.0 - apertureLitSaturate(
      exp(-distanceToCamera * apertureLitParams.fogParams.y),
    );
  } else {
    fogFactor = 1.0 - apertureLitSaturate(
      exp(
        -distanceToCamera * distanceToCamera *
          apertureLitParams.fogParams.y * apertureLitParams.fogParams.y,
      ),
    );
  }

  return mix(
    color,
    apertureLitParams.fogColor.rgb,
    apertureLitSaturate(fogFactor * apertureLitParams.fogColor.a),
  );
}

// Linear -> sRGB transfer encoding, matching the StandardMaterial output
// stage on the default browser app (tonemap "none", output "srgb"). Apply it
// as the LAST step of a lit fragment for A/B parity with StandardMaterial.
fn apertureLinearToSrgb(color: vec3f) -> vec3f {
  let clamped = clamp(color, vec3f(0.0), vec3f(1.0));
  let low = clamped * 12.92;
  let high = vec3f(1.055) * pow(clamped, vec3f(1.0 / 2.4)) - vec3f(0.055);

  return select(high, low, clamped <= vec3f(0.0031308));
}
// === end aperture lit contract header ===
`;
