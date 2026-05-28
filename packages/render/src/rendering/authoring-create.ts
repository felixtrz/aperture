import {
  assetHandleKey,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  AreaLightShape,
  CameraProjection,
  FogMode,
  LightKind,
  MeshQueryAccelerationMode,
  MeshQueryAccelerationStrategy,
  MeshQueryDynamicPolicy,
  PickablePrecision,
  type CameraInput,
  type FogInput,
  type InstanceDataInput,
  type InstanceTintInput,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
  type MaterialSlotsInput,
  type MeshQueryAccelerationInput,
  type MorphTargetWeightsInput,
  type OcclusionQueryInput,
  type PickableInput,
  type SkinInput,
  type SkyboxInput,
  type SpriteInput,
} from "./authoring-types.js";
import type {
  Camera,
  Fog,
  InstanceData,
  InstanceTint,
  Light,
  LightCookie,
  LightShadowSettings,
  MaterialSlots,
  MeshQueryAcceleration,
  MorphTargetWeights,
  OcclusionQuery,
  Pickable,
  Skin,
  Skybox,
  Sprite,
} from "./authoring-components.js";
import { spriteSize, toTuple4 } from "./authoring-utils.js";

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

export function createCamera(
  input: CameraInput = {},
): ComponentInitialData<typeof Camera> {
  return {
    projection: input.projection ?? CameraProjection.Perspective,
    fovYRadians: input.fovYRadians ?? Math.PI / 3,
    aspect: input.aspect ?? 1,
    autoAspect: input.autoAspect ?? input.aspect === undefined,
    near: input.near ?? 0.1,
    far: input.far ?? 1000,
    orthographicHeight: input.orthographicHeight ?? 10,
    viewport: toTuple4(input.viewport ?? [0, 0, 1, 1]),
    scissor: toTuple4(input.scissor ?? [0, 0, 1, 1]),
    clearColor: toTuple4(input.clearColor ?? [0, 0, 0, 1]),
    clearDepth: input.clearDepth ?? 1,
    clearStencil: input.clearStencil ?? 0,
    clearFlags: input.clearFlags ?? 3,
    layerMask: input.layerMask ?? 1,
    priority: input.priority ?? 0,
    renderTargetId: input.renderTargetId ?? "",
    frustumCulling: input.frustumCulling ?? true,
    temporalJitterX: input.temporalJitter?.[0] ?? 0,
    temporalJitterY: input.temporalJitter?.[1] ?? 0,
  };
}

export function createLight(
  input: LightInput = {},
): ComponentInitialData<typeof Light> {
  return {
    kind: input.kind ?? LightKind.Directional,
    shape: input.shape ?? AreaLightShape.Rect,
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
    intensity: input.intensity ?? 1,
    range: input.range ?? 10,
    innerConeAngle: input.innerConeAngle ?? Math.PI / 8,
    outerConeAngle: input.outerConeAngle ?? Math.PI / 6,
    width: input.width ?? 2,
    height: input.height ?? 2,
    layerMask: input.layerMask ?? 1,
    environmentMapId:
      input.environmentMap === undefined || input.environmentMap === null
        ? ""
        : assetHandleKey(input.environmentMap),
  };
}

export function createLightCookie(
  input: LightCookieInput,
): ComponentInitialData<typeof LightCookie> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    intensity: input.intensity ?? 1,
  };
}

export function createLightShadowSettings(
  input: LightShadowSettingsInput = {},
): ComponentInitialData<typeof LightShadowSettings> {
  return {
    enabled: input.enabled ?? false,
    mapSize: input.mapSize ?? 1024,
    bias: input.bias ?? 0,
    normalBias: input.normalBias ?? 0,
    cascadeCount: input.cascadeCount ?? 1,
    casterLayerMask: input.casterLayerMask ?? -1,
    receiverLayerMask: input.receiverLayerMask ?? -1,
  };
}

export function createSprite(
  input: SpriteInput,
): ComponentInitialData<typeof Sprite> {
  const size = spriteSize(input.size);

  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
    width: size[0],
    height: size[1],
  };
}

export function createSkybox(
  input: SkyboxInput,
): ComponentInitialData<typeof Skybox> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    intensity: input.intensity ?? 1,
  };
}

export function createFog(
  input: FogInput = {},
): ComponentInitialData<typeof Fog> {
  const mode = input.mode ?? FogMode.Linear;

  return {
    mode,
    color: toTuple4(input.color ?? [0, 0, 0, 1]),
    density: input.density ?? (mode === FogMode.Linear ? 0 : 0.00025),
    start: input.start ?? 1,
    end: input.end ?? 1000,
  };
}

export function createOcclusionQuery(
  input: OcclusionQueryInput = {},
): ComponentInitialData<typeof OcclusionQuery> {
  return {
    enabled: input.enabled ?? true,
  };
}

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
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
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
  const jointMatrices = Array.from(input.jointMatrices);

  return {
    jointCount: Math.floor(jointMatrices.length / 16),
    jointMatricesJson: JSON.stringify(jointMatrices),
  };
}

export function createMorphTargetWeights(
  input: MorphTargetWeightsInput,
): ComponentInitialData<typeof MorphTargetWeights> {
  const weights = Array.from(input.weights);

  return {
    targetCount: weights.length,
    weightsJson: JSON.stringify(weights),
  };
}
