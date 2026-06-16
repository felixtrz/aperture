// Single source of truth for the shadow-map depth convention, emitted once into
// every shadow variant and called by all sampler sites (directional, spot,
// point). aperture builds shadow matrices with wgpu makeOrthographic /
// makePerspective, whose clip-space depth is [0,1] (near=0, far=1) — NOT the GL
// [-1,1] convention. So the receiver depth is the RAW clip z; each caller's
// bounds check treats z<0 (in front of near) or z>1 (beyond far) as outside the
// frustum = lit. A GL-style select(z, z*0.5+0.5, z<0) remap would fold
// out-of-frustum points into a valid depth and spuriously shadow receivers in
// front of the near plane (e.g. a caster buried under the ground) — it must
// never be reintroduced. Centralizing it here means a new sampler site can only
// get the convention right, and the no-remap guarantee is asserted per variant.
const SHADOW_DEPTH_FROM_CLIP_WGSL = `fn shadowDepthFromClip(shadowClip: vec3f) -> f32 {
  return shadowClip.z;
}`;

export function applyStandardShadowMapSampling(
  code: string,
  options: {
    readonly cascaded?: boolean;
    readonly arrayShadows?: boolean;
  } = {},
): string {
  const helpers =
    options.cascaded === true
      ? `${SHADOW_DEPTH_FROM_CLIP_WGSL}

const STANDARD_SHADOW_MAX_CASCADES: u32 = 4u;
// Fraction of a cascade's view-distance range used as the blend band before
// its far bound, where the current and next cascade factors are mixed (M4-T6).
const STANDARD_SHADOW_CASCADE_BLEND: f32 = 0.12;

fn shadowStrength(lightIndex: u32) -> f32 {
  return clamp(lightFloats[lightFloatOffset(lightIndex) + 24u], 0.0, 1.0);
}

fn shadowDepthBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 25u], 0.0);
}

fn shadowNormalBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 26u], 0.0);
}

fn shadowFilterRadius(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 27u], 0.0);
}

fn shadowFilterType(lightIndex: u32) -> u32 {
  return u32(max(lightFloats[lightFloatOffset(lightIndex) + 28u], 0.0));
}

fn directionalShadowCascadeCount(lightIndex: u32) -> u32 {
  let offset = lightFloatOffset(lightIndex);
  return min(
    min(u32(max(lightFloats[offset + 5u], 0.0)), STANDARD_SHADOW_MAX_CASCADES),
    arrayLength(&directionalShadowMatrices),
  );
}

fn directionalShadowCascadeFarBound(lightIndex: u32, cascadeIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);
  return lightFloats[offset + 6u + cascadeIndex];
}

fn directionalShadowMatrixBaseIndex(lightIndex: u32) -> u32 {
  let offset = lightFloatOffset(lightIndex);
  return u32(max(lightFloats[offset + 10u], 0.0));
}

fn selectDirectionalShadowCascade(lightIndex: u32, worldPosition: vec3f) -> u32 {
  let cascadeCount = directionalShadowCascadeCount(lightIndex);
  let viewDistance = distance(view.cameraPosition.xyz, worldPosition);

  for (var cascadeIndex = 0u; cascadeIndex < STANDARD_SHADOW_MAX_CASCADES; cascadeIndex = cascadeIndex + 1u) {
    if (cascadeIndex >= cascadeCount) {
      return cascadeCount;
    }

    if (viewDistance <= directionalShadowCascadeFarBound(lightIndex, cascadeIndex)) {
      return cascadeIndex;
    }
  }

  return cascadeCount;
}

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, cascadeIndex: u32, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  // M4-T7: the cascaded PCF now honors the authored filter radius (it was
  // previously a fixed one-texel kernel).
  let filterRadius = max(filterRadiusTexels, 0.0);
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
        i32(cascadeIndex),
        receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowPcfSoft(shadowUv: vec2f, receiverDepth: f32, cascadeIndex: u32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var uv = shadowUv;
  let f = fract(uv * shadowMapSize + vec2f(0.5));
  uv = uv - (f - vec2f(0.5)) * texelSize;

  let c1 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, i32(cascadeIndex), receiverDepth, vec2i(-1, 1));
  let c2 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, i32(cascadeIndex), receiverDepth, vec2i(1, 1));
  let c3 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, i32(cascadeIndex), receiverDepth, vec2i(-1, -1));
  let c4 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, i32(cascadeIndex), receiverDepth, vec2i(1, -1));

  let visibility =
    (mix(c1.x, c2.y, f.x) + c1.y + c2.x) * f.y +
    (mix(c1.w, c2.z, f.x) + c1.z + c2.w) +
    (mix(c3.x, c4.y, f.x) + c3.y + c4.x) +
    (mix(c3.w, c4.z, f.x) + c3.z + c4.w) * (1.0 - f.y);
  return visibility * (1.0 / 9.0);
}

// PCSS (M4-T7): a blocker search reads raw shadow-map depths via textureLoad
// (no comparison sampler needed), estimates the average occluder depth, derives
// a contact-hardening penumbra width, then does a variable-radius PCF. Closer
// to the contact point the receiver/blocker depths converge → small penumbra
// (hard edge); farther away the penumbra widens (soft edge).
fn sampleDirectionalShadowPcss(shadowUv: vec2f, receiverDepth: f32, cascadeIndex: u32, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let baseCoord = shadowUv * shadowMapSize;
  let searchRadius = max(filterRadiusTexels, 1.0) * 2.0;
  let maxCoord = vec2i(shadowDimensions) - vec2i(1, 1);
  var blockerSum = 0.0;
  var blockerCount = 0.0;

  for (var y: i32 = -2; y <= 2; y = y + 1) {
    for (var x: i32 = -2; x <= 2; x = x + 1) {
      let coord = clamp(
        vec2i(baseCoord + vec2f(f32(x), f32(y)) * searchRadius),
        vec2i(0, 0),
        maxCoord,
      );
      let occluderDepth = textureLoad(directionalShadowMap, coord, i32(cascadeIndex), 0);

      if (occluderDepth < receiverDepth) {
        blockerSum = blockerSum + occluderDepth;
        blockerCount = blockerCount + 1.0;
      }
    }
  }

  if (blockerCount < 0.5) {
    return 1.0;
  }

  let averageBlockerDepth = blockerSum / blockerCount;
  let penumbraWidth = max(
    (receiverDepth - averageBlockerDepth) / max(averageBlockerDepth, 0.0001),
    0.0,
  ) * max(filterRadiusTexels, 1.0) * 12.0;
  let variableRadius = clamp(penumbraWidth, 1.0, 16.0);

  return sampleDirectionalShadowPcf3x3(shadowUv, receiverDepth, cascadeIndex, variableRadius);
}

fn sampleDirectionalCascadeVisibility(lightIndex: u32, cascadeIndex: u32, biasedPosition: vec3f) -> f32 {
  let matrixIndex = directionalShadowMatrixBaseIndex(lightIndex) + cascadeIndex;

  if (matrixIndex >= arrayLength(&directionalShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[matrixIndex] * vec4f(biasedPosition, 1.0);

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
    clampedShadowDepth - shadowDepthBias(lightIndex),
    0.0,
    1.0,
  );
  // Authored shadowType selects the filter — 0 hard (center compare), 1
  // Three.js PCFSoft-style gather filtering, 2 PCSS (blocker-search contact
  // hardening). The PCFSoft path intentionally ignores shadow radius; in
  // three.js r184 PCFSoftShadowMap uses this fixed weighted gather kernel while
  // radius only affects PCF/VSM-style filters.
  let filterType = shadowFilterType(lightIndex);
  let filterRadius = shadowFilterRadius(lightIndex);
  var rawVisibility: f32;
  if (filterType == 2u) {
    rawVisibility = sampleDirectionalShadowPcss(
      clampedShadowUv,
      receiverDepth,
      cascadeIndex,
      filterRadius,
    );
  } else if (filterType == 0u) {
    rawVisibility = sampleDirectionalShadowPcf3x3(
      clampedShadowUv,
      receiverDepth,
      cascadeIndex,
      0.0,
    );
  } else {
    rawVisibility = sampleDirectionalShadowPcfSoft(
      clampedShadowUv,
      receiverDepth,
      cascadeIndex,
    );
  }
  return select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );
}

fn sampleDirectionalShadowFactor(lightIndex: u32, worldPosition: vec3f, normal: vec3f) -> f32 {
  let cascadeCount = directionalShadowCascadeCount(lightIndex);
  let cascadeIndex = selectDirectionalShadowCascade(lightIndex, worldPosition);

  if (cascadeIndex >= cascadeCount) {
    return 1.0;
  }

  // Normal-offset bias: push the receiver position along its surface normal
  // before projecting into shadow space (reduces acne on grazing surfaces).
  // normalBias is a RAW world-space distance pushed along the surface normal
  // before the shadow-matrix projection (three.js ShadowNode parity:
  // worldPos + normalWorld * normalBias; PlayCanvas uses the same for ortho).
  let biasedPosition = worldPosition + normal * shadowNormalBias(lightIndex);
  var visibility = sampleDirectionalCascadeVisibility(lightIndex, cascadeIndex, biasedPosition);

  // Cascade blend (M4-T6): inside a band before this cascade's far bound, mix
  // the current and NEXT cascade visibility factors (each sampled with its own
  // matrix/layer — never blend the UVs) so the split boundary has no hard seam.
  let nextCascade = cascadeIndex + 1u;
  if (nextCascade < cascadeCount) {
    let farBound = directionalShadowCascadeFarBound(lightIndex, cascadeIndex);
    let nearBound = select(
      0.0,
      directionalShadowCascadeFarBound(lightIndex, max(cascadeIndex, 1u) - 1u),
      cascadeIndex > 0u,
    );
    let bandWidth = max((farBound - nearBound) * STANDARD_SHADOW_CASCADE_BLEND, 0.0001);
    let viewDistance = distance(view.cameraPosition.xyz, worldPosition);
    let blend = clamp((viewDistance - (farBound - bandWidth)) / bandWidth, 0.0, 1.0);
    if (blend > 0.0) {
      let nextVisibility = sampleDirectionalCascadeVisibility(lightIndex, nextCascade, biasedPosition);
      visibility = mix(visibility, nextVisibility, blend);
    }
  }

  return mix(1.0 - shadowStrength(lightIndex), 1.0, visibility);
}

fn sampleDirectionalShadowReceiverFactor(worldPosition: vec3f, normal: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_DIRECTIONAL) {
      factor = min(factor, sampleDirectionalShadowFactor(lightIndex, worldPosition, normal));
    }
  }

  return factor;
}`
      : `${SHADOW_DEPTH_FROM_CLIP_WGSL}

const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.0004;

fn shadowStrength(lightIndex: u32) -> f32 {
  return clamp(lightFloats[lightFloatOffset(lightIndex) + 24u], 0.0, 1.0);
}

fn shadowDepthBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 25u], 0.0);
}

fn directionalShadowStrengthValue() -> f32 {
  for (var strengthIndex = 0u; strengthIndex < lightCount(); strengthIndex = strengthIndex + 1u) {
    if (lightKind(strengthIndex) == LIGHT_KIND_DIRECTIONAL) {
      return shadowStrength(strengthIndex);
    }
  }
  return 1.0;
}

fn directionalShadowDepthBiasValue() -> f32 {
  for (var biasIndex = 0u; biasIndex < lightCount(); biasIndex = biasIndex + 1u) {
    if (lightKind(biasIndex) == LIGHT_KIND_DIRECTIONAL) {
      return max(shadowDepthBias(biasIndex), STANDARD_SHADOW_DEPTH_BIAS);
    }
  }
  return STANDARD_SHADOW_DEPTH_BIAS;
}

fn shadowNormalBias(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 26u], 0.0);
}

fn directionalShadowNormalBiasValue() -> f32 {
  for (var biasIndex = 0u; biasIndex < lightCount(); biasIndex = biasIndex + 1u) {
    if (lightKind(biasIndex) == LIGHT_KIND_DIRECTIONAL) {
      return shadowNormalBias(biasIndex);
    }
  }
  return 0.0;
}

fn shadowFilterRadius(lightIndex: u32) -> f32 {
  return max(lightFloats[lightFloatOffset(lightIndex) + 27u], 0.0);
}

fn directionalShadowFilterRadiusValue() -> f32 {
  for (var filterIndex = 0u; filterIndex < lightCount(); filterIndex = filterIndex + 1u) {
    if (lightKind(filterIndex) == LIGHT_KIND_DIRECTIONAL) {
      return shadowFilterRadius(filterIndex);
    }
  }
  return 1.0;
}

fn shadowFilterType(lightIndex: u32) -> u32 {
  return u32(max(lightFloats[lightFloatOffset(lightIndex) + 28u], 0.0));
}

fn directionalShadowFilterTypeValue() -> u32 {
  for (var filterIndex = 0u; filterIndex < lightCount(); filterIndex = filterIndex + 1u) {
    if (lightKind(filterIndex) == LIGHT_KIND_DIRECTIONAL) {
      return shadowFilterType(filterIndex);
    }
  }
  return 1u;
}

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32${options.arrayShadows === true ? ", layerIndex: u32" : ""}, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  let filterRadius = max(filterRadiusTexels, 0.0);
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
        ${options.arrayShadows === true ? "i32(layerIndex),\n        " : ""}receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowPcfSoft(shadowUv: vec2f, receiverDepth: f32${options.arrayShadows === true ? ", layerIndex: u32" : ""}) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var uv = shadowUv;
  let f = fract(uv * shadowMapSize + vec2f(0.5));
  uv = uv - (f - vec2f(0.5)) * texelSize;

  let c1 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(-1, 1));
  let c2 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(1, 1));
  let c3 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(-1, -1));
  let c4 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(1, -1));

  let visibility =
    (mix(c1.x, c2.y, f.x) + c1.y + c2.x) * f.y +
    (mix(c1.w, c2.z, f.x) + c1.z + c2.w) +
    (mix(c3.x, c4.y, f.x) + c3.y + c4.x) +
    (mix(c3.w, c4.z, f.x) + c3.z + c4.w) * (1.0 - f.y);
  return visibility * (1.0 / 9.0);
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
  if (filterType == 1u) {
    rawVisibility = sampleDirectionalShadowPcfSoft(
      clampedShadowUv,
      receiverDepth${options.arrayShadows === true ? ",\n      matrixBaseIndex" : ""},
    );
  } else {
    rawVisibility = sampleDirectionalShadowPcf3x3(
      clampedShadowUv,
      receiverDepth,
      ${options.arrayShadows === true ? "matrixBaseIndex,\n    " : ""}filterRadiusTexels,
    );
  }
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  let compareFactor = mix(1.0 - directionalShadowStrengthValue(), 1.0, visibility);

  return compareFactor;
}`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${helpers}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );`,
      options.cascaded === true
        ? `      let shadowFactor = sampleDirectionalShadowFactor(lightIndex, input.worldPosition, normal);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`
        : `      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition, normal);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
    );
}

