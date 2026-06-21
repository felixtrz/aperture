import { analyzeParticleEffectRuntimeFeatures, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { systemAssetReadyMetadata, } from "../systems.js";
const PARTICLE_RUNTIME_FEATURE_CACHE = new WeakMap();
export function createAssetSummary(handles) {
    return handles.map((handle) => {
        const particleEffectRuntime = handle.kind === "particle-effect"
            ? {
                runtimeFeatures: particleRuntimeFeatures(handle),
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
function particleRuntimeFeatures(handle) {
    const cached = PARTICLE_RUNTIME_FEATURE_CACHE.get(handle);
    if (cached !== undefined && cached.descriptor === handle.descriptor) {
        return cached.runtimeFeatures;
    }
    const runtimeFeatures = analyzeParticleEffectRuntimeFeatures(handle.descriptor);
    PARTICLE_RUNTIME_FEATURE_CACHE.set(handle, {
        descriptor: handle.descriptor,
        runtimeFeatures,
    });
    return runtimeFeatures;
}
//# sourceMappingURL=assets.js.map