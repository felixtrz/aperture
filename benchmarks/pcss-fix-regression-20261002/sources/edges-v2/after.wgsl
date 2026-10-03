// StandardMaterial MVP shader.
// Direct lights use a small metallic/roughness GGX BRDF. shadow-map features are active; image-based lighting is deferred.
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
};

struct StandardMaterialUniform {
  baseColorFactor: vec4f,
  emissiveFactor: vec3f,
  metallicFactor: f32,
  roughnessFactor: f32,
  normalScale: f32,
  occlusionStrength: f32,
  alphaCutoff: f32,
  featureFlags: u32,
  baseColorTexCoord: u32,
  metallicRoughnessTexCoord: u32,
  normalTexCoord: u32,
  occlusionTexCoord: u32,
  emissiveTexCoord: u32,
  baseColorTextureOffset: vec2f,
  baseColorTextureScale: vec2f,
  baseColorTextureRotation: f32,
  padding1: f32,
  metallicRoughnessTextureOffset: vec2f,
  metallicRoughnessTextureScale: vec2f,
  metallicRoughnessTextureRotation: f32,
  padding2: f32,
  normalTextureOffset: vec2f,
  normalTextureScale: vec2f,
  normalTextureRotation: f32,
  padding3: f32,
  occlusionTextureOffset: vec2f,
  occlusionTextureScale: vec2f,
  occlusionTextureRotation: f32,
  padding4: f32,
  emissiveTextureOffset: vec2f,
  emissiveTextureScale: vec2f,
  emissiveTextureRotation: f32,
  padding5: f32,
  clearcoatFactor: f32,
  clearcoatRoughnessFactor: f32,
  transmissionFactor: f32,
  clearcoatTexCoord: u32,
  sheenColorRoughnessFactor: vec4f,
  iridescenceFactorIorThickness: vec4f,
  transmissionTexCoordPadding: vec4u,
  iridescenceThicknessTexCoordPadding: vec4u,
  // Refractive transmission volume (M5-T5): x=ior, y=thickness,
  // z=attenuationDistance (0 = no Beer-Lambert absorption), w=pad.
  transmissionVolume: vec4f,
  // Beer-Lambert attenuation color (rgb), w=pad.
  attenuationColor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  // @aperture-standard-vertex-input-fields:begin
  // @aperture-standard-vertex-input-fields:end
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
  // @aperture-standard-vertex-output-fields:begin
  // @aperture-standard-vertex-output-fields:end
};

const PI: f32 = 3.141592653589793;
const PACKED_LIGHT_FLOAT_STRIDE: u32 = 29u;
const PACKED_LIGHT_METADATA_STRIDE: u32 = 6u;
const LIGHT_KIND_AMBIENT: i32 = 0;
const LIGHT_KIND_DIRECTIONAL: i32 = 1;
const LIGHT_KIND_POINT: i32 = 2;
const LIGHT_KIND_SPOT: i32 = 3;
const LIGHT_KIND_RECT_AREA: i32 = 5;
const AREA_LIGHT_SHAPE_RECT: i32 = 1;
const AREA_LIGHT_SHAPE_DISK: i32 = 2;
const AREA_LIGHT_SHAPE_SPHERE: i32 = 3;
const STANDARD_FEATURE_ALPHA_MASK: u32 = 32u;
const STANDARD_FEATURE_DOUBLE_SIDED: u32 = 128u;

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
// @aperture-standard-vertex-bindings:begin
// @aperture-standard-vertex-bindings:end
@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;
@group(3) @binding(2) var<storage, read> directionalShadowMatrices: array<mat4x4f>;
@group(3) @binding(3) var directionalShadowMap: texture_depth_2d;
@group(3) @binding(4) var directionalShadowSampler: sampler_comparison;
@group(3) @binding(0) var<storage, read> lightFloats: array<f32>;
@group(3) @binding(1) var<storage, read> lightMetadata: array<i32>;
@group(3) @binding(11) var standardAreaLightLtcMatrixTexture: texture_2d<f32>;
@group(3) @binding(12) var standardAreaLightLtcFresnelTexture: texture_2d<f32>;
@group(3) @binding(13) var standardAreaLightLtcSampler: sampler;

// @aperture-standard-vertex-helpers:begin
// @aperture-standard-vertex-helpers:end

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  // @aperture-standard-vertex-local-transform:begin
  let worldPosition = world * vec4f(input.position, 1.0);
  // @aperture-standard-vertex-local-transform:end
  output.position = view.viewProjection * worldPosition;
  output.worldPosition = worldPosition.xyz;
  // @aperture-standard-vertex-normal-output:begin
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  // @aperture-standard-vertex-normal-output:end
  // @aperture-standard-vertex-pre-uv-output:begin
  // @aperture-standard-vertex-pre-uv-output:end
  output.uv = input.uv;
  // @aperture-standard-vertex-post-uv-output:begin
  // @aperture-standard-vertex-post-uv-output:end
  return output;
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn standardFaceDirection(frontFacing: bool) -> f32 {
  return select(-1.0, 1.0, frontFacing);
}

