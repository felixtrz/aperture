import {
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_DEFERRED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_SAMPLING_SUPPORTED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED,
  LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED,
  LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
} from "../../lighting/local-light-clusters.js";
import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

export function applyStandardIridescenceSampling(
  code: string,
  options: {
    readonly textureSample: string | null;
    readonly thicknessTextureSample?: string | null;
  } = { textureSample: null, thicknessTextureSample: null },
): string {
  const iridescenceFactorExpression =
    options.textureSample === null
      ? "material.iridescenceFactorIorThickness.x"
      : `material.iridescenceFactorIorThickness.x * ${options.textureSample}`;
  const iridescenceThicknessExpression =
    options.thicknessTextureSample === undefined ||
    options.thicknessTextureSample === null
      ? "material.iridescenceFactorIorThickness.w"
      : `mix(material.iridescenceFactorIorThickness.z, material.iridescenceFactorIorThickness.w, ${options.thicknessTextureSample})`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `${STANDARD_IRIDESCENCE_WGSL}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replaceAll(
      `  roughness: f32,
`,
      `  roughness: f32,
  iridescence: f32,
  iridescenceThickness: f32,
`,
    )
    .replace(
      /\n(\s*)roughness,\n/gu,
      "\n$1roughness,\n$1iridescence,\n$1iridescenceThickness,\n",
    )
    .replace(
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);`,
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let iridescenceIor = clamp(material.iridescenceFactorIorThickness.y, 1.0, 2.333);
  var fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let iridescenceFresnel = standardIridescenceFresnel(
    max(dot(normal, viewDir), 0.0),
    f0,
    iridescenceThickness,
    iridescenceIor,
  );
  fresnel = mix(fresnel, iridescenceFresnel, iridescence);`,
    )
    .replace(
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(viewDir, lightDir), 0.0), f0);`,
      `  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let iridescenceIor = clamp(material.iridescenceFactorIorThickness.y, 1.0, 2.333);
  var fresnel = fresnelSchlick(max(dot(viewDir, lightDir), 0.0), f0);
  let iridescenceFresnel = standardIridescenceFresnel(
    max(dot(normal, viewDir), 0.0),
    f0,
    iridescenceThickness,
    iridescenceIor,
  );
  fresnel = mix(fresnel, iridescenceFresnel, iridescence);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let iridescence = clamp(${iridescenceFactorExpression}, 0.0, 1.0);
  let iridescenceThickness = clamp(${iridescenceThicknessExpression}, 0.0, 1200.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let iridescence = clamp(${iridescenceFactorExpression}, 0.0, 1.0);
  let iridescenceThickness = clamp(${iridescenceThicknessExpression}, 0.0, 1200.0);`,
    );
}

