import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { StandardVertexComposer } from "./standard-vertex-composer.js";

export const STANDARD_SKINNING_FEATURE = "skinned";
export const STANDARD_SKINNING_JOINTS_LOCATION = 8;
export const STANDARD_SKINNING_WEIGHTS_LOCATION = 9;
export const STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY =
  "standard/group-1:world-transforms@0,skin-joint-matrices@1";

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

export function addStandardSkinningVertexSlots(
  composer: StandardVertexComposer,
  features: StandardSkinningFeatureInput,
): void {
  if (!hasStandardSkinningFeature(features)) {
    return;
  }

  composer.addBinding(
    "skinJointMatrices",
    "@group(1) @binding(1) var<storage, read> skinJointMatrices: array<mat4x4f>;",
  );
  composer.addInputField(
    "joints0",
    `  @location(${STANDARD_SKINNING_JOINTS_LOCATION}) joints0: vec4u,`,
  );
  composer.addInputField(
    "weights0",
    `  @location(${STANDARD_SKINNING_WEIGHTS_LOCATION}) weights0: vec4f,`,
  );
  composer.addHelperFunction("skinning", STANDARD_SKINNING_WGSL);
}

export const STANDARD_SKINNING_WGSL = `
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
