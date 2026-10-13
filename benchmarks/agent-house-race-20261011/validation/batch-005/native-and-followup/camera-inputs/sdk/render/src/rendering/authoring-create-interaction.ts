import type { ComponentInitialData } from "@aperture-engine/simulation";
import {
  MeshQueryAccelerationMode,
  MeshQueryAccelerationStrategy,
  MeshQueryDynamicPolicy,
  PickablePrecision,
  type MeshQueryAccelerationInput,
  type OcclusionQueryInput,
  type PickableInput,
} from "./authoring-types.js";
import type {
  MeshQueryAcceleration,
  OcclusionQuery,
  Pickable,
} from "./authoring-components.js";

export function createPickable(
  input: PickableInput = {},
): ComponentInitialData<typeof Pickable> {
  return {
    enabled: input.enabled ?? true,
    layerMask: input.layerMask ?? 1,
    precision: input.precision ?? PickablePrecision.Bounds,
    blocksLower: input.blocksLower ?? false,
    priority: input.priority ?? 0,
  };
}

export function createMeshQueryAcceleration(
  input: MeshQueryAccelerationInput = {},
): ComponentInitialData<typeof MeshQueryAcceleration> {
  return {
    mode: input.mode ?? MeshQueryAccelerationMode.AutoBvh,
    strategy: input.strategy ?? MeshQueryAccelerationStrategy.Center,
    maxLeafSize: input.maxLeafSize ?? 8,
    maxDepth: input.maxDepth ?? 40,
    dynamicPolicy: input.dynamicPolicy ?? MeshQueryDynamicPolicy.Static,
    simplifiedMeshId: input.simplifiedMeshId ?? "",
  };
}

export function createOcclusionQuery(
  input: OcclusionQueryInput = {},
): ComponentInitialData<typeof OcclusionQuery> {
  return {
    enabled: input.enabled ?? true,
  };
}
