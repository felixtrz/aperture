import { type PreparedBuiltInMaterialCacheEvictionReport } from "../materials/core/prepared-built-in-material-store.js";
import { type PreparedMeshGpuResourceCacheEvictionReport } from "../resources/meshes/prepared-mesh-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
export interface WebGpuAppPreparedResourceCacheEvictionReport {
    readonly preparedMeshCache: PreparedMeshGpuResourceCacheEvictionReport;
    readonly preparedMaterialCache: PreparedBuiltInMaterialCacheEvictionReport;
}
export declare function createPreparedMeshGpuResourceCacheEvictionReport(): PreparedMeshGpuResourceCacheEvictionReport;
export declare function createPreparedBuiltInMaterialCacheEvictionReport(): PreparedBuiltInMaterialCacheEvictionReport;
export declare function evictWebGpuAppPreparedResourceCaches(options: {
    readonly cache: Pick<WebGpuAppResourceCache, "preparedMeshes" | "preparedMaterials">;
    readonly frame: number;
    readonly maxUnusedFrames?: number;
    readonly resourceReuse?: WebGpuAppResourceReuseReport;
}): WebGpuAppPreparedResourceCacheEvictionReport;
//# sourceMappingURL=prepared-resource-cache-eviction.d.ts.map