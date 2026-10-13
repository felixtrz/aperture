import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { StandardVertexComposer } from "./standard-vertex-composer.js";
export declare const STANDARD_MORPH_TARGET_FEATURE = "morphed";
/** group(1) binding holding the flat per-instance morph weights (`array<f32>`). */
export declare const STANDARD_MORPH_TARGET_WEIGHTS_BINDING = 2;
/** group(1) binding holding the flat, target-major morph deltas (`array<f32>`). */
export declare const STANDARD_MORPH_TARGET_DELTAS_BINDING = 4;
/** group(1) binding holding the per-instance morph descriptors (`array<vec4u>`). */
export declare const STANDARD_MORPH_TARGET_DESCRIPTORS_BINDING = 5;
export declare const STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY = "standard/group-1:world-transforms@0,morph-target-weights@2,morph-target-deltas@4,morph-instance-descriptors@5";
export declare const STANDARD_SKINNED_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY = "standard/group-1:world-transforms@0,skin-joint-matrices@1,morph-target-weights@2,morph-target-deltas@4,morph-instance-descriptors@5";
export type StandardMorphVec3 = readonly [number, number, number];
interface StandardMorphTargetFeatureInput {
    readonly morphed?: boolean;
}
export declare function standardMorphTargetsEnabledFromBatchKey(batchKey: Partial<BatchCompatibilityKey> | null): boolean;
export declare function appendStandardMorphTargetFeatureName(names: string[], features: StandardMorphTargetFeatureInput): void;
export declare function hasStandardMorphTargetFeature(features: StandardMorphTargetFeatureInput): boolean;
export declare function addStandardMorphTargetVertexSlots(composer: StandardVertexComposer, features: StandardMorphTargetFeatureInput): void;
/**
 * Reference CPU blend used by tests: accumulates an arbitrary number of
 * morph-target deltas weighted by the matching weight. Mirrors the WGSL loop
 * over `targetCount` (no fixed 2/4-target cap). Targets beyond those supplied
 * contribute zero.
 */
export declare function evaluateStandardMorphTargetBlend(input: {
    readonly base: StandardMorphVec3;
    readonly targets: readonly StandardMorphVec3[];
    readonly weights: readonly number[];
}): StandardMorphVec3;
export declare const MORPH_BINDINGS_WGSL = "@group(1) @binding(2) var<storage, read> standardMorphTargetWeights: array<f32>;\n@group(1) @binding(4) var<storage, read> standardMorphTargetDeltas: array<f32>;\n@group(1) @binding(5) var<storage, read> standardMorphInstanceDescriptors: array<vec4u>;";
/**
 * N-target morph blend sampled from storage buffers. The per-instance descriptor
 * `(weightOffset, targetCount, deltaOffset, vertexCount)` indexes a flat,
 * target-major delta buffer (positions then normals) so an arbitrary target
 * count renders without a fixed vertex-attribute cap, matching the three.js
 * WebGPURenderer morph-texture approach with a storage buffer.
 */
export declare const STANDARD_MORPH_TARGET_WGSL = "\nstruct ApertureMorphedVertex {\n  position: vec3f,\n  normal: vec3f,\n};\n\nfn apertureMorph(\n  basePosition: vec3f,\n  baseNormal: vec3f,\n  instanceIndex: u32,\n  vertexIndex: u32,\n) -> ApertureMorphedVertex {\n  let descriptor = standardMorphInstanceDescriptors[instanceIndex];\n  let weightOffset = descriptor.x;\n  let targetCount = descriptor.y;\n  let deltaOffset = descriptor.z;\n  let vertexCount = descriptor.w;\n  var position = basePosition;\n  var normal = baseNormal;\n  let normalBase = deltaOffset + targetCount * vertexCount * 3u;\n  for (var t = 0u; t < targetCount; t = t + 1u) {\n    let weight = standardMorphTargetWeights[weightOffset + t];\n    let vertexBase = (t * vertexCount + vertexIndex) * 3u;\n    let positionIndex = deltaOffset + vertexBase;\n    position = position + weight * vec3f(\n      standardMorphTargetDeltas[positionIndex],\n      standardMorphTargetDeltas[positionIndex + 1u],\n      standardMorphTargetDeltas[positionIndex + 2u],\n    );\n    let normalIndex = normalBase + vertexBase;\n    normal = normal + weight * vec3f(\n      standardMorphTargetDeltas[normalIndex],\n      standardMorphTargetDeltas[normalIndex + 1u],\n      standardMorphTargetDeltas[normalIndex + 2u],\n    );\n  }\n  return ApertureMorphedVertex(position, normal);\n}";
export {};
//# sourceMappingURL=standard-morph-target-shader.d.ts.map