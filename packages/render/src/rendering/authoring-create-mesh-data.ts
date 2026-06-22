import {
  assetHandleKey,
  toVec4Tuple,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import type {
  InstanceDataInput,
  InstanceTintInput,
  MaterialSlotsInput,
  MorphTargetWeightsInput,
  SkinInput,
} from "./authoring-types.js";
import type {
  InstanceData,
  InstanceTint,
  MaterialSlots,
  MorphTargetWeights,
  Skin,
} from "./authoring-components.js";

export function createMaterialSlots(
  input: MaterialSlotsInput,
): ComponentInitialData<typeof MaterialSlots> {
  return {
    slotsJson: JSON.stringify(
      input.slots.map((slot) => ({
        slot: Math.trunc(slot.slot),
        materialId: assetHandleKey(slot.material),
      })),
    ),
  };
}

export function createInstanceTint(
  input: InstanceTintInput = {},
): ComponentInitialData<typeof InstanceTint> {
  return {
    color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
  };
}

export function createInstanceData(
  input: InstanceDataInput,
): ComponentInitialData<typeof InstanceData> {
  return {
    materialKind: input.materialKind,
    valuesJson: JSON.stringify(input.values),
  };
}

export function createSkin(
  input: SkinInput,
): ComponentInitialData<typeof Skin> {
  const jointMatrices = Float32Array.from(input.jointMatrices);

  return {
    jointCount: Math.floor(jointMatrices.length / 16),
    jointMatrices,
  };
}

export function createMorphTargetWeights(
  input: MorphTargetWeightsInput,
): ComponentInitialData<typeof MorphTargetWeights> {
  const weights = Float32Array.from(input.weights);

  return {
    targetCount: weights.length,
    weights,
  };
}
