import {
  createEnvironmentMapHandle,
  createMaterialHandle,
  createMeshHandle,
  createParticleEffectHandle,
  createRenderTargetHandle,
  createSamplerHandle,
  createTextureHandle,
  type EnvironmentMapHandle,
  type MaterialHandle,
  type MeshHandle,
  type ParticleEffectHandle,
  type RenderTargetHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type { Entity } from "@aperture-engine/simulation";
import {
  Camera,
  Fog,
  FogMode,
  Light,
  Sprite,
  Skybox,
  type CameraInput,
  type FogInput,
  type LightInput,
  type SpriteInput,
  type SkyboxInput,
} from "./index.js";
import { diagnostic } from "./extraction-diagnostics.js";
import type { RenderDiagnostic } from "./snapshot.js";
import type { Mat4 } from "@aperture-engine/simulation";

export function readCameraNumber(
  entity: Entity,
  key: keyof typeof Camera.schema,
): number {
  const value = entity.getValue(Camera, key);
  return typeof value === "number" ? value : 0;
}

export function readRenderTarget(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): RenderTargetHandle | null {
  const value = entity.getValue(Camera, "renderTargetId") ?? "";

  if (value === "") {
    return null;
  }

  const id = parseAssetId(value, "render-target");

  if (id === null) {
    diagnostics.push(
      diagnostic("render.camera.invalidRenderTargetHandle", entity),
    );
    return null;
  }

  return createRenderTargetHandle(id);
}

export function readEnvironmentMapHandle(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): EnvironmentMapHandle | null | undefined {
  const value = entity.getValue(Light, "environmentMapId") ?? "";

  if (value === "") {
    return null;
  }

  const id = parseAssetId(value, "environment-map");

  if (id === null) {
    diagnostics.push(diagnostic("render.environment.invalidHandle", entity));
    return undefined;
  }

  return createEnvironmentMapHandle(id);
}

export function cameraInput(entity: Entity): CameraInput {
  return {
    projection: (entity.getValue(Camera, "projection") ?? "perspective") as
      | "perspective"
      | "orthographic",
    fovYRadians: entity.getValue(Camera, "fovYRadians") ?? Math.PI / 3,
    aspect: entity.getValue(Camera, "aspect") ?? 1,
    near: entity.getValue(Camera, "near") ?? 0.1,
    far: entity.getValue(Camera, "far") ?? 1000,
    orthographicHeight: entity.getValue(Camera, "orthographicHeight") ?? 10,
    viewport: Array.from(entity.getVectorView(Camera, "viewport")) as [
      number,
      number,
      number,
      number,
    ],
    scissor: Array.from(entity.getVectorView(Camera, "scissor")) as [
      number,
      number,
      number,
      number,
    ],
    layerMask: entity.getValue(Camera, "layerMask") ?? 1,
    frustumCulling: entity.getValue(Camera, "frustumCulling") !== false,
    temporalJitter: [
      readCameraNumber(entity, "temporalJitterX"),
      readCameraNumber(entity, "temporalJitterY"),
    ],
  };
}

export function applyTemporalJitter(
  projectionMatrix: Mat4,
  entity: Entity,
): void {
  const jitterX = readCameraNumber(entity, "temporalJitterX");
  const jitterY = readCameraNumber(entity, "temporalJitterY");

  if (jitterX === 0 && jitterY === 0) {
    return;
  }

  projectionMatrix[8] = (projectionMatrix[8] ?? 0) + jitterX;
  projectionMatrix[9] = (projectionMatrix[9] ?? 0) + jitterY;
}

export function lightInput(entity: Entity): LightInput {
  return {
    kind: (entity.getValue(Light, "kind") ?? "directional") as
      | "ambient"
      | "environment"
      | "directional"
      | "point"
      | "spot"
      | "rect-area",
    shape: (entity.getValue(Light, "shape") ?? "rect") as
      | "rect"
      | "disk"
      | "sphere",
    intensity: entity.getValue(Light, "intensity") ?? 1,
    range: entity.getValue(Light, "range") ?? 10,
    innerConeAngle: entity.getValue(Light, "innerConeAngle") ?? Math.PI / 8,
    outerConeAngle: entity.getValue(Light, "outerConeAngle") ?? Math.PI / 6,
    width: entity.getValue(Light, "width") ?? 2,
    height: entity.getValue(Light, "height") ?? 2,
    layerMask: entity.getValue(Light, "layerMask") ?? 1,
  };
}

export function spriteInput(entity: Entity): SpriteInput {
  const texture = parseTextureHandle(
    entity.getValue(Sprite, "textureId") ?? "",
  );
  const samplerId = entity.getValue(Sprite, "samplerId") ?? "";
  const sampler = samplerId === "" ? null : parseSamplerHandle(samplerId);

  return {
    texture: texture ?? createTextureHandle("__invalid_sprite_texture__"),
    ...(samplerId === ""
      ? {}
      : {
          sampler: sampler ?? createSamplerHandle("__invalid_sprite_sampler__"),
        }),
    size: [
      entity.getValue(Sprite, "width") ?? 1,
      entity.getValue(Sprite, "height") ?? 1,
    ],
    color: Array.from(entity.getVectorView(Sprite, "color")) as [
      number,
      number,
      number,
      number,
    ],
    uvRect: Array.from(entity.getVectorView(Sprite, "uvRect")) as [
      number,
      number,
      number,
      number,
    ],
    pivot: Array.from(entity.getVectorView(Sprite, "pivot")) as [
      number,
      number,
    ],
    rotation: entity.getValue(Sprite, "rotation") ?? 0,
    atlasFrame: entity.getValue(Sprite, "atlasFrame") ?? 0,
    coordinateMode: (entity.getValue(Sprite, "coordinateMode") ?? "world") as
      | "world"
      | "screen",
    billboardMode: (entity.getValue(Sprite, "billboardMode") ?? "spherical") as
      | "none"
      | "spherical"
      | "cylindrical"
      | "axis-locked",
    sizeMode: (entity.getValue(Sprite, "sizeMode") ?? "world-units") as
      | "world-units"
      | "screen-pixels",
    blendMode: (entity.getValue(Sprite, "blendMode") ?? "alpha") as
      | "opaque"
      | "alpha"
      | "additive"
      | "multiply",
  };
}

export function skyboxInput(entity: Entity): SkyboxInput {
  const texture = parseTextureHandle(
    entity.getValue(Skybox, "textureId") ?? "",
  );
  const samplerId = entity.getValue(Skybox, "samplerId") ?? "";
  const sampler = samplerId === "" ? null : parseSamplerHandle(samplerId);

  return {
    texture: texture ?? createTextureHandle("__invalid_skybox_texture__"),
    ...(samplerId === ""
      ? {}
      : {
          sampler: sampler ?? createSamplerHandle("__invalid_skybox_sampler__"),
        }),
    intensity: entity.getValue(Skybox, "intensity") ?? 1,
  };
}

export function fogInput(entity: Entity): FogInput {
  return {
    mode: (entity.getValue(Fog, "mode") ?? FogMode.Linear) as FogMode,
    color: Array.from(entity.getVectorView(Fog, "color")) as [
      number,
      number,
      number,
      number,
    ],
    density: entity.getValue(Fog, "density") ?? 0,
    start: entity.getValue(Fog, "start") ?? 1,
    end: entity.getValue(Fog, "end") ?? 1000,
  };
}

export function parseMeshHandle(value: string): MeshHandle | null {
  const id = parseAssetId(value, "mesh");
  return id === null ? null : createMeshHandle(id);
}

export function parseMaterialHandle(value: string): MaterialHandle | null {
  const id = parseAssetId(value, "material");
  return id === null ? null : createMaterialHandle(id);
}

export function parseTextureHandle(value: string): TextureHandle | null {
  const id = parseAssetId(value, "texture");
  return id === null ? null : createTextureHandle(id);
}

export function parseSamplerHandle(value: string): SamplerHandle | null {
  const id = parseAssetId(value, "sampler");
  return id === null ? null : createSamplerHandle(id);
}

export function parseParticleEffectHandle(
  value: string,
): ParticleEffectHandle | null {
  const id = parseAssetId(value, "particle-effect");
  return id === null ? null : createParticleEffectHandle(id);
}

function parseAssetId(value: string, kind: string): string | null {
  const prefix = `${kind}:`;
  return value.startsWith(prefix) && value.length > prefix.length
    ? value.slice(prefix.length)
    : null;
}
