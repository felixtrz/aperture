import {
  analyzeParticleEffectRuntimeFeatures,
  type ParticleEffectAssetInput,
  type ParticleEmitterEffectAssetInput,
  type ParticleEffectRuntimeFeatureReport,
} from "@aperture-engine/render";
import type {
  ApertureParticleEffectAssetDescriptor,
  ApertureParticleEmitterEffectAssetDescriptor,
} from "../config/index.js";
import {
  systemAssetReadyMetadata,
  type SystemAssetHandle,
  type SystemAssetKind,
  type SystemParticleEffectAssetHandle,
} from "../systems.js";

interface CachedParticleRuntimeFeatures {
  readonly descriptor: ApertureParticleEffectAssetDescriptor;
  readonly runtimeFeatures: ParticleEffectRuntimeFeatureReport;
}

const PARTICLE_RUNTIME_FEATURE_CACHE = new WeakMap<
  SystemParticleEffectAssetHandle,
  CachedParticleRuntimeFeatures
>();

export function createAssetSummary(
  handles: readonly SystemAssetHandle<SystemAssetKind>[],
): readonly Record<string, unknown>[] {
  return handles.map((handle) => {
    const particleEffectRuntime =
      handle.kind === "particle-effect"
        ? {
            runtimeFeatures: particleRuntimeFeatures(
              handle as SystemParticleEffectAssetHandle,
            ),
          }
        : {};

    return {
      id: handle.id,
      kind: handle.kind,
      url: handle.url,
      preload: handle.preload,
      ready: handle.ready.value,
      error: handle.error.value,
      ...systemAssetReadyMetadata(handle),
      ...particleEffectRuntime,
    };
  });
}

function particleRuntimeFeatures(
  handle: SystemParticleEffectAssetHandle,
): ParticleEffectRuntimeFeatureReport {
  const cached = PARTICLE_RUNTIME_FEATURE_CACHE.get(handle);

  if (cached !== undefined && cached.descriptor === handle.descriptor) {
    return cached.runtimeFeatures;
  }

  const runtimeFeatures = analyzeParticleEffectRuntimeFeatures(
    createParticleRuntimeFeatureInput(handle.descriptor),
  );
  PARTICLE_RUNTIME_FEATURE_CACHE.set(handle, {
    descriptor: handle.descriptor,
    runtimeFeatures,
  });
  return runtimeFeatures;
}

function createParticleRuntimeFeatureInput(
  descriptor: ApertureParticleEffectAssetDescriptor,
): ParticleEffectAssetInput {
  if (descriptor.type === "composite") {
    // Composite effects expose no leaf modules; runtime-feature analysis only
    // inspects the discriminant, so an empty emitter list is sufficient here.
    return { version: 2, type: "composite", emitters: [] };
  }

  const renderer = createParticleRuntimeFeatureRenderer(descriptor.renderer);

  return {
    version: 2,
    ...(descriptor.label === undefined ? {} : { label: descriptor.label }),
    ...(descriptor.main === undefined ? {} : { main: descriptor.main }),
    ...(descriptor.emission === undefined
      ? {}
      : { emission: descriptor.emission }),
    ...(descriptor.shape === undefined ? {} : { shape: descriptor.shape }),
    ...(renderer === undefined ? {} : { renderer }),
    ...(descriptor.textureSheetAnimation === undefined
      ? {}
      : { textureSheetAnimation: descriptor.textureSheetAnimation }),
    ...(descriptor.colorOverLifetime === undefined
      ? {}
      : { colorOverLifetime: descriptor.colorOverLifetime }),
    ...(descriptor.sizeOverLifetime === undefined
      ? {}
      : { sizeOverLifetime: descriptor.sizeOverLifetime }),
    ...(descriptor.rotationOverLifetime === undefined
      ? {}
      : { rotationOverLifetime: descriptor.rotationOverLifetime }),
    ...(descriptor.velocityOverLifetime === undefined
      ? {}
      : { velocityOverLifetime: descriptor.velocityOverLifetime }),
    ...(descriptor.forceOverLifetime === undefined
      ? {}
      : { forceOverLifetime: descriptor.forceOverLifetime }),
    ...(descriptor.limitVelocityOverLifetime === undefined
      ? {}
      : { limitVelocityOverLifetime: descriptor.limitVelocityOverLifetime }),
    ...(descriptor.noise === undefined ? {} : { noise: descriptor.noise }),
    ...(descriptor.subEmitters === undefined
      ? {}
      : { subEmitters: descriptor.subEmitters }),
    ...(descriptor.source === undefined ? {} : { source: descriptor.source }),
    ...(descriptor.curveSampleCount === undefined
      ? {}
      : { curveSampleCount: descriptor.curveSampleCount }),
  };
}

function createParticleRuntimeFeatureRenderer(
  renderer: ApertureParticleEmitterEffectAssetDescriptor["renderer"],
): ParticleEmitterEffectAssetInput["renderer"] | undefined {
  if (renderer === undefined) {
    return undefined;
  }

  return {
    ...(renderer.renderMode === undefined
      ? {}
      : { renderMode: renderer.renderMode }),
    ...(renderer.blendMode === undefined
      ? {}
      : { blendMode: renderer.blendMode }),
    ...(renderer.sortMode === undefined ? {} : { sortMode: renderer.sortMode }),
    ...(renderer.renderOrder === undefined
      ? {}
      : { renderOrder: renderer.renderOrder }),
    ...(renderer.softParticles === undefined
      ? {}
      : { softParticles: renderer.softParticles }),
    ...(renderer.texture === null ? { texture: null } : {}),
    ...(renderer.sampler === null ? { sampler: null } : {}),
  };
}
