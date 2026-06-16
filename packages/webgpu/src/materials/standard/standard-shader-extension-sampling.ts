import type { StandardTextureShaderFeatures } from "./standard-shader-features.js";

interface StandardIridescenceSamplingOptions {
  readonly textureSample: string | null;
  readonly thicknessTextureSample?: string | null;
}

export function applyStandardIridescenceSampling(
  code: string,
  options: StandardIridescenceSamplingOptions = {
    textureSample: null,
    thicknessTextureSample: null,
  },
): string {
  void options;

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
    );
}

export function standardIridescenceMaterialStatements(
  options: StandardIridescenceSamplingOptions = {
    textureSample: null,
    thicknessTextureSample: null,
  },
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

  return `  let iridescence = clamp(${iridescenceFactorExpression}, 0.0, 1.0);
  let iridescenceThickness = clamp(${iridescenceThicknessExpression}, 0.0, 1200.0);`;
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
  void options;

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

export function standardClearcoatMaterialStatements(
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

  return `  let clearcoatFactor = clamp(material.clearcoatFactor * ${clearcoatTextureFactor}, 0.0, 1.0);
  let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * ${clearcoatRoughnessFactor}, 0.045, 1.0);`;
}

export function applyStandardSheenSampling(
  code: string,
  options: {
    readonly colorTextureSample: string | null;
    readonly roughnessTextureSample: string | null;
  },
): string {
  void options;

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

export function standardSheenMaterialStatements(options: {
  readonly colorTextureSample: string | null;
  readonly roughnessTextureSample: string | null;
}): string {
  const sheenColorExpression =
    options.colorTextureSample === null
      ? "material.sheenColorRoughnessFactor.rgb"
      : `material.sheenColorRoughnessFactor.rgb * ${options.colorTextureSample}`;
  const sheenRoughnessExpression =
    options.roughnessTextureSample === null
      ? "material.sheenColorRoughnessFactor.a"
      : `material.sheenColorRoughnessFactor.a * ${options.roughnessTextureSample}`;

  return `  let sheenColor = clamp(${sheenColorExpression}, vec3f(0.0), vec3f(1.0));
  let sheenRoughness = clamp(${sheenRoughnessExpression}, 0.045, 1.0);`;
}

export function standardTransmissionColorMutationStatements(options: {
  readonly textureSample: string | null;
}): string {
  const transmissionTextureFactor = options.textureSample ?? "1.0";

  return `  let transmission = clamp(material.transmissionFactor * ${transmissionTextureFactor}, 0.0, 1.0);
  let transmissionIor = max(material.transmissionVolume.x, 1.0);
  let transmissionThickness = max(material.transmissionVolume.y, 0.0);
  let transmissionAttenuationDistance = material.transmissionVolume.z;
  let sceneColorSize = vec2f(textureDimensions(standardTransmissionSceneColorTexture));
  let sceneColorUv = clamp(input.position.xy / max(sceneColorSize, vec2f(1.0)), vec2f(0.0), vec2f(1.0));
  // IOR-driven refraction (M5-T5): bend the view ray entering the volume, walk
  // it across the authored thickness, and project the exit point back to the
  // grabbed scene color. The screen offset is the projected delta from the
  // fragment's own screen position, so ior=1 (no bend) samples straight behind
  // and higher ior shifts the background. thickness=0 => thin-walled (no offset).
  let transmissionViewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  // The shading normal can face away from the camera on the transmissive
  // surface (back-facing/normal-flipped fragments); force it toward the viewer
  // so the Snell refraction enters the volume with the correct geometry.
  let transmissionGeoNormal = normalize(normal);
  let transmissionNormal = select(
    -transmissionGeoNormal,
    transmissionGeoNormal,
    dot(transmissionGeoNormal, transmissionViewDir) >= 0.0,
  );
  let transmissionRefraction = refract(-transmissionViewDir, transmissionNormal, 1.0 / transmissionIor);
  let transmissionExitPos = input.worldPosition + transmissionRefraction * transmissionThickness;
  let transmissionSelfClip = view.viewProjection * vec4f(input.worldPosition, 1.0);
  let transmissionExitClip = view.viewProjection * vec4f(transmissionExitPos, 1.0);
  let transmissionSelfUv = vec2f(
    transmissionSelfClip.x / max(transmissionSelfClip.w, 0.0001) * 0.5 + 0.5,
    0.5 - transmissionSelfClip.y / max(transmissionSelfClip.w, 0.0001) * 0.5,
  );
  let transmissionExitUv = vec2f(
    transmissionExitClip.x / max(transmissionExitClip.w, 0.0001) * 0.5 + 0.5,
    0.5 - transmissionExitClip.y / max(transmissionExitClip.w, 0.0001) * 0.5,
  );
  let transmissionUv = clamp(sceneColorUv + (transmissionExitUv - transmissionSelfUv), vec2f(0.0), vec2f(1.0));
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
  // Beer-Lambert absorption through the volume: transmittance per channel =
  // attenuationColor ^ (thickness / attenuationDistance). attenuationDistance==0
  // is the "no absorption" sentinel (glTF default attenuationDistance=Infinity).
  let transmissionAttenuationRatio = select(
    0.0,
    transmissionThickness / max(transmissionAttenuationDistance, 0.0001),
    transmissionAttenuationDistance > 0.0,
  );
  let transmissionTransmittance = pow(
    max(material.attenuationColor.rgb, vec3f(0.0)),
    vec3f(transmissionAttenuationRatio),
  );
  let transmissionTint = mix(vec3f(1.0), max(baseColor, vec3f(0.04)), 0.35);
  color = mix(
    color,
    transmittedSceneColor * transmissionTransmittance * transmissionTint,
    transmission,
  );
  alpha = alpha * max(1.0 - transmission * 0.25, 0.72);`;
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

  return code.replace(
    `fn evaluateDirectLight(
  normal: vec3f,`,
    `fn applyDistanceFog(color: vec3f, distanceToCamera: f32) -> vec3f {
${fogFactor}
  return mix(color, view.fogColor.rgb, saturate(fogFactor * view.fogColor.a));
}

fn evaluateDirectLight(
  normal: vec3f,`,
  );
}
