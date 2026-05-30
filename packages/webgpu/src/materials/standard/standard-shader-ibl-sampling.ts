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
      `  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition, normal);
  let color = (ambientDiffuse + direct) * receiverShadowFactor + material.emissiveFactor;`,
      `${sample}
  let receiverShadowFactor = sampleDirectionalShadowReceiverFactor(input.worldPosition, normal);
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
