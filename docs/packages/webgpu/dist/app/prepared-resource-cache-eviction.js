import { evictPreparedBuiltInMaterialStoreEntries, writePreparedBuiltInMaterialStoreSummary, } from "../materials/core/prepared-built-in-material-store.js";
import { evictPreparedMeshGpuResourceCacheEntries, writePreparedMeshGpuResourceCacheSummary, } from "../resources/meshes/prepared-mesh-cache.js";
const WEBGPU_APP_PREPARED_RESOURCE_CACHE_MAX_UNUSED_FRAMES = 120;
export function createPreparedMeshGpuResourceCacheEvictionReport() {
    return { checked: 0, retained: 0, evicted: 0, skippedInUse: 0 };
}
export function createPreparedBuiltInMaterialCacheEvictionReport() {
    const unlit = createPreparedMeshGpuResourceCacheEvictionReport();
    const matcap = createPreparedMeshGpuResourceCacheEvictionReport();
    const standard = createPreparedMeshGpuResourceCacheEvictionReport();
    const debugNormal = createPreparedMeshGpuResourceCacheEvictionReport();
    return {
        checked: 0,
        retained: 0,
        evicted: 0,
        skippedInUse: 0,
        families: {
            unlit,
            matcap,
            standard,
            "debug-normal": debugNormal,
        },
    };
}
export function evictWebGpuAppPreparedResourceCaches(options) {
    const evictionOptions = {
        currentFrame: options.frame,
        maxUnusedFrames: options.maxUnusedFrames ??
            WEBGPU_APP_PREPARED_RESOURCE_CACHE_MAX_UNUSED_FRAMES,
    };
    const preparedMeshCache = evictPreparedMeshGpuResourceCacheEntries(options.cache.preparedMeshes, evictionOptions);
    const preparedMaterialCache = evictPreparedBuiltInMaterialStoreEntries(options.cache.preparedMaterials, evictionOptions);
    if (options.resourceReuse !== undefined) {
        options.resourceReuse.preparedMeshCacheEviction = preparedMeshCache;
        options.resourceReuse.preparedMaterialCacheEviction = preparedMaterialCache;
        writePreparedMeshGpuResourceCacheSummary(options.resourceReuse.preparedMeshCache, options.cache.preparedMeshes);
        writePreparedBuiltInMaterialStoreSummary(options.resourceReuse.preparedMaterialCache, options.cache.preparedMaterials);
    }
    return { preparedMeshCache, preparedMaterialCache };
}
//# sourceMappingURL=prepared-resource-cache-eviction.js.map