function pointShadowReceiverSamplingBody(pointArrayShadows: boolean): string {
  return pointArrayShadows
    ? `  let receiverDepth = clamp(
    clamp(shadowDepth, 0.0, 1.0) - STANDARD_POINT_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let shadowUv = vec2f(shadowClip.x * 0.5 + 0.5, 0.5 - shadowClip.y * 0.5);
  let clampedShadowUv = clamp(shadowUv, vec2f(0.0), vec2f(1.0));
  let projectionDistance = distance(shadowUv, clampedShadowUv);

  if (projectionDistance > 0.0) {
    return 1.0;
  }

  let layerIndex = matrixBaseIndex + faceIndex;
  let baseVisibility = textureSampleCompareLevel(
    pointShadowMap,
    pointShadowSampler,
    clampedShadowUv,
    i32(layerIndex),
    receiverDepth,
  );
  let filterRadius = max(filterRadiusTexels, 0.0);
  var rawVisibility = baseVisibility;

  if (filterRadius > 0.0) {
    let shadowDimensions = textureDimensions(pointShadowMap);
    let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
    let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
    var visibility = 0.0;

    for (var y: i32 = -1; y <= 1; y = y + 1) {
      for (var x: i32 = -1; x <= 1; x = x + 1) {
        let sampleUv = clamp(
          clampedShadowUv + vec2f(f32(x), f32(y)) * texelSize * filterRadius,
          vec2f(0.0),
          vec2f(1.0),
        );

        visibility = visibility + textureSampleCompareLevel(
          pointShadowMap,
          pointShadowSampler,
          sampleUv,
          i32(layerIndex),
          receiverDepth,
        );
      }
    }

    rawVisibility = visibility * (1.0 / 9.0);
  }
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(1.0 - pointShadowStrengthValue(), 1.0, visibility);`
    : `  let clampedShadowDepth = clamp(shadowDepth, 0.0, 1.0);
  let receiverDepth = clamp(
    clampedShadowDepth - STANDARD_POINT_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let baseDirection = normalize(toReceiver);
  let baseVisibility = textureSampleCompareLevel(
    pointShadowMap,
    pointShadowSampler,
    baseDirection,
    receiverDepth,
  );
  let filterRadius = max(filterRadiusTexels, 0.0);
  var rawVisibility = baseVisibility;

  if (filterRadius > 0.0) {
    let shadowDimensions = textureDimensions(pointShadowMap);
    let cubeSize = f32(max(max(shadowDimensions.x, shadowDimensions.y), 1u));
    let angularRadius = filterRadius * 2.0 / cubeSize;
    var tangentSeed = vec3f(0.0, 1.0, 0.0);
    if (abs(baseDirection.y) > 0.9) {
      tangentSeed = vec3f(1.0, 0.0, 0.0);
    }
    let tangent = normalize(cross(tangentSeed, baseDirection));
    let bitangent = normalize(cross(baseDirection, tangent));

    rawVisibility = (
      baseVisibility +
      textureSampleCompareLevel(pointShadowMap, pointShadowSampler, normalize(toReceiver + tangent * receiverDistance * angularRadius), receiverDepth) +
      textureSampleCompareLevel(pointShadowMap, pointShadowSampler, normalize(toReceiver - tangent * receiverDistance * angularRadius), receiverDepth) +
      textureSampleCompareLevel(pointShadowMap, pointShadowSampler, normalize(toReceiver + bitangent * receiverDistance * angularRadius), receiverDepth) +
      textureSampleCompareLevel(pointShadowMap, pointShadowSampler, normalize(toReceiver - bitangent * receiverDistance * angularRadius), receiverDepth)
    ) * 0.2;
  }
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(1.0 - pointShadowStrengthValue(), 1.0, visibility);`;
}

