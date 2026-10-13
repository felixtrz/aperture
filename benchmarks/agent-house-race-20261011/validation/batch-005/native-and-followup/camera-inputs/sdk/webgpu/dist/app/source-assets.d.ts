import type { AssetRegistry } from "@aperture-engine/simulation";
import { type PreparedMaterialStore, type PreparedMeshStore, type RenderSnapshot } from "@aperture-engine/render";
import type { PreparedBuiltInMaterialStore } from "../materials/core/prepared-built-in-material-store.js";
import type { PreparedMeshGpuResourceCache } from "../resources/meshes/prepared-mesh-cache.js";
import type { AppTextureSamplerResourceCache } from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
export interface WebGpuAppSourceAssetFacadeCache extends AppTextureSamplerResourceCache {
    readonly preparedMeshFacade: PreparedMeshStore;
    readonly preparedMaterialFacade: PreparedMaterialStore;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
    readonly preparedMaterials: PreparedBuiltInMaterialStore;
}
export declare function prepareWebGpuAppSourceAssetFacades(options: {
    readonly registry: AssetRegistry;
    readonly snapshot: RenderSnapshot;
    readonly cache: WebGpuAppSourceAssetFacadeCache;
    readonly pruneUnreferenced?: boolean;
    readonly resourceReuse?: WebGpuAppResourceReuseReport;
}): void;
//# sourceMappingURL=source-assets.d.ts.map