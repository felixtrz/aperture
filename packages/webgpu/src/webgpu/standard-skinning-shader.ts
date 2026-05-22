import type { BatchCompatibilityKey } from "@aperture-engine/render";

export const STANDARD_SKINNING_FEATURE = "skinned";
export const STANDARD_SKINNING_JOINTS_LOCATION = 8;
export const STANDARD_SKINNING_WEIGHTS_LOCATION = 9;
export const STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY =
  "standard/skinning/group-5:joint-matrices@0";

interface StandardSkinningFeatureInput {
  readonly skinned?: boolean;
}

export function standardSkinningEnabledFromBatchKey(
  batchKey: Partial<BatchCompatibilityKey> | null,
): boolean {
  return (
    batchKey?.skinned === true ||
    (typeof batchKey?.pipelineKey === "string" &&
      batchKey.pipelineKey.split("|").includes(STANDARD_SKINNING_FEATURE))
  );
}

export function appendStandardSkinningFeatureName(
  names: string[],
  features: StandardSkinningFeatureInput,
): void {
  if (features.skinned === true) {
    names.push(STANDARD_SKINNING_FEATURE);
  }
}

export function hasStandardSkinningFeature(
  features: StandardSkinningFeatureInput,
): boolean {
  return features.skinned === true;
}

export function applyStandardSkinningToWgsl(
  code: string,
  features: StandardSkinningFeatureInput,
): string {
  if (!hasStandardSkinningFeature(features)) {
    return code;
  }

  return code
    .replace(
      `@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;`,
      `@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(5) @binding(0) var<storage, read> skinJointMatrices: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: StandardMaterialUniform;`,
    )
    .replace(
      `  @builtin(instance_index) instanceIndex: u32,`,
      `  @location(${STANDARD_SKINNING_JOINTS_LOCATION}) joints0: vec4u,
  @location(${STANDARD_SKINNING_WEIGHTS_LOCATION}) weights0: vec4f,
  @builtin(instance_index) instanceIndex: u32,`,
    )
    .replace(
      `@vertex
fn vs_main(input: VertexInput) -> VertexOutput {`,
      `${STANDARD_SKINNING_WGSL}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {`,
    )
    .replace(
      `  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);`,
      `  let world = worldTransforms[input.instanceIndex];
  let skinnedPosition = apertureSkinPosition(input.position, input.joints0, input.weights0);
  let skinnedNormal = apertureSkinDirection(input.normal, input.joints0, input.weights0);
  let worldPosition = world * vec4f(skinnedPosition, 1.0);`,
    )
    .replace(
      `  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);`,
      `  output.worldNormal = normalize((world * vec4f(skinnedNormal, 0.0)).xyz);`,
    )
    .replace(
      `  output.worldTangent = normalize((world * vec4f(input.tangent.xyz, 0.0)).xyz);`,
      `  let skinnedTangent = apertureSkinDirection(input.tangent.xyz, input.joints0, input.weights0);
  output.worldTangent = normalize((world * vec4f(skinnedTangent, 0.0)).xyz);`,
    );
}

const STANDARD_SKINNING_WGSL = `
fn apertureSkinIdentityMatrix() -> mat4x4f {
  return mat4x4f(
    vec4f(1.0, 0.0, 0.0, 0.0),
    vec4f(0.0, 1.0, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0),
  );
}

fn apertureSkinMatrix(joints0: vec4u, weights0: vec4f) -> mat4x4f {
  let weightSum = dot(weights0, vec4f(1.0));

  if (weightSum <= 0.0001) {
    return apertureSkinIdentityMatrix();
  }

  let weights = weights0 / weightSum;
  return
    skinJointMatrices[joints0.x] * weights.x +
    skinJointMatrices[joints0.y] * weights.y +
    skinJointMatrices[joints0.z] * weights.z +
    skinJointMatrices[joints0.w] * weights.w;
}

fn apertureSkinPosition(position: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {
  return (apertureSkinMatrix(joints0, weights0) * vec4f(position, 1.0)).xyz;
}

fn apertureSkinDirection(direction: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {
  return (apertureSkinMatrix(joints0, weights0) * vec4f(direction, 0.0)).xyz;
}`;
