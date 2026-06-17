import {
  assetHandleKey,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  FogMode,
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteDepthMode,
  SpriteSizeMode,
  type FogInput,
  type SkyboxInput,
  type SpriteInput,
} from "./authoring-types.js";
import type { Fog, Skybox, Sprite } from "./authoring-components.js";
import { spriteSize, toTuple4 } from "./authoring-utils.js";

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
    uvRect: toTuple4(input.uvRect ?? [0, 0, 1, 1]),
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