fn standardGeometryNormal(worldNormal: vec3f, frontFacing: bool) -> vec3f {
  let normal = normalize(worldNormal);

  if ((material.featureFlags & STANDARD_FEATURE_DOUBLE_SIDED) != 0u) {
    return normal * standardFaceDirection(frontFacing);
  }

  return normal;
}

// @aperture-standard-fragment-helpers:begin
// @aperture-standard-fragment-helpers:end

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}

fn distributionGGX(normal: vec3f, halfVector: vec3f, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let nDotH = max(dot(normal, halfVector), 0.0);
  let denomTerm = nDotH * nDotH * (alpha2 - 1.0) + 1.0;
  return alpha2 / max(PI * denomTerm * denomTerm, 0.0001);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
  let nDotV = max(dot(normal, viewDir), 0.0);
  let nDotL = max(dot(normal, lightDir), 0.0);
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

fn shadowDepthFromClip(shadowClip: vec3f) -> f32 {
  return shadowClip.z;
}

const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.0004;

fn shadowStrength(lightIndex: u32) -> f32 {
  return clamp(lightFloats[lightFloatOffset(lightIndex) + 24u], 0.0, 1.0);
}

fn shadowDepthBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 25u], 0.0);
}

// The light that owns this single-2D shadow map: the directional light when
// present, otherwise the spot light (a spot reuses the directional bindings on
// the non-cascaded path, sampling matrix 0). Mixed directional+spot scenes route
// through applyStandardMultiShadowMapSampling, so at most one applies here.
// Returns lightCount() when neither exists, so callers fall back to defaults.
// The mixed receiver additionally matches the packed shadow-owner marker.
// Homogeneous receiver selection retains its established behavior.
fn singleShadowLightIndex() -> u32 {
  for (var directionalIndex = 0u; directionalIndex < lightCount(); directionalIndex = directionalIndex + 1u) {
    if (lightKind(directionalIndex) == LIGHT_KIND_DIRECTIONAL) {
      return directionalIndex;
    }
  }
  for (var spotIndex = 0u; spotIndex < lightCount(); spotIndex = spotIndex + 1u) {
    if (lightKind(spotIndex) == LIGHT_KIND_SPOT) {
      return spotIndex;
    }
  }
  return lightCount();
}

fn directionalShadowStrengthValue() -> f32 {
  let shadowLightIndex = singleShadowLightIndex();
  if (shadowLightIndex < lightCount()) {
    return shadowStrength(shadowLightIndex);
  }
  return 1.0;
}

fn directionalShadowDepthBiasValue() -> f32 {
  let shadowLightIndex = singleShadowLightIndex();
  if (shadowLightIndex < lightCount()) {
    return max(shadowDepthBias(shadowLightIndex), STANDARD_SHADOW_DEPTH_BIAS);
  }
  return STANDARD_SHADOW_DEPTH_BIAS;
}

fn shadowNormalBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 26u], 0.0);
}

fn directionalShadowNormalBiasValue() -> f32 {
  let shadowLightIndex = singleShadowLightIndex();
  if (shadowLightIndex < lightCount()) {
    return shadowNormalBias(shadowLightIndex);
  }
  return 0.0;
}

fn shadowFilterRadius(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 27u], 0.0);
}

fn directionalShadowFilterRadiusValue() -> f32 {
  let shadowLightIndex = singleShadowLightIndex();
  if (shadowLightIndex < lightCount()) {
    return shadowFilterRadius(shadowLightIndex);
  }
  return 1.0;
}

fn shadowFilterType(lightIndex: u32) -> u32 {
  return u32(max(lightFloats[lightFloatOffset(lightIndex) + 28u], 0.0));
}