const STANDARD_IRIDESCENCE_WGSL = `
fn iridescenceIorToFresnelScalar(transmittedIor: f32, incidentIor: f32) -> f32 {
  return pow((transmittedIor - incidentIor) / (transmittedIor + incidentIor), 2.0);
}

fn iridescenceIorToFresnelVec3(transmittedIor: vec3f, incidentIor: f32) -> vec3f {
  return pow((transmittedIor - vec3f(incidentIor)) / (transmittedIor + vec3f(incidentIor)), vec3f(2.0));
}

fn iridescenceFresnelToIor(f0: vec3f) -> vec3f {
  let safeF0 = clamp(f0, vec3f(0.0001), vec3f(0.99));
  let sqrtF0 = sqrt(safeF0);
  return (vec3f(1.0) + sqrtF0) / (vec3f(1.0) - sqrtF0);
}

const IRIDESCENCE_XYZ_TO_REC709: mat3x3f = mat3x3f(
  vec3f(3.2404542, -1.5371385, -0.4985314),
  vec3f(-0.9692660, 1.8760108, 0.0415560),
  vec3f(0.0556434, -0.2040259, 1.0572252)
);

fn iridescenceSensitivity(opd: f32, shift: vec3f) -> vec3f {
  let phase = 2.0 * PI * opd * 1.0e-9;
  let primaryValue = vec3f(5.4856e-13, 4.4201e-13, 5.2481e-13);
  let primaryPosition = vec3f(1.6810e+06, 1.7953e+06, 2.2084e+06);
  let primaryVariance = vec3f(4.3278e+09, 9.3046e+09, 6.6121e+09);
  var xyz = primaryValue * sqrt(2.0 * PI * primaryVariance) *
    cos(primaryPosition * phase + shift) *
    exp(-pow(phase, 2.0) * primaryVariance);
  xyz = xyz + vec3f(
    9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) *
      cos(2.2399e+06 * phase + shift.x) *
      exp(-4.5282e+09 * pow(phase, 2.0)),
    0.0,
    0.0,
  );
  return IRIDESCENCE_XYZ_TO_REC709 * (xyz / vec3f(1.0685e-07));
}

fn iridescenceFresnelScalar(cosTheta: f32, f0: f32) -> f32 {
  let x = clamp(1.0 - cosTheta, 0.0, 1.0);
  let x2 = x * x;
  return f0 + (1.0 - f0) * x * x2 * x2;
}

fn iridescenceFresnelVec3(cosTheta: f32, f0: vec3f) -> vec3f {
  let x = clamp(1.0 - cosTheta, 0.0, 1.0);
  let x2 = x * x;
  return f0 + (vec3f(1.0) - f0) * x * x2 * x2;
}

fn standardIridescenceFresnel(cosTheta: f32, baseF0: vec3f, thickness: f32, filmIor: f32) -> vec3f {
  let outsideIor = 1.0;
  let iridescenceIor = mix(outsideIor, filmIor, smoothstep(0.0, 0.03, thickness));
  let sinTheta2Sq = pow(outsideIor / iridescenceIor, 2.0) * (1.0 - pow(cosTheta, 2.0));
  let cosTheta2Sq = 1.0 - sinTheta2Sq;

  if (cosTheta2Sq < 0.0) {
    return vec3f(1.0);
  }

  let cosTheta2 = sqrt(cosTheta2Sq);
  let r0 = iridescenceIorToFresnelScalar(iridescenceIor, outsideIor);
  let r12 = iridescenceFresnelScalar(cosTheta, r0);
  let t121 = 1.0 - r12;
  let phi12 = select(0.0, PI, iridescenceIor < outsideIor);
  let phi21 = PI - phi12;
  let baseIor = iridescenceFresnelToIor(baseF0 + vec3f(0.0001));
  let r1 = iridescenceIorToFresnelVec3(baseIor, iridescenceIor);
  let r23 = iridescenceFresnelVec3(cosTheta2, r1);
  let phi23 = select(vec3f(0.0), vec3f(PI), baseIor < vec3f(iridescenceIor));
  let opd = 2.0 * iridescenceIor * thickness * cosTheta2;
  let phi = vec3f(phi21) + phi23;
  let r123Sq = clamp(vec3f(r12) * r23, vec3f(1e-5), vec3f(0.9999));
  let r123 = sqrt(r123Sq);
  let rs = pow(vec3f(t121), vec3f(2.0)) * r23 / (vec3f(1.0) - r123Sq);
  var color = vec3f(r12) + rs;
  var coefficient = (rs - vec3f(t121)) * r123;
  color = color + coefficient * (2.0 * iridescenceSensitivity(opd, phi));
  coefficient = coefficient * r123;
  color = color + coefficient * (2.0 * iridescenceSensitivity(2.0 * opd, 2.0 * phi));
  return max(color, vec3f(0.0));
}`;

