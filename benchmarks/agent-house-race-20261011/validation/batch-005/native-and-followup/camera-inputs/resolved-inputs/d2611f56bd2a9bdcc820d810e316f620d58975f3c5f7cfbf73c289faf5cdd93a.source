export const STANDARD_DIFFUSE_IBL_SAMPLE_WGSL = `  let diffuseIbl = textureSample(
    standardDiffuseIblTexture,
    standardIblSampler,
    normal,
  ).rgb * baseColor * (1.0 - metallic);`;
export const STANDARD_SPECULAR_IBL_BRDF_SAMPLE_WGSL = `  let brdfReflectionDir = reflect(-viewDir, normal);
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
export const STANDARD_SPECULAR_IBL_PROOF_SAMPLE_WGSL = `  let reflectionDir = reflect(-viewDir, normal);
  let specularMipLevel = f32(max(textureNumLevels(standardSpecularIblTexture), 1u) - 1u) * roughness;
  let specularIblProof = textureSampleLevel(
    standardSpecularIblTexture,
    standardIblSampler,
    reflectionDir,
    specularMipLevel,
  ).rgb * fresnelSchlick(max(dot(normal, viewDir), 0.0), mix(vec3f(0.04), baseColor, vec3f(metallic))) * (1.0 - roughness * 0.5);`;
// Split-sum environment-BRDF (DFG) specular IBL term. This helper implements the
// analytic Karis/Lazarov approximation used by the BRDF specular term.
const ENVIRONMENT_BRDF_APPROX_FN = `fn environmentBrdfApprox(roughness: f32, nDotV: f32) -> vec2f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let r = roughness * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * nDotV)) * r.x + r.y;
  return vec2f(-1.04, 1.04) * a004 + r.zw;
}

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {`;
export function applyStandardDiffuseIblSampling(code) {
    return code;
}
export function applyStandardSpecularIblBrdfSampling(code) {
    return code.replace("fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {", ENVIRONMENT_BRDF_APPROX_FN);
}
export function applyStandardSpecularIblProofSampling(code) {
    return code;
}
//# sourceMappingURL=standard-shader-ibl-sampling.js.map