fn directionalShadowFilterTypeValue() -> u32 {
  let shadowLightIndex = singleShadowLightIndex();
  if (shadowLightIndex < lightCount()) {
    return shadowFilterType(shadowLightIndex);
  }
  return 1u;
}

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  let filterRadius = max(filterRadiusTexels, 0.0);

  if (filterRadius <= 0.0) {
    let maxTexel = shadowDimensions - vec2u(1u);
    let texel = min(
      vec2u(clamp(shadowUv, vec2f(0.0), vec2f(1.0)) * shadowMapSize),
      maxTexel,
    );
    let sampledDepth = textureLoad(
      directionalShadowMap,
      vec2i(texel),
      0,
    );
    return select(0.0, 1.0, receiverDepth <= sampledDepth);
  }

  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize * filterRadius,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        directionalShadowMap,
        directionalShadowSampler,
        sampleUv,
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowPcfSoft(shadowUv: vec2f, receiverDepth: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var uv = shadowUv;
  let f = fract(uv * shadowMapSize + vec2f(0.5));
  uv = uv - (f - vec2f(0.5)) * texelSize;

  let c1 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth, vec2i(-1, 1));
  let c2 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth, vec2i(1, 1));
  let c3 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth, vec2i(-1, -1));
  let c4 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth, vec2i(1, -1));

  let visibility =
    (mix(c1.x, c2.y, f.x) + c1.y + c2.x) * f.y +
    (mix(c1.w, c2.z, f.x) + c1.z + c2.w) +
    (mix(c3.x, c4.y, f.x) + c3.y + c4.x) +
    (mix(c3.w, c4.z, f.x) + c3.z + c4.w) * (1.0 - f.y);
  return visibility * (1.0 / 9.0);
}


// A fixed, centered disk is stable across frames and does not introduce a
// world/screen-position noise pattern. Search and filter have bounded work.
const DIRECTIONAL_PCSS_DISK: array<vec2f, 32> = array<vec2f, 32>(
  vec2f(0.12500000, 0.00000000),
  vec2f(-0.15964505, 0.14624794),
  vec2f(0.02443623, -0.27843827),
  vec2f(0.20122224, 0.26245878),
  vec2f(-0.36926756, -0.06531823),
  vec2f(0.34980247, -0.22251570),
  vec2f(-0.11700208, 0.43524190),
  vec2f(-0.22313565, -0.42963412),
  vec2f(0.48411512, 0.17679806),
  vec2f(-0.50364111, 0.20789573),
  vec2f(0.24278829, -0.51882448),
  vec2f(0.17941437, 0.57200130),
  vec2f(-0.54075701, -0.31337974),
  vec2f(0.63436952, -0.13946436),
  vec2f(-0.38714585, 0.55067513),
  vec2f(-0.08943965, -0.69019964),
  vec2f(0.54907176, 0.46275826),
  vec2f(-0.73887847, 0.03055494),
  vec2f(0.53895513, -0.53633233),
  vec2f(-0.03605819, 0.77979152),
  vec2f(-0.51281753, -0.61452679),
  vec2f(0.81235959, 0.10930183),
  vec2f(-0.68831064, 0.47890862),
  vec2f(0.18808606, -0.83606138),
  vec2f(0.43503327, 0.75919105),
  vec2f(-0.85044841, -0.27131624),
  vec2f(0.82610240, -0.38168026),
  vec2f(-0.35788820, 0.85515556),
  vec2f(-0.31940733, -0.88803376),
  vec2f(0.84990864, 0.44668816),
  vec2f(-0.94403465, 0.24884450),
  vec2f(0.53659581, -0.83452977),
);

fn sampleDirectionalPcssBilinear(shadowUv: vec2f, receiverDepth: f32, shadowMapSize: vec2f) -> f32 {
  // The shared comparison sampler deliberately remains nearest. Reconstruct
  // bilinear PCF here only, without changing hard or weighted-PCF semantics.
  let uv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let weights = fract(uv * shadowMapSize - vec2f(0.5));
  let comparisons = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, receiverDepth);
  return mix(
    mix(comparisons.w, comparisons.z, weights.x),
    mix(comparisons.x, comparisons.y, weights.x),
    weights.y,
  );
}

