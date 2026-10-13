import type { createStandardMaterialBindGroupDescriptorPlan } from "./standard-bind-group.js";

export function preparedScalarStandardMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
  ].join("|");
}

export function preparedTexturedStandardMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly dependencyCacheKeySegments: readonly string[];
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
    ...input.dependencyCacheKeySegments,
  ].join("|");
}

export function emptyStandardMaterialDependencies(): Parameters<
  typeof createStandardMaterialBindGroupDescriptorPlan
>[0]["dependencies"] {
  const empty = { textureKey: null, samplerKey: null, texCoord: 0 };

  return {
    baseColor: empty,
    metallicRoughness: empty,
    clearcoat: empty,
    clearcoatRoughness: empty,
    transmission: empty,
    sheenColor: empty,
    sheenRoughness: empty,
    iridescence: empty,
    iridescenceThickness: empty,
    normal: empty,
    occlusion: empty,
    emissive: empty,
  };
}
