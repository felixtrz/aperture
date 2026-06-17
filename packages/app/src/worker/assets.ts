import { analyzeParticleEffectRuntimeFeatures } from "@aperture-engine/render";
import {
  systemAssetReadyMetadata,
  type SystemAssetHandle,
  type SystemAssetKind,
  type SystemParticleEffectAssetHandle,
} from "../systems.js";

export function createAssetSummary(
  handles: readonly SystemAssetHandle<SystemAssetKind>[],
): readonly Record<string, unknown>[] {
  return handles.map((handle) => {
    const particleEffectRuntime =
      handle.kind === "particle-effect"
        ? {
            runtimeFeatures: analyzeParticleEffectRuntimeFeatures(
              (handle as SystemParticleEffectAssetHandle).descriptor,
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