fn sampleDirectionalShadowPcss(shadowUv: vec2f, receiverDepth: f32, shadowMatrix: mat4x4f, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(shadowDimensions);
  let maxCoord = vec2i(shadowDimensions) - vec2i(1);
  // For P * rigidView, row-z length is 1/(far-near), while half
  // row-x length is 1/orthographicSpan. Translation (including light distance
  // and the near-plane origin) drops out. Their ratio converts a clip-depth
  // difference into separation as a fraction of the shadow-camera footprint.
  let depthScale = length(vec3f(shadowMatrix[0].z, shadowMatrix[1].z, shadowMatrix[2].z));
  let footprintScale = 0.5 * length(vec3f(shadowMatrix[0].x, shadowMatrix[1].x, shadowMatrix[2].x));
  if (!(depthScale > 0.000001 && depthScale < 1000000.0) ||
      !(footprintScale > 0.000001 && footprintScale < 1000000.0)) {
    return sampleDirectionalShadowPcf3x3(shadowUv, receiverDepth, 0.0);
  }
  // Radius is an artistic maximum in shadow texels, not an angular emitter
  // size. Keep the previous non-hard minimum of one and cap work/extent at 16.
  let maxRadius = clamp(filterRadiusTexels, 1.0, 16.0);
  var blockerSum = 0.0;
  var blockerCount = 0.0;
  // Include the center, so a small blocker under the receiver is never missed
  // merely because all disk taps lie away from the contact point.
  for (var sampleIndex = 0u; sampleIndex <= 32u; sampleIndex = sampleIndex + 1u) {
    var offset = vec2f(0.0);
    if (sampleIndex < 32u) {
      offset = DIRECTIONAL_PCSS_DISK[sampleIndex] * maxRadius;
    }
    let coord = clamp(vec2i(shadowUv * shadowMapSize + offset), vec2i(0), maxCoord);
    let occluderDepth = textureLoad(directionalShadowMap, coord, 0);
    if (occluderDepth < receiverDepth) {
      blockerSum = blockerSum + occluderDepth;
      blockerCount = blockerCount + 1.0;
    }
  }
  if (blockerCount == 0.0) {
    return 1.0;
  }
  let averageBlockerDepth = blockerSum / blockerCount;
  // The artistic response reaches the authored maximum at separation/span
  // = 1/12. Unlike receiver/blocker depth division, this is invariant to
  // equivalent near/far and light-distance changes in the orthographic camera.
  let separation = max(receiverDepth - averageBlockerDepth, 0.0) * footprintScale / depthScale;
  let variableRadius = maxRadius * clamp(separation * 12.0, 0.0, 1.0);
  var visibility = 0.0;
  for (var sampleIndex = 0u; sampleIndex < 32u; sampleIndex = sampleIndex + 1u) {
    let sampleUv = shadowUv + DIRECTIONAL_PCSS_DISK[sampleIndex] * variableRadius / shadowMapSize;
    visibility = visibility + sampleDirectionalPcssBilinear(sampleUv, receiverDepth, shadowMapSize);
  }
  return visibility * (1.0 / 32.0);
}


fn sampleDirectionalShadowFactor(worldPosition: vec3f, normal: vec3f) -> f32 {
  if (arrayLength(&directionalShadowMatrices) == 0u) {
    return 1.0;
  }

  // three.js normalBias parity: offset the receiver sample along its surface
  // normal so a near-coplanar caster (a double-sided/thin caster rendered with
  // cull "none", which has no far back face) does not self-shadow. Single-sided
  // casters are already protected by back-face caster rendering; this is the
  // secondary guard. Offsetting the position (not the shared sampler) leaves
  // sampleSpotShadowFactorWithMatrixBase untouched, so spot/point are unaffected.
  // normalBias is a RAW world-space distance (three.js/PlayCanvas parity).
  let biasedPosition = worldPosition + normal * directionalShadowNormalBiasValue();
  let filterType = directionalShadowFilterTypeValue();
  let filterRadius = select(
    max(directionalShadowFilterRadiusValue(), 1.0),
    0.0,
    filterType == 0u,
  );
  return sampleSpotShadowFactorWithMatrixBase(
    biasedPosition,
    0u,
    filterRadius,
    directionalShadowDepthBiasValue(),
    filterType,
  );
}

