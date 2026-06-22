import {
  assetHandleKey,
  toVec3Tuple,
  toVec4Tuple,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  FogMode,
  ProceduralSkyModel,
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteDepthMode,
  SpriteSizeMode,
  type FogInput,
  type ProceduralSkyInput,
  type RuntimeUniformInput,
  type SkyboxInput,
  type SpriteInput,
} from "./authoring-types.js";
import type {
  Fog,
  ProceduralSky,
  RuntimeUniform,
  Skybox,
  Sprite,
} from "./authoring-components.js";
import { spriteSize } from "./authoring-utils.js";

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
    color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
    width: size[0],
    height: size[1],
    uvRect: toVec4Tuple(input.uvRect ?? [0, 0, 1, 1]),
    pivot: [input.pivot?.[0] ?? 0.5, input.pivot?.[1] ?? 0.5],
    rotation: input.rotation ?? 0,
    atlasFrame: input.atlasFrame ?? 0,
    coordinateMode: input.coordinateMode ?? SpriteCoordinateMode.World,
    billboardMode: input.billboardMode ?? SpriteBillboardMode.Spherical,
    sizeMode: input.sizeMode ?? SpriteSizeMode.WorldUnits,
    blendMode: input.blendMode ?? SpriteBlendMode.Alpha,
    depthMode: input.depthMode ?? SpriteDepthMode.Test,
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

export function createProceduralSky(
  input: ProceduralSkyInput = {},
): ComponentInitialData<typeof ProceduralSky> {
  return {
    model: input.model ?? ProceduralSkyModel.Gradient,
    priority: input.priority ?? 0,
    topColor: toVec3Tuple(input.topColor ?? [0.015, 0.02, 0.08]),
    horizonColor: toVec3Tuple(input.horizonColor ?? [0.04, 0.055, 0.13]),
    bottomColor: toVec3Tuple(input.bottomColor ?? [0.006, 0.008, 0.025]),
    horizonPosition: input.horizonPosition ?? 0.4,
    horizonSoftness: input.horizonSoftness ?? 0.24,
    intensity: input.intensity ?? 1,
    sunDirection: toVec3Tuple(input.sunDirection ?? [-0.6, 0.4, -0.7]),
    sunColor: toVec3Tuple(input.sunColor ?? [1, 0.72, 0.38]),
    sunRadius: input.sunRadius ?? 0.02,
    sunGlow: input.sunGlow ?? 0.35,
    ditherStrength: input.ditherStrength ?? 0.003,
  };
}

export function createRuntimeUniform(
  input: RuntimeUniformInput,
): ComponentInitialData<typeof RuntimeUniform> {
  return {
    key: input.key,
    values: { ...input.values },
    version: input.version ?? 0,
  };
}

export function createFog(
  input: FogInput = {},
): ComponentInitialData<typeof Fog> {
  const mode = input.mode ?? FogMode.Linear;

  return {
    mode,
    color: toVec4Tuple(input.color ?? [0, 0, 0, 1]),
    density: input.density ?? (mode === FogMode.Linear ? 0 : 0.00025),
    start: input.start ?? 1,
    end: input.end ?? 1000,
  };
}
