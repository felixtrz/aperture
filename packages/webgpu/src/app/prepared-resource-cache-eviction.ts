import {
  evictPreparedBuiltInMaterialStoreEntries,
  writePreparedBuiltInMaterialStoreSummary,
  type PreparedBuiltInMaterialCacheEvictionReport,
} from "../materials/core/prepared-built-in-material-store.js";
import {
  evictPreparedMeshGpuResourceCacheEntries,
  writePreparedMeshGpuResourceCacheSummary,
  type PreparedMeshGpuResourceCacheEvictionReport,
} from "../resources/meshes/prepared-mesh-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

export const WEBGPU_APP_PREPARED_RESOURCE_CACHE_MAX_UNUSED_FRAMES = 3;

export interface WebGpuAppPreparedResourceCacheEvictionReport {
  readonly preparedMeshCache: PreparedMeshGpuResourceCacheEvictionReport;
  readonly preparedMaterialCache: PreparedBuiltInMaterialCacheEvictionReport;
}

export function createPreparedMeshGpuResourceCacheEvictionReport(): PreparedMeshGpuResourceCacheEvictionReport {
  return { checked: 0, retained: 0, evicted: 0, skippedInUse: 0 };
}

export function createPreparedBuiltInMaterialCacheEvictionReport(): PreparedBuiltInMaterialCacheEvictionReport {
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

export function evictWebGpuAppPreparedResourceCaches(options: {
  readonly cache: Pick<
    WebGpuAppResourceCache,
    "preparedMeshes" | "preparedMaterials"
  >;
  readonly frame: number;
  readonly maxUnusedFrames?: number;
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
}): WebGpuAppPreparedResourceCacheEvictionReport {
  const evictionOptions = {
    currentFrame: options.frame,
    maxUnusedFrames:
      options.maxUnusedFrames ??
      WEBGPU_APP_PREPARED_RESOURCE_CACHE_MAX_UNUSED_FRAMES,
  };
  const preparedMeshCache = evictPreparedMeshGpuResourceCacheEntries(
    options.cache.preparedMeshes,
    evictionOptions,
  );
  const preparedMaterialCache = evictPreparedBuiltInMaterialStoreEntries(
    options.cache.preparedMaterials,
    evictionOptions,
  );

  if (options.resourceReuse !== undefined) {
    options.resourceReuse.preparedMeshCacheEviction = preparedMeshCache;
    options.resourceReuse.preparedMaterialCacheEviction = preparedMaterialCache;
    writePreparedMeshGpuResourceCacheSummary(
      options.resourceReuse.preparedMeshCache,
      options.cache.preparedMeshes,
    );
    writePreparedBuiltInMaterialStoreSummary(
      options.resourceReuse.preparedMaterialCache,
      options.cache.preparedMaterials,
    );
  }

  return { preparedMeshCache, preparedMaterialCache };
}
