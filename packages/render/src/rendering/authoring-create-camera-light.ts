import {
  assetHandleKey,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  AreaLightShape,
  CameraProjection,
  LightKind,
  type CameraInput,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
} from "./authoring-types.js";
import type {
  Camera,
  Light,
  LightCookie,
  LightShadowSettings,
} from "./authoring-components.js";
import { toTuple4 } from "./authoring-utils.js";

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
    shadowType: input.shadowType ?? 1,
    strength: input.strength ?? 1,
    filterRadius: input.filterRadius ?? 1,
    slopeBias: input.slopeBias ?? 0,
  };
}