fn sampleSpotShadowFactorWithMatrixBase(worldPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32, depthBias: f32, filterType: u32) -> f32 {
  if (matrixBaseIndex >= arrayLength(&directionalShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[matrixBaseIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = shadowDepthFromClip(shadowClip);
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

  let receiverDepth = clamp(
    clampedShadowDepth - depthBias,
    0.0,
    1.0,
  );
  var rawVisibility: f32;
  if (filterType == 2u) {
    rawVisibility = sampleDirectionalShadowPcss(
      clampedShadowUv,
      receiverDepth,
      directionalShadowMatrices[matrixBaseIndex],
      filterRadiusTexels,
    );
  } else if (filterType == 1u) {
    rawVisibility = sampleDirectionalShadowPcfSoft(
      clampedShadowUv,
      receiverDepth,
    );
  } else {
    rawVisibility = sampleDirectionalShadowPcf3x3(
      clampedShadowUv,
      receiverDepth,
      filterRadiusTexels,
    );
  }
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  let compareFactor = mix(1.0 - directionalShadowStrengthValue(), 1.0, visibility);

  return compareFactor;
}

fn evaluateDirectLight(
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
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let distribution = distributionGGX(normal, halfVector, roughness);
  let visibility = geometrySmith(normal, viewDir, lightDir, roughness);
  let specular = (distribution * visibility * fresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let diffuse = ((vec3f(1.0) - fresnel) * (1.0 - metallic) * baseColor) / PI;
  var brdf = diffuse + specular;
  return brdf * radiance * nDotL;
}

fn lightCount() -> u32 {
  return arrayLength(&lightMetadata) / PACKED_LIGHT_METADATA_STRIDE;
}

fn lightFloatOffset(lightIndex: u32) -> u32 {
  return lightIndex * PACKED_LIGHT_FLOAT_STRIDE;
}

fn lightMetadataOffset(lightIndex: u32) -> u32 {
  return lightIndex * PACKED_LIGHT_METADATA_STRIDE;
}

fn lightKind(lightIndex: u32) -> i32 {
  return lightMetadata[lightMetadataOffset(lightIndex)];
}

fn lightRadiance(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);
  let color = vec3f(
    lightFloats[offset],
    lightFloats[offset + 1u],
    lightFloats[offset + 2u],
  );
  let intensity = lightFloats[offset + 4u];
  return color * intensity;
}

fn packedLightPosition(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 14u >= arrayLength(&lightFloats)) {
    return vec3f(0.0);
  }

  return vec3f(
    lightFloats[offset + 12u],
    lightFloats[offset + 13u],
    lightFloats[offset + 14u],
  );
}

fn packedLightDirection(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 17u >= arrayLength(&lightFloats)) {
    return vec3f(0.0, 0.0, -1.0);
  }

  return safeNormalize(
    vec3f(
      lightFloats[offset + 15u],
      lightFloats[offset + 16u],
      lightFloats[offset + 17u],
    ),
    vec3f(0.0, 0.0, -1.0),
  );
}

fn packedAreaLightHalfWidth(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 20u >= arrayLength(&lightFloats)) {
    if (offset + 8u >= arrayLength(&lightFloats)) {
      return vec3f(0.5, 0.0, 0.0);
    }

    return vec3f(max(lightFloats[offset + 8u], 0.0001) * 0.5, 0.0, 0.0);
  }

  return vec3f(
    lightFloats[offset + 18u],
    lightFloats[offset + 19u],
    lightFloats[offset + 20u],
  );
}

fn packedAreaLightHalfHeight(lightIndex: u32) -> vec3f {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 23u >= arrayLength(&lightFloats)) {
    if (offset + 9u >= arrayLength(&lightFloats)) {
      return vec3f(0.0, 0.5, 0.0);
    }

    return vec3f(0.0, max(lightFloats[offset + 9u], 0.0001) * 0.5, 0.0);
  }

  return vec3f(
    lightFloats[offset + 21u],
    lightFloats[offset + 22u],
    lightFloats[offset + 23u],
  );
}

fn lightTransformIndex(lightIndex: u32) -> u32 {
  let sourceOffset = lightMetadata[lightMetadataOffset(lightIndex) + 1u];

  if (sourceOffset <= 0) {
    return 0u;
  }

  return u32(sourceOffset) / 16u;
}

fn directionalLightDirection(lightIndex: u32) -> vec3f {
  // packedLightDirection is the light's TRAVEL direction (the way photons go).
  // evaluateDirectLight expects the surface->light vector (N·L lit when the
  // surface faces the light), matching the spot/point paths which pass
  // toward-light. Negate so an overhead sun lights up-facing receivers.
  return -packedLightDirection(lightIndex);
}

fn pointLightPosition(lightIndex: u32) -> vec3f {
  return packedLightPosition(lightIndex);
}

fn pointLightRange(lightIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  return max(lightFloats[offset + 5u], 0.0001);
}

// Physically-based punctual (point/spot) distance attenuation, matching the
// three.js getDistanceAttenuation with the default decay of 2 (and PlayCanvas /
// Bevy): inverse-square falloff windowed by a smooth range cutoff so radiance
// reaches zero at the authored range. lightRange <= 0 disables the window.
fn punctualDistanceAttenuation(lightDistance: f32, lightRange: f32) -> f32 {
  let inverseSquare = 1.0 / max(lightDistance * lightDistance, 0.0001);
  if (lightRange <= 0.0) {
    return inverseSquare;
  }
  let ratio2 = (lightDistance * lightDistance) / (lightRange * lightRange);
  let window = saturate(1.0 - ratio2 * ratio2);
  return inverseSquare * window * window;
}

fn spotLightDirection(lightIndex: u32) -> vec3f {
  return packedLightDirection(lightIndex);
}

