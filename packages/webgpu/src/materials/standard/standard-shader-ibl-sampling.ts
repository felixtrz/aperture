export function applyStandardDiffuseIblSampling(code: string): string {
  const sample = `  let diffuseIbl = textureSample(
    standardDiffuseIblTexture,
    standardIblSampler,
    normal,
  ).rgb * baseColor * (1.0 - metallic);`;

  return code
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI);
  let color = ambientDiffuse + direct + material.emissiveFactor;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI);
  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI) * occlusion;
  let color = ambientDiffuse + direct + emissive;`,
      `${sample}
  let ambientDiffuse = ambient * baseColor * (1.0 - metallic) * (1.0 / PI) * occlusion;
  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
    )
    .replace(
      `  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = ambientDiffuse + direct * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowFactor(input.worldPosition);
  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
    )
    .replace(
      `  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition, normal);
  let color = ambientDiffuse + direct * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition, normal);
  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
    );
}

// Split-sum environment-BRDF (DFG) specular IBL term. Replaces the hand-tuned
// `iblSpecularProof` `* (1.0 - roughness * 0.5)` fudge with the energy-conserving
// Karis split-sum form `prefilteredColor * (F0 * scale + F90 * bias)`, where
// (scale, bias) is the environment BRDF for (roughness, NdotV). The scale/bias is
// evaluated with the analytic Karis/Lazarov approximation (the LUT-free form of
// the GGX DFG integral; see references/three.js EnvironmentBRDF.js / DFGLUT.js),
// which the roadmap SOTA bar accepts in place of a sampled rg16float LUT. The
// matching GPU LUT compute pass (brdf-lut-compute-pipeline.ts) integrates the
// same DFG and is validated by unit + render-control proofs.
const ENVIRONMENT_BRDF_APPROX_FN = `fn environmentBrdfApprox(roughness: f32, nDotV: f32) -> vec2f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let r = roughness * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * nDotV)) * r.x + r.y;
  return vec2f(-1.04, 1.04) * a004 + r.zw;
}

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {`;

export function applyStandardSpecularIblBrdfSampling(code: string): string {
  const sample = `  let brdfReflectionDir = reflect(-viewDir, normal);
  let brdfSpecularMipLevel = f32(max(textureNumLevels(standardSpecularIblTexture), 1u) - 1u) * roughness;
  let brdfPrefilteredColor = textureSampleLevel(
    standardSpecularIblTexture,
    standardIblSampler,
    brdfReflectionDir,
    brdfSpecularMipLevel,
  ).rgb;
  let brdfNdotV = max(dot(normal, viewDir), 0.0);
  let brdfF0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let brdfEnvScaleBias = environmentBrdfApprox(roughness, brdfNdotV);
  let specularIblBrdf = brdfPrefilteredColor * (brdfF0 * brdfEnvScaleBias.x + brdfEnvScaleBias.y);`;

  return code
    .replace(
      "fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {",
      ENVIRONMENT_BRDF_APPROX_FN,
    )
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + material.emissiveFactor;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblBrdf + direct + material.emissiveFactor;`,
    )
    .replace(
      `  let color = ambientDiffuse + diffuseIbl + direct + emissive;`,
      `${sample}
  let color = ambientDiffuse + diffuseIbl + specularIblBrdf + direct + emissive;`,
    )
    .replace(
      `  let color = (ambientDiffuse + diffuseIbl + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let color = (ambientDiffuse + diffuseIbl + specularIblBrdf + direct) * receiverShadowFactor + material.emissiveFactor;`,
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