export function applyStandardClearcoatSampling(
  code: string,
  options: {
    readonly textureSample: string | null;
    readonly roughnessTextureSample?: string | null;
  } = { textureSample: null, roughnessTextureSample: null },
): string {
  const clearcoatTextureFactor = options.textureSample ?? "1.0";
  const clearcoatRoughnessFactor =
    options.roughnessTextureSample === undefined ||
    options.roughnessTextureSample === null
      ? "1.0"
      : options.roughnessTextureSample;
  const withClearcoatFactor = code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  clearcoatFactor: f32,
  clearcoatRoughness: f32,
) -> vec3f {`,
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
      `      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
        clearcoatFactor,
        clearcoatRoughness,
      );`,
    )
    .replaceAll(
      `        roughness,
      ) * shadowFactor;`,
      `        roughness,
        clearcoatFactor,
        clearcoatRoughness,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        ) * shadowFactor;`,
      `          roughness,
          clearcoatFactor,
          clearcoatRoughness,
        ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        );`,
      `          roughness,
          clearcoatFactor,
          clearcoatRoughness,
        );`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let clearcoatFactor = clamp(material.clearcoatFactor * ${clearcoatTextureFactor}, 0.0, 1.0);
  let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * ${clearcoatRoughnessFactor}, 0.045, 1.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let clearcoatFactor = clamp(material.clearcoatFactor * ${clearcoatTextureFactor}, 0.0, 1.0);
  let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * ${clearcoatRoughnessFactor}, 0.045, 1.0);`,
    );

  return withClearcoatFactor.replace(
    `  var brdf = diffuse + specular;
  return brdf * radiance * nDotL;`,
    `  let clearcoatFresnel = fresnelSchlick(
    max(dot(halfVector, viewDir), 0.0),
    vec3f(0.04),
  );
  let clearcoatDistribution = distributionGGX(normal, halfVector, clearcoatRoughness);
  let clearcoatVisibility = geometrySmith(normal, viewDir, lightDir, clearcoatRoughness);
  let clearcoatSpecular = (clearcoatDistribution * clearcoatVisibility * clearcoatFresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let clearcoatAttenuation = vec3f(1.0) - clearcoatFactor * clearcoatFresnel;
  var brdf = (diffuse + specular) * clearcoatAttenuation + clearcoatSpecular * clearcoatFactor;
  return brdf * radiance * nDotL;`,
  );
}