fn spotLightConeAttenuation(lightIndex: u32, lightToReceiver: vec3f) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  let inner = clamp(lightFloats[offset + 6u], 0.0, 3.14159);
  let outer = clamp(lightFloats[offset + 7u], inner, 3.14159);
  let cosTheta = dot(normalize(lightToReceiver), spotLightDirection(lightIndex));
  let innerCos = cos(inner);
  let outerCos = cos(outer);
  return saturate((cosTheta - outerCos) / max(innerCos - outerCos, 0.0001));
}

fn safeNormalize(value: vec3f, fallback: vec3f) -> vec3f {
  let valueLength = length(value);

  if (valueLength <= 0.0001) {
    return fallback;
  }

  return value / valueLength;
}

fn rectAreaLightSize(lightIndex: u32) -> vec2f {
  let offset = lightFloatOffset(lightIndex);
  return max(vec2f(lightFloats[offset + 8u], lightFloats[offset + 9u]), vec2f(0.0001));
}

fn areaLightShape(lightIndex: u32) -> i32 {
  let offset = lightFloatOffset(lightIndex);
  return i32(lightFloats[offset + 10u]);
}

fn rectAreaLightCenter(lightIndex: u32) -> vec3f {
  return packedLightPosition(lightIndex);
}

fn rectAreaLightHalfWidth(lightIndex: u32) -> vec3f {
  return packedAreaLightHalfWidth(lightIndex);
}

fn rectAreaLightHalfHeight(lightIndex: u32) -> vec3f {
  return packedAreaLightHalfHeight(lightIndex);
}

fn rectAreaLightNormal(lightIndex: u32) -> vec3f {
  return packedLightDirection(lightIndex);
}

fn areaLightLtcUv(normal: vec3f, viewDir: vec3f, roughness: f32) -> vec2f {
  let lutSize = 64.0;
  let lutScale = (lutSize - 1.0) / lutSize;
  let lutBias = 0.5 / lutSize;
  let nDotV = saturate(dot(normal, viewDir));
  let uv = vec2f(clamp(roughness, 0.0, 1.0), sqrt(1.0 - nDotV));
  return uv * lutScale + vec2f(lutBias);
}

fn areaLightLtcMatrix(texel: vec4f) -> mat3x3f {
  return mat3x3f(
    vec3f(texel.x, 0.0, texel.y),
    vec3f(0.0, 1.0, 0.0),
    vec3f(texel.z, 0.0, texel.w),
  );
}

fn areaLightLtcFresnel(texel: vec4f, specularColor: vec3f) -> vec3f {
  return specularColor * texel.x + (vec3f(1.0) - specularColor) * texel.y;
}

fn areaLightLtcScalarScale(matrixTexel: vec4f, fresnelTexel: vec4f) -> f32 {
  return max((matrixTexel.x + matrixTexel.z) * 0.5 * max(fresnelTexel.x, 0.04), 0.0001);
}

fn ltcIdentityMatrix() -> mat3x3f {
  return mat3x3f(
    vec3f(1.0, 0.0, 0.0),
    vec3f(0.0, 1.0, 0.0),
    vec3f(0.0, 0.0, 1.0),
  );
}

fn ltcTransposeMat3(matrix: mat3x3f) -> mat3x3f {
  return mat3x3f(
    vec3f(matrix[0].x, matrix[1].x, matrix[2].x),
    vec3f(matrix[0].y, matrix[1].y, matrix[2].y),
    vec3f(matrix[0].z, matrix[1].z, matrix[2].z),
  );
}

fn ltcClippedSphereFormFactor(vectorFormFactor: vec3f) -> f32 {
  let vectorLength = length(vectorFormFactor);
  return max(
    (vectorLength * vectorLength + vectorFormFactor.z) /
      max(vectorLength + 1.0, 0.0001),
    0.0,
  );
}

fn areaLightFiniteNonNegative(value: f32) -> f32 {
  if (value != value) {
    return 0.0;
  }

  return max(value, 0.0);
}

fn areaLightFiniteColor(color: vec3f) -> vec3f {
  return vec3f(
    areaLightFiniteNonNegative(color.x),
    areaLightFiniteNonNegative(color.y),
    areaLightFiniteNonNegative(color.z),
  );
}

fn ltcEdgeVectorFormFactor(v1: vec3f, v2: vec3f) -> vec3f {
  let x = clamp(dot(v1, v2), -0.9999, 0.9999);
  let y = abs(x);
  let a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
  let b = 3.4175940 + (4.1616724 + y) * y;
  let v = a / b;
  var thetaSinTheta = v;

  if (x <= 0.0) {
    thetaSinTheta = 0.5 * inverseSqrt(max(1.0 - x * x, 0.0000001)) - v;
  }

  return cross(v1, v2) * thetaSinTheta;
}

