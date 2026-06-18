import {
  analyzeParticleEffectRuntimeFeatures,
  type ParticleEffectRuntimeFeatureReport,
} from "@aperture-engine/render";
import type { ApertureParticleEffectAssetDescriptor } from "../config/index.js";
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
    handle.descriptor,
  );
  PARTICLE_RUNTIME_FEATURE_CACHE.set(handle, {
    descriptor: handle.descriptor,
    runtimeFeatures,
  });
  return runtimeFeatures;
}