export function applyStandardPointShadowMapSampling(
  code: string,
  options: {
    readonly pointArrayShadows?: boolean;
  } = {},
): string {
  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${SHADOW_DEPTH_FROM_CLIP_WGSL}

const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

fn shadowStrength(lightIndex: u32) -> f32 {
  return clamp(lightFloats[lightFloatOffset(lightIndex) + 24u], 0.0, 1.0);
}

fn pointShadowStrengthValue() -> f32 {
  for (var strengthIndex = 0u; strengthIndex < lightCount(); strengthIndex = strengthIndex + 1u) {
    if (lightKind(strengthIndex) == LIGHT_KIND_POINT) {
      return shadowStrength(strengthIndex);
    }
  }
  return 1.0;
}

fn pointShadowFaceIndex(toReceiver: vec3f) -> u32 {
  let absDirection = abs(toReceiver);

  if (absDirection.x >= absDirection.y && absDirection.x >= absDirection.z) {
    return select(1u, 0u, toReceiver.x >= 0.0);
  }

  if (absDirection.y >= absDirection.x && absDirection.y >= absDirection.z) {
    return select(3u, 2u, toReceiver.y >= 0.0);
  }

  return select(5u, 4u, toReceiver.z >= 0.0);
}

fn samplePointShadowFactorWithMatrixBase(worldPosition: vec3f, lightPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32 {
  if (arrayLength(&pointShadowMatrices) < matrixBaseIndex + 6u) {
    return 1.0;
  }

  let toReceiver = worldPosition - lightPosition;
  let receiverDistance = length(toReceiver);

  if (receiverDistance <= 0.0001) {
    return 1.0;
  }

  let faceIndex = pointShadowFaceIndex(toReceiver);
  let shadowPosition = pointShadowMatrices[matrixBaseIndex + faceIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = shadowDepthFromClip(shadowClip);

  if (abs(shadowClip.x) > 1.0 || abs(shadowClip.y) > 1.0 || shadowDepth < 0.0 || shadowDepth > 1.0) {
    return 1.0;
  }

${pointShadowReceiverSamplingBody(options.pointArrayShadows === true)}
}

fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32 {
  return samplePointShadowFactorWithMatrixBase(worldPosition, lightPosition, 0u, 0.0);
}

fn samplePointShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_POINT) {
      factor = min(
        factor,
        samplePointShadowFactor(worldPosition, pointLightPosition(lightIndex)),
      );
    }
  }

  return factor;
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = samplePointShadowFactor(input.worldPosition, lightPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let receiverPointShadowFactor = samplePointShadowReceiverFactor(input.worldPosition);
  let color = ambientDiffuse + direct * receiverPointShadowFactor + material.emissiveFactor;`,
    );
}

export function applyStandardMultiShadowMapSampling(
  code: string,
  options: {
    readonly compactClusteredLocalShadows?: boolean;
    readonly arrayShadows?: boolean;
    readonly pointArrayShadows?: boolean;
  } = {},
): string {
  let result = code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${SHADOW_DEPTH_FROM_CLIP_WGSL}

const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.0004;
const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

fn shadowStrength(lightIndex: u32) -> f32 {
  return clamp(lightFloats[lightFloatOffset(lightIndex) + 24u], 0.0, 1.0);
}

fn directionalShadowStrengthValue() -> f32 {
  for (var strengthIndex = 0u; strengthIndex < lightCount(); strengthIndex = strengthIndex + 1u) {
    if (lightKind(strengthIndex) == LIGHT_KIND_DIRECTIONAL) {
      return shadowStrength(strengthIndex);
    }
  }
  return 1.0;
}

fn spotShadowStrengthValue() -> f32 {
  for (var strengthIndex = 0u; strengthIndex < lightCount(); strengthIndex = strengthIndex + 1u) {
    if (lightKind(strengthIndex) == LIGHT_KIND_SPOT) {
      return shadowStrength(strengthIndex);
    }
  }
  return 1.0;
}

fn pointShadowStrengthValue() -> f32 {
  for (var strengthIndex = 0u; strengthIndex < lightCount(); strengthIndex = strengthIndex + 1u) {
    if (lightKind(strengthIndex) == LIGHT_KIND_POINT) {
      return shadowStrength(strengthIndex);
    }
  }
  return 1.0;
}

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32${options.arrayShadows === true ? ", layerIndex: u32" : ""}, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  let filterRadius = max(filterRadiusTexels, 0.0);
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
        ${options.arrayShadows === true ? "i32(layerIndex),\n        " : ""}receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowPcfSoft(shadowUv: vec2f, receiverDepth: f32${options.arrayShadows === true ? ", layerIndex: u32" : ""}) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var uv = shadowUv;
  let f = fract(uv * shadowMapSize + vec2f(0.5));
  uv = uv - (f - vec2f(0.5)) * texelSize;

  let c1 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(-1, 1));
  let c2 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(1, 1));
  let c3 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(-1, -1));
  let c4 = textureGatherCompare(directionalShadowMap, directionalShadowSampler, uv, ${options.arrayShadows === true ? "i32(layerIndex), " : ""}receiverDepth, vec2i(1, -1));

  let visibility =
    (mix(c1.x, c2.y, f.x) + c1.y + c2.x) * f.y +
    (mix(c1.w, c2.z, f.x) + c1.z + c2.w) +
    (mix(c3.x, c4.y, f.x) + c3.y + c4.x) +
    (mix(c3.w, c4.z, f.x) + c3.z + c4.w) * (1.0 - f.y);
  return visibility * (1.0 / 9.0);
}

fn sampleSpotShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32${options.arrayShadows === true ? ", layerIndex: u32" : ""}, filterRadiusTexels: f32) -> f32 {
  let shadowDimensions = textureDimensions(spotShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  let filterRadius = max(filterRadiusTexels, 0.0);
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize * filterRadius,
        vec2f(0.0),
        vec2f(1.0),
      );

      visibility = visibility + textureSampleCompareLevel(
        spotShadowMap,
        spotShadowSampler,
        sampleUv,
        ${options.arrayShadows === true ? "i32(layerIndex),\n        " : ""}receiverDepth,
      );
    }
  }

  return visibility * (1.0 / 9.0);
}

fn sampleDirectionalShadowFactor(worldPosition: vec3f) -> f32 {
  if (arrayLength(&directionalShadowMatrices) == 0u) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[0] * vec4f(worldPosition, 1.0);

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
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleDirectionalShadowPcfSoft(
    clampedShadowUv,
    receiverDepth,
    ${options.arrayShadows === true ? "0u,\n    " : ""}
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(1.0 - directionalShadowStrengthValue(), 1.0, visibility);
}

fn sampleSpotShadowFactorWithMatrixBase(worldPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32 {
  if (matrixBaseIndex >= arrayLength(&spotShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = spotShadowMatrices[matrixBaseIndex] * vec4f(worldPosition, 1.0);

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
    clampedShadowDepth - STANDARD_SHADOW_DEPTH_BIAS,
    0.0,
    1.0,
  );
  let rawVisibility = sampleSpotShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
    ${options.arrayShadows === true ? "matrixBaseIndex,\n    " : ""}filterRadiusTexels,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(1.0 - spotShadowStrengthValue(), 1.0, visibility);
}

fn sampleSpotShadowFactor(worldPosition: vec3f) -> f32 {
  return sampleSpotShadowFactorWithMatrixBase(worldPosition, 0u, 1.0);
}

fn pointShadowFaceIndex(toReceiver: vec3f) -> u32 {
  let absDirection = abs(toReceiver);

  if (absDirection.x >= absDirection.y && absDirection.x >= absDirection.z) {
    return select(1u, 0u, toReceiver.x >= 0.0);
  }

  if (absDirection.y >= absDirection.x && absDirection.y >= absDirection.z) {
    return select(3u, 2u, toReceiver.y >= 0.0);
  }

  return select(5u, 4u, toReceiver.z >= 0.0);
}

fn samplePointShadowFactorWithMatrixBase(worldPosition: vec3f, lightPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32 {
  if (arrayLength(&pointShadowMatrices) < matrixBaseIndex + 6u) {
    return 1.0;
  }

  let toReceiver = worldPosition - lightPosition;
  let receiverDistance = length(toReceiver);

  if (receiverDistance <= 0.0001) {
    return 1.0;
  }

  let faceIndex = pointShadowFaceIndex(toReceiver);
  let shadowPosition = pointShadowMatrices[matrixBaseIndex + faceIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = shadowDepthFromClip(shadowClip);

  if (abs(shadowClip.x) > 1.0 || abs(shadowClip.y) > 1.0 || shadowDepth < 0.0 || shadowDepth > 1.0) {
    return 1.0;
  }

${pointShadowReceiverSamplingBody(options.pointArrayShadows === true)}
}

fn samplePointShadowFactor(worldPosition: vec3f, lightPosition: vec3f) -> f32 {
  return samplePointShadowFactorWithMatrixBase(worldPosition, lightPosition, 0u, 0.0);
}

fn samplePointShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_POINT) {
      factor = min(
        factor,
        samplePointShadowFactor(worldPosition, pointLightPosition(lightIndex)),
      );
    }
  }

  return factor;
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );`,
      `      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = samplePointShadowFactor(input.worldPosition, lightPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          toLight / lightDistance,
          lightRadiance(lightIndex) * attenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        );`,
      `        let shadowFactor = sampleSpotShadowFactor(input.worldPosition);
        direct = direct + evaluateDirectLight(
          normal,
          viewDir,
          lightDir,
          lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation,
          baseColor,
          metallic,
          roughness,
        ) * shadowFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  let receiverShadowFactor = min(
    min(
      sampleDirectionalShadowFactor(input.worldPosition),
      sampleSpotShadowFactor(input.worldPosition),
    ),
    samplePointShadowReceiverFactor(input.worldPosition),
  );
  let color = ambientDiffuse + direct * receiverShadowFactor + material.emissiveFactor;`,
    );

  if (options.compactClusteredLocalShadows === true) {
    result = result
      .replaceAll("spotShadowMatrices", "directionalShadowMatrices")
      .replaceAll("spotShadowMap", "directionalShadowMap")
      .replaceAll("spotShadowSampler", "directionalShadowSampler");
  }

  return result;
}