fn ltcEvaluateRect(
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  inverseMatrix: mat3x3f,
  p0: vec3f,
  p1: vec3f,
  p2: vec3f,
  p3: vec3f,
) -> f32 {
  let lightEdge1 = p1 - p0;
  let lightEdge2 = p3 - p0;
  let lightNormal = cross(lightEdge1, lightEdge2);
  let handedness = sign(-dot(lightNormal, position - p0));
  let tangent = safeNormalize(
    viewDir - normal * dot(viewDir, normal),
    vec3f(1.0, 0.0, 0.0),
  );
  let bitangent = handedness * cross(normal, tangent);
  let basis = ltcTransposeMat3(mat3x3f(tangent, bitangent, normal));
  let ltcTransform = inverseMatrix * basis;
  let v0 = safeNormalize(ltcTransform * (p0 - position), vec3f(0.0, 0.0, 1.0));
  let v1 = safeNormalize(ltcTransform * (p1 - position), vec3f(0.0, 0.0, 1.0));
  let v2 = safeNormalize(ltcTransform * (p2 - position), vec3f(0.0, 0.0, 1.0));
  let v3 = safeNormalize(ltcTransform * (p3 - position), vec3f(0.0, 0.0, 1.0));
  let vectorFormFactor =
    ltcEdgeVectorFormFactor(v0, v1) +
    ltcEdgeVectorFormFactor(v1, v2) +
    ltcEdgeVectorFormFactor(v2, v3) +
    ltcEdgeVectorFormFactor(v3, v0);
  return saturate(ltcClippedSphereFormFactor(vectorFormFactor));
}

fn rectAreaLightFormFactor(
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  p0: vec3f,
  p1: vec3f,
  p2: vec3f,
  p3: vec3f,
) -> f32 {
  return ltcEvaluateRect(normal, viewDir, position, ltcIdentityMatrix(), p0, p1, p2, p3);
}

fn diskAreaLightFormFactor(
  lightIndex: u32,
  normal: vec3f,
  position: vec3f,
  center: vec3f,
  halfWidth: vec3f,
  halfHeight: vec3f,
) -> f32 {
  let toCenter = center - position;
  let distance2 = max(dot(toCenter, toCenter), 0.0001);
  let lightDir = safeNormalize(toCenter, normal);
  let receiverFacing = saturate(dot(normal, lightDir));
  let lightFacing = saturate(dot(rectAreaLightNormal(lightIndex), -lightDir));
  let diskArea = PI * max(length(halfWidth), 0.0001) * max(length(halfHeight), 0.0001);
  return saturate((diskArea * receiverFacing * lightFacing) / max(distance2 + diskArea, 0.0001));
}

fn sphereAreaLightFormFactor(
  normal: vec3f,
  position: vec3f,
  center: vec3f,
  radius: f32,
) -> f32 {
  let toCenter = center - position;
  let distance = max(length(toCenter), 0.0001);
  let lightDir = safeNormalize(toCenter, normal);
  let angularRadius = radius / distance;
  let receiverFacing = saturate((dot(normal, lightDir) + angularRadius) / (1.0 + angularRadius));
  let solidAngleApprox = (radius * radius) / max(distance * distance + radius * radius, 0.0001);
  return saturate(receiverFacing * solidAngleApprox);
}

fn areaLightFormFactor(
  lightIndex: u32,
  shape: i32,
  normal: vec3f,
  viewDir: vec3f,
  position: vec3f,
  center: vec3f,
  halfWidth: vec3f,
  halfHeight: vec3f,
) -> f32 {
  if (shape == AREA_LIGHT_SHAPE_DISK) {
    return diskAreaLightFormFactor(lightIndex, normal, position, center, halfWidth, halfHeight);
  }

  if (shape == AREA_LIGHT_SHAPE_SPHERE) {
    return sphereAreaLightFormFactor(normal, position, center, max(length(halfWidth), length(halfHeight)));
  }

  let p0 = center - halfWidth - halfHeight;
  let p1 = center + halfWidth - halfHeight;
  let p2 = center + halfWidth + halfHeight;
  let p3 = center - halfWidth + halfHeight;
  return rectAreaLightFormFactor(normal, viewDir, position, p0, p1, p2, p3);
}