export function applyStandardSheenSampling(
  code: string,
  options: {
    readonly colorTextureSample: string | null;
    readonly roughnessTextureSample: string | null;
  },
): string {
  const sheenColorExpression =
    options.colorTextureSample === null
      ? "material.sheenColorRoughnessFactor.rgb"
      : `material.sheenColorRoughnessFactor.rgb * ${options.colorTextureSample}`;
  const sheenRoughnessExpression =
    options.roughnessTextureSample === null
      ? "material.sheenColorRoughnessFactor.a"
      : `material.sheenColorRoughnessFactor.a * ${options.roughnessTextureSample}`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  sheenColor: vec3f,
  sheenRoughness: f32,`,
    )
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  clearcoatFactor: f32,`,
      `fn evaluateDirectLight(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
  sheenColor: vec3f,
  sheenRoughness: f32,
  clearcoatFactor: f32,`,
    )
    .replaceAll(
      `        roughness,
      );`,
      `        roughness,
        sheenColor,
        sheenRoughness,
      );`,
    )
    .replaceAll(
      `        roughness,
        clearcoatFactor,
      );`,
      `        roughness,
        sheenColor,
        sheenRoughness,
        clearcoatFactor,
      );`,
    )
    .replaceAll(
      `        roughness,
      ) * shadowFactor;`,
      `        roughness,
        sheenColor,
        sheenRoughness,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `        roughness,
        clearcoatFactor,
      ) * shadowFactor;`,
      `        roughness,
        sheenColor,
        sheenRoughness,
        clearcoatFactor,
      ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
        );`,
      `          roughness,
          sheenColor,
          sheenRoughness,
        );`,
    )
    .replaceAll(
      `          roughness,
          clearcoatFactor,
        );`,
      `          roughness,
          sheenColor,
          sheenRoughness,
          clearcoatFactor,
        );`,
    )
    .replaceAll(
      `          roughness,
        ) * shadowFactor;`,
      `          roughness,
          sheenColor,
          sheenRoughness,
        ) * shadowFactor;`,
    )
    .replaceAll(
      `          roughness,
          clearcoatFactor,
        ) * shadowFactor;`,
      `          roughness,
          sheenColor,
          sheenRoughness,
          clearcoatFactor,
        ) * shadowFactor;`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor, 0.045, 1.0);
  let sheenColor = clamp(${sheenColorExpression}, vec3f(0.0), vec3f(1.0));
  let sheenRoughness = clamp(${sheenRoughnessExpression}, 0.045, 1.0);`,
    )
    .replace(
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);`,
      `  let metallic = clamp(material.metallicFactor * metallicRoughnessSample.b, 0.0, 1.0);
  let roughness = clamp(material.roughnessFactor * metallicRoughnessSample.g, 0.045, 1.0);
  let sheenColor = clamp(${sheenColorExpression}, vec3f(0.0), vec3f(1.0));
  let sheenRoughness = clamp(${sheenRoughnessExpression}, 0.045, 1.0);`,
    )
    .replace(
      `      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
        sheenColor,
        sheenRoughness,
      );`,
      `      direct = direct + evaluateAreaLight(
        lightIndex,
        input.worldPosition,
        normal,
        viewDir,
        baseColor,
        metallic,
        roughness,
      );`,
    )
    .replace(
      `  return brdf * radiance * nDotL;`,
      `  let sheenInvRoughness = 1.0 / max(sheenRoughness * sheenRoughness, 0.0001);
  let sheenNoH2 = pow(max(dot(normal, halfVector), 0.0), 2.0);
  let sheenSin2H = max(1.0 - sheenNoH2, 0.0078125);
  let sheenDistribution = (2.0 + sheenInvRoughness) *
    pow(sheenSin2H, sheenInvRoughness * 0.5) / (2.0 * PI);
  let sheenVisibility = 1.0 /
    max(4.0 * (max(dot(normal, viewDir), 0.000001) + nDotL -
    max(dot(normal, viewDir), 0.000001) * nDotL), 0.000001);
  let sheenSpecular = sheenDistribution * sheenVisibility * sheenColor;
  let sheenAttenuation = 1.0 - max(max(sheenColor.r, sheenColor.g), sheenColor.b) * 0.157;
  brdf = brdf * sheenAttenuation + sheenSpecular;
  return brdf * radiance * nDotL;`,
    );
}

export function applyStandardTransmissionSampling(
  code: string,
  options: { readonly textureSample: string | null } = { textureSample: null },
): string {
  const transmissionTextureFactor = options.textureSample ?? "1.0";
  const fragmentStart = code.indexOf(`@fragment\nfn fs_main`);
  const withMutableFragment =
    fragmentStart < 0
      ? code
      : `${code.slice(0, fragmentStart)}${code
          .slice(fragmentStart)
          .replace(`  let alpha = `, `  var alpha = `)
          .replace(
            `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
            `  var color = ambientDiffuse + direct + material.emissiveFactor;`,
          )
          .replace(
            `  let color = ambientDiffuse + direct + emissive;`,
            `  var color = ambientDiffuse + direct + emissive;`,
          )}`;

  return withMutableFragment.replace(
    `  return vec4f(color, alpha);`,
    `  let transmission = clamp(material.transmissionFactor * ${transmissionTextureFactor}, 0.0, 1.0);
  let sceneColorSize = vec2f(textureDimensions(standardTransmissionSceneColorTexture));
  let sceneColorUv = clamp(input.position.xy / max(sceneColorSize, vec2f(1.0)), vec2f(0.0), vec2f(1.0));
  let refractionOffset = clamp(normal.xy * transmission * (0.045 + roughness * 0.02), vec2f(-0.08), vec2f(0.08));
  let transmissionUv = clamp(sceneColorUv + refractionOffset, vec2f(0.0), vec2f(1.0));
  let transmissionRoughness = clamp(roughness, 0.0, 1.0);
  let transmissionBlurRadiusPixels = transmissionRoughness * transmissionRoughness * 96.0;
  let transmissionBlurTexel = transmissionBlurRadiusPixels / max(sceneColorSize, vec2f(1.0));
  let transmissionSharpColor = textureSampleLevel(
    standardTransmissionSceneColorTexture,
    standardTransmissionSceneColorSampler,
    transmissionUv,
    0.0,
  ).rgb;
  let transmissionBlurColor = (
    transmissionSharpColor * 0.24 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(transmissionBlurTexel.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - vec2f(transmissionBlurTexel.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(0.0, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - vec2f(0.0, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.12 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + transmissionBlurTexel, vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv - transmissionBlurTexel, vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(transmissionBlurTexel.x, -transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07 +
    textureSampleLevel(standardTransmissionSceneColorTexture, standardTransmissionSceneColorSampler, clamp(transmissionUv + vec2f(-transmissionBlurTexel.x, transmissionBlurTexel.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * 0.07
  );
  let transmittedSceneColor = mix(
    transmissionSharpColor,
    transmissionBlurColor,
    smoothstep(0.08, 0.85, transmissionRoughness),
  );
  let transmissionTint = mix(vec3f(1.0), max(baseColor, vec3f(0.04)), 0.35);
  color = mix(color, transmittedSceneColor * transmissionTint, transmission);
  alpha = alpha * max(1.0 - transmission * 0.25, 0.72);
  return vec4f(color, alpha);`,
  );
}

export function applyStandardFogSampling(
  code: string,
  features: StandardTextureShaderFeatures,
): string {
  const fogFactor =
    features.fogLinear === true
      ? `  let fogFactor = 1.0 - saturate((view.fogParams.w - distanceToCamera) / max(view.fogParams.w - view.fogParams.z, 0.0001));`
      : features.fogExp === true
        ? `  let fogFactor = 1.0 - saturate(exp(-distanceToCamera * view.fogParams.y));`
        : `  let fogFactor = 1.0 - saturate(exp(-distanceToCamera * distanceToCamera * view.fogParams.y * view.fogParams.y));`;

  return code
    .replace(
      `fn evaluateDirectLight(
  normal: vec3f,`,
      `fn applyDistanceFog(color: vec3f, distanceToCamera: f32) -> vec3f {
${fogFactor}
  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

fn evaluateDirectLight(
  normal: vec3f,`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `  var color = ambientDiffuse + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + direct + emissive;`,
      `  var color = ambientDiffuse + direct + emissive;`,
    )
    .replace(
      `  return vec4f(color, alpha);`,
      `  color = applyDistanceFog(color, length(view.cameraPosition.xyz - input.worldPosition));
  return vec4f(color, alpha);`,
    );
}

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
  const spotShadowFactorFunction = options.spotShadowMap
    ? `fn localLightClusterSpotShadowFactor(position: vec3f, lightIndex: u32) -> f32 {
  let metadataFlags = localLightClusterMetadataFlags(lightIndex);

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST}u) == 0u) {
    return 1.0;
  }

  if ((metadataFlags & ${LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED}u) == 0u) {
    return localLightClusterUnsupportedShadowFactor(lightIndex);
  }

  return sampleSpotShadowFactorWithMatrixBase(
    position,
    localLightClusterPointShadowMatrixBase(lightIndex),
    localLightClusterShadowFilterRadiusTexels(lightIndex),
  );
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

  let result = code
    .replace(
      `@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {`,
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
        let attenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

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
        let rangeAttenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

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
fn fs_main(input: VertexOutput) -> @location(0) vec4f {`,
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
      let attenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

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
      let rangeAttenuation = pow(saturate(1.0 - lightDistance / lightRange), 2.0);

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
      /([ ]{2}var ambient = vec3f\(0\.0\);\n[ ]{2}var direct = vec3f\(0\.0\);\n\n)[ ]{2}for \(var lightIndex = 0u; lightIndex < lightCount\(\); lightIndex = lightIndex \+ 1u\) \{[\s\S]*?\n[ ]{2}\}(?=\n\n[ ]{2}(?:let|var) )/,
      `$1${clusteredLightLoop}`,
    );

  if (options.removeGlobalPointShadowReceiverFactor === true) {
    result = result
      .replace(
        `  let receiverPointShadowFactor = samplePointShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverPointShadowFactor + material.emissiveFactor;`,
        `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      )
      .replace(
        `  let receiverPointShadowFactor = samplePointShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverPointShadowFactor + emissive;`,
        `  let color = ambientDiffuse + direct + emissive;`,
      );
  }

  if (options.removeGlobalSpotShadowReceiverFactor === true) {
    result = result
      .replace(
        `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
        `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      )
      .replace(
        `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + emissive;`,
        `  let color = ambientDiffuse + direct + emissive;`,
      )
      .replace(
        `  let receiverShadowFactor = min(
    min(
      sampleDirectionalShadowFactor(input.worldPosition),
      sampleSpotShadowFactor(input.worldPosition),
    ),
    samplePointShadowReceiverFactor(input.worldPosition),
  );
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
        `  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      )
      .replace(
        `  let receiverShadowFactor = min(
    min(
      sampleDirectionalShadowFactor(input.worldPosition),
      sampleSpotShadowFactor(input.worldPosition),
    ),
    samplePointShadowReceiverFactor(input.worldPosition),
  );
  let color = (ambientDiffuse + direct) * receiverShadowFactor + emissive;`,
        `  let color = ambientDiffuse + direct + emissive;`,
      );
  }

  return result;
}

export function applyStandardShadowMapSampling(
  code: string,
  options: {
    readonly cascaded?: boolean;
    readonly arrayShadows?: boolean;
  } = {},
): string {
  const helpers =
    options.cascaded === true
      ? `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;
const STANDARD_SHADOW_MAX_CASCADES: u32 = 4u;

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

fn sampleDirectionalShadowPcf3x3(shadowUv: vec2f, receiverDepth: f32, cascadeIndex: u32) -> f32 {
  let shadowDimensions = textureDimensions(directionalShadowMap);
  let shadowMapSize = vec2f(f32(shadowDimensions.x), f32(shadowDimensions.y));
  let texelSize = 1.0 / max(shadowMapSize, vec2f(1.0));
  var visibility = 0.0;

  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(
        shadowUv + vec2f(f32(x), f32(y)) * texelSize,
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

fn sampleDirectionalShadowFactor(lightIndex: u32, worldPosition: vec3f) -> f32 {
  let cascadeIndex = selectDirectionalShadowCascade(lightIndex, worldPosition);
  let cascadeCount = directionalShadowCascadeCount(lightIndex);

  if (cascadeIndex >= cascadeCount) {
    return 1.0;
  }

  let matrixIndex = directionalShadowMatrixBaseIndex(lightIndex) + cascadeIndex;

  if (matrixIndex >= arrayLength(&directionalShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[matrixIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
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
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
    cascadeIndex,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
}

fn sampleDirectionalShadowReceiverFactor(worldPosition: vec3f) -> f32 {
  var factor = 1.0;

  for (var lightIndex = 0u; lightIndex < lightCount(); lightIndex = lightIndex + 1u) {
    if (lightKind(lightIndex) == LIGHT_KIND_DIRECTIONAL) {
      factor = min(factor, sampleDirectionalShadowFactor(lightIndex, worldPosition));
    }
  }

  return factor;
}`
      : `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;

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

fn sampleDirectionalShadowFactor(worldPosition: vec3f) -> f32 {
  if (arrayLength(&directionalShadowMatrices) == 0u) {
    return 1.0;
  }

  return sampleSpotShadowFactorWithMatrixBase(worldPosition, 0u, 1.0);
}

fn sampleSpotShadowFactorWithMatrixBase(worldPosition: vec3f, matrixBaseIndex: u32, filterRadiusTexels: f32) -> f32 {
  if (matrixBaseIndex >= arrayLength(&directionalShadowMatrices)) {
    return 1.0;
  }

  let shadowPosition = directionalShadowMatrices[matrixBaseIndex] * vec4f(worldPosition, 1.0);

  if (abs(shadowPosition.w) <= 0.00001) {
    return 1.0;
  }

  let shadowClip = shadowPosition.xyz / shadowPosition.w;
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
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
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
    ${options.arrayShadows === true ? "matrixBaseIndex,\n    " : ""}filterRadiusTexels,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  let compareFactor = mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);

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
        ? `      let shadowFactor = sampleDirectionalShadowFactor(lightIndex, input.worldPosition);
      direct = direct + evaluateDirectLight(
        normal,
        viewDir,
        directionalLightDirection(lightIndex),
        lightRadiance(lightIndex),
        baseColor,
        metallic,
        roughness,
      ) * shadowFactor;`
        : `      let shadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
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
      options.cascaded === true
        ? `  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`
        : `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
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

  return mix(STANDARD_POINT_SHADOW_MIN_VISIBILITY, 1.0, visibility);`
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

  return mix(STANDARD_POINT_SHADOW_MIN_VISIBILITY, 1.0, visibility);`;
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
      `const STANDARD_POINT_SHADOW_MIN_VISIBILITY: f32 = 0.5;
const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

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
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );

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
  let color = (ambientDiffuse + direct) * receiverPointShadowFactor + material.emissiveFactor;`,
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
      `const STANDARD_SHADOW_MIN_VISIBILITY: f32 = 0.45;
const STANDARD_SHADOW_DEPTH_BIAS: f32 = 0.002;
const STANDARD_POINT_SHADOW_MIN_VISIBILITY: f32 = 0.5;
const STANDARD_POINT_SHADOW_DEPTH_BIAS: f32 = 0.0001;

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
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
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
  let rawVisibility = sampleDirectionalShadowPcf3x3(
    clampedShadowUv,
    receiverDepth,
    ${options.arrayShadows === true ? "0u,\n    " : ""}1.0,
  );
  let visibility = select(
    clamp(rawVisibility, 0.0, 1.0),
    1.0,
    rawVisibility != rawVisibility,
  );

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
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
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );
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

  return mix(STANDARD_SHADOW_MIN_VISIBILITY, 1.0, visibility);
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
  let shadowDepth = select(
    shadowClip.z,
    shadowClip.z * 0.5 + 0.5,
    shadowClip.z < 0.0,
  );

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
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );

  if (options.compactClusteredLocalShadows === true) {
    result = result
      .replaceAll("spotShadowMatrices", "directionalShadowMatrices")
      .replaceAll("spotShadowMap", "directionalShadowMap")
      .replaceAll("spotShadowSampler", "directionalShadowSampler");
  }

  return result;
}

export function applyStandardDiffuseIblSampling(code: string): string {
  const sample = `  let diffuseIbl = textureSample(
    standardDiffuseIblTexture,
    standardIblSampler,
    normal,
  ).rgb * baseColor * (1.0 - metallic);`;

  return code
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic);
  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * occlusion;
  let color = ambientDiffuse + direct + emissive;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * occlusion;
  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
    )
    .replace(
      `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
    )
    .replace(
      `  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition);
  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}

export function applyStandardSpecularIblProofSampling(code: string): string {
  const sample = `  let reflectionDir = reflect(-viewDir, normal);
  let specularMipLevel = f32(max(textureNumLevels(standardSpecularIblTexture), 1u) - 1u) * roughness;
  let specularIblProof = textureSampleLevel(
    standardSpecularIblTexture,
    standardIblSampler,
    reflectionDir,
    specularMipLevel,
  ).rgb * fresnelSchlick(max(dot(normal, viewDir), 0.0), mix(vec3f(0.04), baseColor, vec3f(metallic))) * (1.0 - roughness * 0.5);`;

  return code
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblProof + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblProof + direct + emissive;`,
    )
    .replace(
      `  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let color = (ambientDiffuse + diffuseIbl + specularIblProof + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}
