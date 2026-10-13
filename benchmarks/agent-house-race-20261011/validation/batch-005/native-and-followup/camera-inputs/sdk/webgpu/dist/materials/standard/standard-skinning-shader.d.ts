import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { StandardVertexComposer } from "./standard-vertex-composer.js";
export declare const STANDARD_SKINNING_FEATURE = "skinned";
export declare const STANDARD_SKINNING_JOINTS_LOCATION = 8;
export declare const STANDARD_SKINNING_WEIGHTS_LOCATION = 9;
export declare const STANDARD_SKINNING_BIND_GROUP_LAYOUT_KEY = "standard/group-1:world-transforms@0,skin-joint-matrices@1";
interface StandardSkinningFeatureInput {
    readonly skinned?: boolean;
}
export declare function standardSkinningEnabledFromBatchKey(batchKey: Partial<BatchCompatibilityKey> | null): boolean;
export declare function appendStandardSkinningFeatureName(names: string[], features: StandardSkinningFeatureInput): void;
export declare function hasStandardSkinningFeature(features: StandardSkinningFeatureInput): boolean;
export declare function addStandardSkinningVertexSlots(composer: StandardVertexComposer, features: StandardSkinningFeatureInput): void;
export declare const STANDARD_SKINNING_WGSL = "\nfn apertureSkinIdentityMatrix() -> mat4x4f {\n  return mat4x4f(\n    vec4f(1.0, 0.0, 0.0, 0.0),\n    vec4f(0.0, 1.0, 0.0, 0.0),\n    vec4f(0.0, 0.0, 1.0, 0.0),\n    vec4f(0.0, 0.0, 0.0, 1.0),\n  );\n}\n\nfn apertureSkinMatrix(joints0: vec4u, weights0: vec4f) -> mat4x4f {\n  let weightSum = dot(weights0, vec4f(1.0));\n\n  if (weightSum <= 0.0001) {\n    return apertureSkinIdentityMatrix();\n  }\n\n  let weights = weights0 / weightSum;\n  return\n    skinJointMatrices[joints0.x] * weights.x +\n    skinJointMatrices[joints0.y] * weights.y +\n    skinJointMatrices[joints0.z] * weights.z +\n    skinJointMatrices[joints0.w] * weights.w;\n}\n\nfn apertureSkinPosition(position: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {\n  return (apertureSkinMatrix(joints0, weights0) * vec4f(position, 1.0)).xyz;\n}\n\nfn apertureSkinDirection(direction: vec3f, joints0: vec4u, weights0: vec4f) -> vec3f {\n  return (apertureSkinMatrix(joints0, weights0) * vec4f(direction, 0.0)).xyz;\n}";
export {};
//# sourceMappingURL=standard-skinning-shader.d.ts.map