fn evaluateAreaLight(
  lightIndex: u32,
  position: vec3f,
  normal: vec3f,
  viewDir: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let center = rectAreaLightCenter(lightIndex);
  let lightNormal = rectAreaLightNormal(lightIndex);
  let lightToReceiver = position - center;

  if (dot(lightNormal, lightToReceiver) <= 0.0) {
    return vec3f(0.0);
  }

  let halfWidth = rectAreaLightHalfWidth(lightIndex);
  let halfHeight = rectAreaLightHalfHeight(lightIndex);
  let shape = areaLightShape(lightIndex);
  var diffuseFactor = areaLightFormFactor(
    lightIndex,
    shape,
    normal,
    viewDir,
    position,
    center,
    halfWidth,
    halfHeight,
  );
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let ltcUv = areaLightLtcUv(normal, viewDir, roughness);
  let ltcMatrixTexel = textureSampleLevel(
    standardAreaLightLtcMatrixTexture,
    standardAreaLightLtcSampler,
    ltcUv,
    0.0,
  );
  let ltcFresnelTexel = textureSampleLevel(
    standardAreaLightLtcFresnelTexture,
    standardAreaLightLtcSampler,
    ltcUv,
    0.0,
  );
  var specularFactor =
    diffuseFactor * areaLightLtcScalarScale(ltcMatrixTexel, ltcFresnelTexel);

  if (shape == AREA_LIGHT_SHAPE_RECT) {
    let p0 = center - halfWidth - halfHeight;
    let p1 = center + halfWidth - halfHeight;
    let p2 = center + halfWidth + halfHeight;
    let p3 = center - halfWidth + halfHeight;
    diffuseFactor = rectAreaLightFormFactor(
      normal,
      viewDir,
      position,
      p0,
      p1,
      p2,
      p3,
    );
    specularFactor = ltcEvaluateRect(
      normal,
      viewDir,
      position,
      areaLightLtcMatrix(ltcMatrixTexel),
      p0,
      p1,
      p2,
      p3,
    );
  }

  diffuseFactor = areaLightFiniteNonNegative(diffuseFactor);
  specularFactor = areaLightFiniteNonNegative(specularFactor);

  if (diffuseFactor <= 0.0 && specularFactor <= 0.0) {
    return vec3f(0.0);
  }

  let fresnel = areaLightLtcFresnel(ltcFresnelTexel, f0);
  let diffuse = ((vec3f(1.0) - f0) * (1.0 - metallic) * baseColor) / PI;
  let specular = fresnel * specularFactor;
  return areaLightFiniteColor(
    (diffuse * diffuseFactor + specular) * lightRadiance(lightIndex),
  );
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
  // @aperture-standard-fragment-base-color-alpha:begin
  let baseColor = material.baseColorFactor.rgb;
  let alpha = material.baseColorFactor.a;
  // @aperture-standard-fragment-base-color-alpha:end

  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {
    discard;
  }

  // @aperture-standard-fragment-normal-setup:begin
  let normal = standardGeometryNormal(input.worldNormal, frontFacing);
  // @aperture-standard-fragment-normal-setup:end
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  // @aperture-standard-fragment-metallic-roughness:begin
  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  // @aperture-standard-fragment-metallic-roughness:end
  var ambient = vec3f(0.0);
  var direct = vec3f(0.0);

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    let kind = lightKind(lightIndex);

    if (kind == LIGHT_KIND_AMBIENT) {
      ambient = ambient + lightRadiance(lightIndex);
    }

    if (kind == LIGHT_KIND_DIRECTIONAL) {
      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition, normal);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;
    }

    if (kind == LIGHT_KIND_POINT) {
      let lightPosition = pointLightPosition(lightIndex);
      let toLight = lightPosition - input.worldPosition;
      let lightDistance = length(toLight);
      let lightRange = pointLightRange(lightIndex);
      let attenuation = punctualDistanceAttenuation(lightDistance, lightRange);

      if (attenuation > 0.0 && lightDistance > 0.0001) {
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );
      }
    }

    if (kind == LIGHT_KIND_SPOT) {
      let lightPosition = pointLightPosition(lightIndex);
      let toLight = lightPosition - input.worldPosition;
      let lightDistance = length(toLight);
      let lightRange = pointLightRange(lightIndex);
      let rangeAttenuation = punctualDistanceAttenuation(lightDistance, lightRange);

      if (rangeAttenuation > 0.0 && lightDistance > 0.0001) {
        let lightDir = toLight / lightDistance;
        let coneAttenuation = spotLightConeAttenuation(lightIndex, -lightDir);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        );
      }
    }

    if (kind == LIGHT_KIND_RECT_AREA) {
      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
      );
    }
  }

  // @aperture-standard-fragment-assembly:begin
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI);
  let standardIndirectColor = ambientDiffuse;
  let standardDirectColor = direct;
  let standardEmissiveColor = material.emissiveFactor;
  var color = standardIndirectColor + standardDirectColor + standardEmissiveColor;
  let standardIndirectOutputColor = standardIndirectColor;
  return vec4f(color, alpha);
  // @aperture-standard-fragment-assembly:end
}