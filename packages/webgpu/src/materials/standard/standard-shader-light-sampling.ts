import {
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_DEFERRED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED,
  LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
} from "../../lighting/local-light-clusters.js";

export function applyStandardClusteredLocalLightSampling(
  code: string,
  options: {
    readonly pointShadowMap: boolean;
    readonly pointArrayShadowMap: boolean;
    readonly spotShadowMap: boolean;
    readonly localLightCookies: boolean;
    readonly localLightShadowCookies: boolean;
    readonly localLightArrayCookies: boolean;
    readonly localLightCubeCookies: boolean;
    readonly singleSpotShadowMap: boolean;
    readonly removeGlobalPointShadowReceiverFactor: boolean;
    readonly removeGlobalSpotShadowReceiverFactor: boolean;
  },
): string {
  const pointShadowFactorFunction = options.pointShadowMap
    ? `fn localLightClusterPointShadowFactor(position: vec3f, lightIndex: u32, lightPosition: vec3f) -> f32 {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST}u) == 0u) {
    return 1.0;
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedShadowFactor(lightIndex);
  }

  return samplePointShadowFactorWithMatrixBase(
    position,
    lightPosition,
    localLightClusterPointShadowMatrixBase(lightIndex),
    localLightClusterShadowFilterRadiusTexels(lightIndex),
  );
}`
    : `fn localLightClusterPointShadowFactor(position: vec3f, lightIndex: u32, lightPosition: vec3f) -> f32 {
  _ = position;
  _ = lightPosition;
  return localLightClusterUnsupportedShadowFactor(lightIndex);
}`;
  const spotShadowSampleExpression = options.singleSpotShadowMap
    ? `  let filterType = shadowFilterType(lightIndex);
  let filterRadius = select(
    max(localLightClusterShadowFilterRadiusTexels(lightIndex), 1.0),
    0.0,
    filterType == 0u,
  );
  return sampleSpotShadowFactorWithMatrixBase(
    position,
    localLightClusterPointShadowMatrixBase(lightIndex),
    filterRadius,
    max(shadowDepthBias(lightIndex), STANDARD_SHADOW_DEPTH_BIAS),
    filterType,
  );`
    : `  return sampleSpotShadowFactorWithMatrixBase(
    position,
    localLightClusterPointShadowMatrixBase(lightIndex),
    localLightClusterShadowFilterRadiusTexels(lightIndex),
  );`;
  const spotShadowFactorFunction = options.spotShadowMap
    ? `fn localLightClusterSpotShadowFactor(position: vec3f, lightIndex: u32) -> f32 {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST}u) == 0u) {
    return 1.0;
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedShadowFactor(lightIndex);
  }

${spotShadowSampleExpression}
}`
    : `fn localLightClusterSpotShadowFactor(position: vec3f, lightIndex: u32) -> f32 {
  _ = position;
  return localLightClusterUnsupportedShadowFactor(lightIndex);
}`;
  const pointCookieColorFunction = (() => {
    if (options.localLightCookies && options.localLightCubeCookies) {
      return `fn localLightClusterPointCookieColor(position: vec3f, lightIndex: u32, lightPosition: vec3f) -> vec3f {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST}u) == 0u) {
    return vec3f(1.0);
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let matrixBaseIndex = localLightClusterCookieMatrixBase(lightIndex);

  if (matrixBaseIndex >= arrayLength(&localLightClusterCookieMatrices)) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let toReceiver = position - lightPosition;

  if (length(toReceiver) <= 0.0001) {
    return vec3f(1.0);
  }

  let cookieTexel = textureSampleLevel(
    localLightClusterCookieTexture,
    localLightClusterCookieSampler,
    normalize(toReceiver),
    0.0,
  ).rgb;
  return mix(vec3f(1.0), cookieTexel, saturate(localLightClusterCookieIntensity(lightIndex)));
}`;
    }

    if (options.localLightCookies && options.localLightArrayCookies) {
      return `struct LocalLightClusterCubeFaceCoordinates {
  uv: vec2f,
  faceIndex: u32,
}

fn localLightClusterCubeFaceCoordinates(dir: vec3f) -> LocalLightClusterCubeFaceCoordinates {
  let vAbs = abs(dir);
  var uv = vec2f(0.5);
  var faceIndex = 0u;
  var ma = 0.5;

  if (vAbs.z >= vAbs.x && vAbs.z >= vAbs.y) {
    let negZ = dir.z < 0.0;
    faceIndex = select(4u, 5u, negZ);
    ma = 0.5 / max(vAbs.z, 0.00001);
    uv = vec2f(select(dir.x, -dir.x, negZ), -dir.y);
  } else if (vAbs.y >= vAbs.x) {
    let negY = dir.y < 0.0;
    faceIndex = select(2u, 3u, negY);
    ma = 0.5 / max(vAbs.y, 0.00001);
    uv = vec2f(dir.x, select(dir.z, -dir.z, negY));
  } else {
    let negX = dir.x < 0.0;
    faceIndex = select(0u, 1u, negX);
    ma = 0.5 / max(vAbs.x, 0.00001);
    uv = vec2f(select(-dir.z, dir.z, negX), -dir.y);
  }

  return LocalLightClusterCubeFaceCoordinates(uv * ma + vec2f(0.5), faceIndex);
}

fn localLightClusterPointCookieColor(position: vec3f, lightIndex: u32, lightPosition: vec3f) -> vec3f {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST}u) == 0u) {
    return vec3f(1.0);
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let layerBaseIndex = localLightClusterCookieMatrixBase(lightIndex);
  let toReceiver = position - lightPosition;

  if (length(toReceiver) <= 0.0001) {
    return vec3f(1.0);
  }

  let faceCoordinates = localLightClusterCubeFaceCoordinates(normalize(toReceiver));
  let layerIndex = layerBaseIndex + faceCoordinates.faceIndex;

  if (layerIndex >= arrayLength(&localLightClusterCookieMatrices)) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let cookieTexel = textureSampleLevel(
    localLightClusterCookieTexture,
    localLightClusterCookieSampler,
    clamp(faceCoordinates.uv, vec2f(0.0), vec2f(1.0)),
    i32(layerIndex),
    0.0,
  ).rgb;
  return mix(vec3f(1.0), cookieTexel, saturate(localLightClusterCookieIntensity(lightIndex)));
}`;
    }

    return `fn localLightClusterPointCookieColor(position: vec3f, lightIndex: u32, lightPosition: vec3f) -> vec3f {
  _ = position;
  _ = lightPosition;
  return localLightClusterUnsupportedCookieColor(lightIndex);
}`;
  })();
  const spotCookieSampleExpression = options.localLightArrayCookies
    ? `textureSampleLevel(
    localLightClusterCookieTexture,
    localLightClusterCookieSampler,
    clampedCookieUv,
    i32(matrixBaseIndex),
    0.0,
  ).rgb`
    : `textureSampleLevel(
    localLightClusterCookieTexture,
    localLightClusterCookieSampler,
    clampedCookieUv,
    0.0,
  ).rgb`;
  const spotCookieColorFunction =
    options.localLightCookies &&
    options.localLightShadowCookies &&
    options.spotShadowMap
      ? `fn localLightClusterSpotCookieColor(position: vec3f, lightIndex: u32) -> vec3f {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST}u) == 0u) {
    return vec3f(1.0);
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let matrixBaseIndex = localLightClusterPointShadowMatrixBase(lightIndex);

  if (matrixBaseIndex >= arrayLength(&directionalShadowMatrices)) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let cookiePosition = directionalShadowMatrices[matrixBaseIndex] * vec4f(position, 1.0);

  if (abs(cookiePosition.w) <= 0.00001) {
    return vec3f(1.0);
  }

  let cookieClip = cookiePosition.xyz / cookiePosition.w;
  let cookieUv = vec2f(cookieClip.x * 0.5 + 0.5, 0.5 - cookieClip.y * 0.5);
  let clampedCookieUv = clamp(cookieUv, vec2f(0.0), vec2f(1.0));
  let outsideCookie = distance(cookieUv, clampedCookieUv) > 0.0;

  if (outsideCookie) {
    return vec3f(0.0);
  }

  let cookieTexel = textureSampleLevel(
    localLightClusterCookieTexture,
    localLightClusterCookieSampler,
    clampedCookieUv,
    0.0,
  ).rgb;
  return mix(vec3f(1.0), cookieTexel, saturate(localLightClusterCookieIntensity(lightIndex)));
}`
      : options.localLightCookies && !options.localLightCubeCookies
        ? `fn localLightClusterSpotCookieColor(position: vec3f, lightIndex: u32) -> vec3f {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST}u) == 0u) {
    return vec3f(1.0);
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let matrixBaseIndex = localLightClusterCookieMatrixBase(lightIndex);

  if (matrixBaseIndex >= arrayLength(&localLightClusterCookieMatrices)) {
    return localLightClusterUnsupportedCookieColor(lightIndex);
  }

  let cookiePosition = localLightClusterCookieMatrices[matrixBaseIndex] * vec4f(position, 1.0);

  if (abs(cookiePosition.w) <= 0.00001) {
    return vec3f(1.0);
  }

  let cookieClip = cookiePosition.xyz / cookiePosition.w;
  let cookieUv = vec2f(cookieClip.x * 0.5 + 0.5, 0.5 - cookieClip.y * 0.5);
  let clampedCookieUv = clamp(cookieUv, vec2f(0.0), vec2f(1.0));
  let outsideCookie = distance(cookieUv, clampedCookieUv) > 0.0;

  if (outsideCookie) {
    return vec3f(0.0);
  }

  let cookieTexel = ${spotCookieSampleExpression};
  return mix(vec3f(1.0), cookieTexel, saturate(localLightClusterCookieIntensity(lightIndex)));
}`
        : `fn localLightClusterSpotCookieColor(position: vec3f, lightIndex: u32) -> vec3f {
  _ = position;
  return localLightClusterUnsupportedCookieColor(lightIndex);
}`;
  const clusteredLightLoop = `  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    let kind = lightKind(lightIndex);

    if (kind == LIGHT_KIND_AMBIENT) {
      ambient = ambient + lightRadiance(lightIndex);
    }

    if (kind == LIGHT_KIND_DIRECTIONAL) {
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );
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

  direct = direct + evaluateClusteredLocalLights(
    input.worldPosition,
    normal,
    viewDir,
    baseColor,
    metallic,
    roughness,
  );`;

  const result = code
    .replace(
      `@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {`,
      `fn localLightClusterEnabled() -> bool {
  return arrayLength(&localLightClusterParams) >= 28u && localLightClusterParams[11] > 0.5;
}

fn localLightClusterDimensions() -> vec3u {
  return max(
    vec3u(
      u32(max(localLightClusterParams[8], 1.0)),
      u32(max(localLightClusterParams[9], 1.0)),
      u32(max(localLightClusterParams[10], 1.0)),
    ),
    vec3u(1u),
  );
}

fn localLightClusterInvalidCell() -> u32 {
  return 4294967295u;
}

fn localLightClusterMetadataFlags(lightIndex: u32) -> u32 {
  let metadataOffset = lightIndex * ${LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE}u;

  if (metadataOffset >= arrayLength(&localLightClusterMetadata)) {
    return 0u;
  }

  return localLightClusterMetadata[metadataOffset];
}

fn localLightClusterPointShadowMatrixBase(lightIndex: u32) -> u32 {
  let metadataOffset = lightIndex * ${LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE}u + 2u;

  if (metadataOffset >= arrayLength(&localLightClusterMetadata)) {
    return 0u;
  }

  return localLightClusterMetadata[metadataOffset];
}

fn localLightClusterCookieMatrixBase(lightIndex: u32) -> u32 {
  let metadataOffset = lightIndex * ${LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE}u + 3u;

  if (metadataOffset >= arrayLength(&localLightClusterMetadata)) {
    return 0u;
  }

  return localLightClusterMetadata[metadataOffset];
}

fn localLightClusterShadowFilterRadiusTexels(lightIndex: u32) -> f32 {
  let metadataOffset = lightIndex * ${LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE}u + 4u;

  if (metadataOffset >= arrayLength(&localLightClusterMetadata)) {
    return 1.0;
  }

  return f32(localLightClusterMetadata[metadataOffset]);
}

fn localLightClusterCookieIntensity(lightIndex: u32) -> f32 {
  let offset = lightFloatOffset(lightIndex);

  if (offset + 11u >= arrayLength(&lightFloats)) {
    return 1.0;
  }

  return max(lightFloats[offset + 11u], 0.0);
}

fn localLightClusterUnsupportedShadowFactor(lightIndex: u32) -> f32 {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED}u) != 0u) {
    return 0.99999994;
  }

  return 1.0;
}

fn localLightClusterUnsupportedCookieColor(lightIndex: u32) -> vec3f {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_DEFERRED}u) != 0u) {
    return vec3f(0.99999994);
  }

  return vec3f(1.0);
}

${pointShadowFactorFunction}

${spotShadowFactorFunction}

${pointCookieColorFunction}

${spotCookieColorFunction}

fn localLightClusterViewMatrix() -> mat4x4f {
  return mat4x4f(
    vec4f(
      localLightClusterParams[12],
      localLightClusterParams[13],
      localLightClusterParams[14],
      localLightClusterParams[15],
    ),
    vec4f(
      localLightClusterParams[16],
      localLightClusterParams[17],
      localLightClusterParams[18],
      localLightClusterParams[19],
    ),
    vec4f(
      localLightClusterParams[20],
      localLightClusterParams[21],
      localLightClusterParams[22],
      localLightClusterParams[23],
    ),
    vec4f(
      localLightClusterParams[24],
      localLightClusterParams[25],
      localLightClusterParams[26],
      localLightClusterParams[27],
    ),
  );
}

fn localLightClusterSamplePosition(position: vec3f) -> vec3f {
  if (localLightClusterParams[3] > 0.5) {
    return (localLightClusterViewMatrix() * vec4f(position, 1.0)).xyz;
  }

  return position;
}

fn localLightClusterCellIndex(position: vec3f) -> u32 {
  if (!localLightClusterEnabled()) {
    return localLightClusterInvalidCell();
  }

  let minBounds = vec3f(
    localLightClusterParams[0],
    localLightClusterParams[1],
    localLightClusterParams[2],
  );
  let invCellSize = vec3f(
    localLightClusterParams[4],
    localLightClusterParams[5],
    localLightClusterParams[6],
  );
  let dimensions = localLightClusterDimensions();
  let samplePosition = localLightClusterSamplePosition(position);
  let clusterPosition = (samplePosition - minBounds) * invCellSize;

  if (
    clusterPosition.x < 0.0 ||
    clusterPosition.y < 0.0 ||
    clusterPosition.z < 0.0 ||
    clusterPosition.x >= f32(dimensions.x) ||
    clusterPosition.y >= f32(dimensions.y) ||
    clusterPosition.z >= f32(dimensions.z)
  ) {
    return localLightClusterInvalidCell();
  }

  let x = min(u32(clusterPosition.x), dimensions.x - 1u);
  let y = min(u32(clusterPosition.y), dimensions.y - 1u);
  let z = min(u32(clusterPosition.z), dimensions.z - 1u);
  return x + y * dimensions.x + z * dimensions.x * dimensions.y;
}

fn evaluateClusteredLocalLights(
  position: vec3f,
  normal: vec3f,
  viewDir: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let cellIndex = localLightClusterCellIndex(position);

  if (cellIndex == localLightClusterInvalidCell()) {
    return vec3f(0.0);
  }

  let cellOffset = cellIndex * 2u;

  if (cellOffset + 1u >= arrayLength(&localLightClusterCells)) {
    return vec3f(0.0);
  }

  let lightOffset = localLightClusterCells[cellOffset];
  let localLightCount = localLightClusterCells[cellOffset + 1u];
  var clusteredDirect = vec3f(0.0);

  for (
    var itemIndex = 0u;
    itemIndex < localLightCount && lightOffset + itemIndex < arrayLength(&localLightClusterIndices);
    itemIndex = itemIndex + 1u
  ) {
    let lightIndex = localLightClusterIndices[lightOffset + itemIndex];

    if (lightIndex < lightCount()) {
      let kind = lightKind(lightIndex);

      if (kind == LIGHT_KIND_POINT) {
        let lightPosition = pointLightPosition(lightIndex);
        let toLight = lightPosition - position;
        let lightDistance = length(toLight);
        let lightRange = pointLightRange(lightIndex);
        let attenuation = punctualDistanceAttenuation(lightDistance, lightRange);

        if (attenuation > 0.0 && lightDistance > 0.0001) {
          let shadowFactor = localLightClusterPointShadowFactor(position, lightIndex, lightPosition);
          let cookieColor = localLightClusterPointCookieColor(position, lightIndex, lightPosition);
          clusteredDirect = clusteredDirect + evaluateDirectLight(
            normal,
            viewDir,
            toLight / lightDistance,
            lightRadiance(lightIndex) * attenuation * shadowFactor * cookieColor,
            baseColor,
            metallic,
            roughness,
          );
        }
      }

      if (kind == LIGHT_KIND_SPOT) {
        let lightPosition = pointLightPosition(lightIndex);
        let toLight = lightPosition - position;
        let lightDistance = length(toLight);
        let lightRange = pointLightRange(lightIndex);
        let rangeAttenuation = punctualDistanceAttenuation(lightDistance, lightRange);

        if (rangeAttenuation > 0.0 && lightDistance > 0.0001) {
          let lightDir = toLight / lightDistance;
          let coneAttenuation = spotLightConeAttenuation(lightIndex, -lightDir);
          let shadowFactor = localLightClusterSpotShadowFactor(position, lightIndex);
          let cookieColor = localLightClusterSpotCookieColor(position, lightIndex);
          clusteredDirect = clusteredDirect + evaluateDirectLight(
            normal,
            viewDir,
            lightDir,
            lightRadiance(lightIndex) * rangeAttenuation * coneAttenuation * shadowFactor * cookieColor,
            baseColor,
            metallic,
            roughness,
          );
        }
      }
    }
  }

  return clusteredDirect;
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {`,
    )
    .replace(
      `  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    let kind = lightKind(lightIndex);

    if (kind == LIGHT_KIND_AMBIENT) {
      ambient = ambient + lightRadiance(lightIndex);
    }

    if (kind == LIGHT_KIND_DIRECTIONAL) {
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      );
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
  }`,
      clusteredLightLoop,
    )
    .replace(
      /([ ]{2}var ambient = vec3f\(0\.0\);\n[ ]{2}var direct = vec3f\(0\.0\);\n\n)[ ]{2}for \(var lightIndex = 0u; lightIndex < lightCount\(\); lightIndex = lightIndex \+ 1u\) \{[\s\S]*?\n[ ]{2}\}(?=\n\n(?:[ ]{2}\/\/ @aperture-standard-fragment-assembly:begin\n)?[ ]{2}(?:let|var) )/u,
      `$1${clusteredLightLoop}`,
    );

  return result;
}
