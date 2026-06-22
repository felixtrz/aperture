import type { BatchCompatibilityKey } from "@aperture-engine/render";
import type { StandardVertexComposer } from "./standard-vertex-composer.js";

export const STANDARD_MORPH_TARGET_FEATURE = "morphed";
/** group(1) binding holding the flat per-instance morph weights (`array<f32>`). */
export const STANDARD_MORPH_TARGET_WEIGHTS_BINDING = 2;
/** group(1) binding holding the flat, target-major morph deltas (`array<f32>`). */
export const STANDARD_MORPH_TARGET_DELTAS_BINDING = 4;
/** group(1) binding holding the per-instance morph descriptors (`array<vec4u>`). */
export const STANDARD_MORPH_TARGET_DESCRIPTORS_BINDING = 5;
export const STANDARD_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY =
  "standard/group-1:world-transforms@0,morph-target-weights@2,morph-target-deltas@4,morph-instance-descriptors@5";
export const STANDARD_SKINNED_MORPH_TARGET_BIND_GROUP_LAYOUT_KEY =
  "standard/group-1:world-transforms@0,skin-joint-matrices@1,morph-target-weights@2,morph-target-deltas@4,morph-instance-descriptors@5";

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

export function addStandardMorphTargetVertexSlots(
  composer: StandardVertexComposer,
  features: StandardMorphTargetFeatureInput,
): void {
  if (!hasStandardMorphTargetFeature(features)) {
    return;
  }

  composer.addBinding("morphTargetWeights", MORPH_BINDINGS_WGSL);
  composer.addInputField(
    "morphVertexIndex",
    "  @builtin(vertex_index) morphVertexIndex: u32,",
  );
  composer.addHelperFunction("morphTargets", STANDARD_MORPH_TARGET_WGSL);
}

/**
 * Reference CPU blend used by tests: accumulates an arbitrary number of
 * morph-target deltas weighted by the matching weight. Mirrors the WGSL loop
 * over `targetCount` (no fixed 2/4-target cap). Targets beyond those supplied
 * contribute zero.
 */
export function evaluateStandardMorphTargetBlend(input: {
  readonly base: StandardMorphVec3;
  readonly targets: readonly StandardMorphVec3[];
  readonly weights: readonly number[];
}): StandardMorphVec3 {
  const out: [number, number, number] = [
    input.base[0],
    input.base[1],
    input.base[2],
  ];
  for (let t = 0; t < input.targets.length; t += 1) {
    const target = input.targets[t]!;
    const weight = input.weights[t] ?? 0;
    out[0] += target[0] * weight;
    out[1] += target[1] * weight;
    out[2] += target[2] * weight;
  }
  return out;
}

export const MORPH_BINDINGS_WGSL = `@group(1) @binding(${STANDARD_MORPH_TARGET_WEIGHTS_BINDING}) var<storage, read> standardMorphTargetWeights: array<f32>;
@group(1) @binding(${STANDARD_MORPH_TARGET_DELTAS_BINDING}) var<storage, read> standardMorphTargetDeltas: array<f32>;
@group(1) @binding(${STANDARD_MORPH_TARGET_DESCRIPTORS_BINDING}) var<storage, read> standardMorphInstanceDescriptors: array<vec4u>;`;

/**
 * N-target morph blend sampled from storage buffers. The per-instance descriptor
 * `(weightOffset, targetCount, deltaOffset, vertexCount)` indexes a flat,
 * target-major delta buffer (positions then normals) so an arbitrary target
 * count renders without a fixed vertex-attribute cap, matching the three.js
 * WebGPURenderer morph-texture approach with a storage buffer.
 */
export const STANDARD_MORPH_TARGET_WGSL = `
struct ApertureMorphedVertex {
  position: vec3f,
  normal: vec3f,
};

fn apertureMorph(
  basePosition: vec3f,
  baseNormal: vec3f,
  instanceIndex: u32,
  vertexIndex: u32,
) -> ApertureMorphedVertex {
  let descriptor = standardMorphInstanceDescriptors[instanceIndex];
  let weightOffset = descriptor.x;
  let targetCount = descriptor.y;
  let deltaOffset = descriptor.z;
  let vertexCount = descriptor.w;
  var position = basePosition;
  var normal = baseNormal;
  let normalBase = deltaOffset + targetCount * vertexCount * 3u;
  for (var t = 0u; t < targetCount; t = t + 1u) {
    let weight = standardMorphTargetWeights[weightOffset + t];
    let vertexBase = (t * vertexCount + vertexIndex) * 3u;
    let positionIndex = deltaOffset + vertexBase;
    position = position + weight * vec3f(
      standardMorphTargetDeltas[positionIndex],
      standardMorphTargetDeltas[positionIndex + 1u],
      standardMorphTargetDeltas[positionIndex + 2u],
    );
    let normalIndex = normalBase + vertexBase;
    normal = normal + weight * vec3f(
      standardMorphTargetDeltas[normalIndex],
      standardMorphTargetDeltas[normalIndex + 1u],
      standardMorphTargetDeltas[normalIndex + 2u],
    );
  }
  return ApertureMorphedVertex(position, normal);
}`;
