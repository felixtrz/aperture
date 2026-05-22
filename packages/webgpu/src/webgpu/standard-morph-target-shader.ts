import type { BatchCompatibilityKey } from "@aperture-engine/render";

export const STANDARD_MORPH_TARGET_FEATURE = "morphed";
export const STANDARD_MORPH_TARGET_POSITION_0_LOCATION = 10;
export const STANDARD_MORPH_TARGET_NORMAL_0_LOCATION = 11;
export const STANDARD_MORPH_TARGET_POSITION_1_LOCATION = 12;
export const STANDARD_MORPH_TARGET_NORMAL_1_LOCATION = 13;
export const STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY =
  "standard/group-1:world-transforms@0,morph-target-weights@2";
export const STANDARD_SKINNED_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY =
  "standard/group-1:world-transforms@0,skin-joint-matrices@1,morph-target-weights@2";

export type StandardMorphVec3 = readonly [number, number, number];

interface StandardMorphTargetFeatureInput {
  readonly morphed?: boolean;
}

export function standardMorphTargetsEnabledFromBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): boolean {
  return (
    batchKey?.morphed === true ||
    (typeof batchKey?.pipelineKey === "string" &&
      batchKey.pipelineKey.split("|").includes(STANDARD_MORPH_TARGET_FEATURE))
  );
}

export function appendStandardMorphTargetFeatureName(
  names: string[],
  features: StandardMorphTargetFeatureInput,
): void {
  if (features.morphed === true) {
    names.push(STANDARD_MORPH_TARGET_FEATURE);
  }
}

export function hasStandardMorphTargetFeature(
  features: StandardMorphTargetFeatureInput,
): boolean {
  return features.morphed === true;
}

export function evaluateStandardMorphTargetBlend(input: {
  readonly base: StandardMorphVec3;
  readonly target0: StandardMorphVec3;
  readonly target1: StandardMorphVec3;
  readonly weights: readonly [number, number];
}): StandardMorphVec3 {
  return [
    input.base[0] +
      input.target0[0] * input.weights[0] +
      input.target1[0] * input.weights[1],
    input.base[1] +
      input.target0[1] * input.weights[0] +
      input.target1[1] * input.weights[1],
    input.base[2] +
      input.target0[2] * input.weights[0] +
      input.target1[2] * input.weights[1],
  ];
}

export function applyStandardMorphTargetsToWgsl(
  code: string,
  features: StandardMorphTargetFeatureInput,
): string {
  if (!hasStandardMorphTargetFeature(features)) {
    return code;
  }

  let next = insertMorphWeightBinding(code);

  next = next
    .replace(
      `  @builtin(instance_index) instanceIndex: u32,`,
      `  @location(${STANDARD_MORPH_TARGET_POSITION_0_LOCATION}) morphPosition0: vec3f,
  @location(${STANDARD_MORPH_TARGET_NORMAL_0_LOCATION}) morphNormal0: vec3f,
  @location(${STANDARD_MORPH_TARGET_POSITION_1_LOCATION}) morphPosition1: vec3f,
  @location(${STANDARD_MORPH_TARGET_NORMAL_1_LOCATION}) morphNormal1: vec3f,
  @builtin(instance_index) instanceIndex: u32,`,
    )
    .replace(
      `@vertex
fn vs_main(input: VertexInput) -> VertexOutput {`,
      `${STANDARD_MORPH_TARGET_WGSL}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {`,
    );

  if (next.includes("let skinnedPosition = apertureSkinPosition")) {
    return next.replace(
      `  let world = worldTransforms[input.instanceIndex];
  let skinnedPosition = apertureSkinPosition(input.position, input.joints0, input.weights0);
  let skinnedNormal = apertureSkinDirection(input.normal, input.joints0, input.weights0);
  let worldPosition = world * vec4f(skinnedPosition, 1.0);`,
      `  let world = worldTransforms[input.instanceIndex];
  let morphWeights = standardMorphTargetWeights[input.instanceIndex];
  let morphedPosition = apertureMorphPosition(input.position, input.morphPosition0, input.morphPosition1, morphWeights);
  let morphedNormal = apertureMorphDirection(input.normal, input.morphNormal0, input.morphNormal1, morphWeights);
  let skinnedPosition = apertureSkinPosition(morphedPosition, input.joints0, input.weights0);
  let skinnedNormal = apertureSkinDirection(morphedNormal, input.joints0, input.weights0);
  let worldPosition = world * vec4f(skinnedPosition, 1.0);`,
    );
  }

  return next
    .replace(
      `  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);`,
      `  let world = worldTransforms[input.instanceIndex];
  let morphWeights = standardMorphTargetWeights[input.instanceIndex];
  let morphedPosition = apertureMorphPosition(input.position, input.morphPosition0, input.morphPosition1, morphWeights);
  let morphedNormal = apertureMorphDirection(input.normal, input.morphNormal0, input.morphNormal1, morphWeights);
  let worldPosition = world * vec4f(morphedPosition, 1.0);`,
    )
    .replace(
      `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);`,
      `  output.worldNormal = normalize((world * vec4f(morphedNormal, 0.0)).xyz);`,
    );
}

function insertMorphWeightBinding(code: string): string {
  const skinBinding =
    "@group(1) @binding(1) var<storage, read> skinJointMatrices: array<mat4x4f>;";

  if (code.includes(skinBinding)) {
    return code.replace(
      skinBinding,
      `${skinBinding}
@group(1) @binding(2) var<storage, read> standardMorphTargetWeights: array<vec4f>;`,
    );
  }

  return code.replace(
    `@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;`,
    `@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(1) @binding(2) var<storage, read> standardMorphTargetWeights: array<vec4f>;`,
  );
}

const STANDARD_MORPH_TARGET_WGSL = `
fn apertureMorphPosition(
  position: vec3f,
  target0: vec3f,
  target1: vec3f,
  weights: vec4f,
) -> vec3f {
  return position + target0 * weights.x + target1 * weights.y;
}

fn apertureMorphDirection(
  direction: vec3f,
  target0: vec3f,
  target1: vec3f,
  weights: vec4f,
) -> vec3f {
  return normalize(direction + target0 * weights.x + target1 * weights.y);
}`;
