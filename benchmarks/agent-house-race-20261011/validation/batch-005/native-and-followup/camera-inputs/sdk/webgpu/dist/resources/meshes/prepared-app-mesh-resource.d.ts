import { type MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "@aperture-engine/render";
import { type PreparedMeshGpuResource, type PreparedMeshGpuResourceCache, type PreparedMeshGpuResourceCacheStatus } from "./prepared-mesh-cache.js";
export type { PreparedMeshGpuResourceCache } from "./prepared-mesh-cache.js";
export interface PreparedAppMeshResourceUse {
    readonly status: Extract<PreparedMeshGpuResourceCacheStatus, "created" | "reused">;
    readonly resource: PreparedMeshGpuResource;
}
export interface PrepareAppMeshResourceOptions {
    readonly device: unknown;
    readonly mesh: MeshAsset | null;
    readonly meshHandle: MeshHandle;
    readonly meshKey: string;
    readonly frame?: number | undefined;
    readonly preparedMeshes: PreparedMeshGpuResourceCache;
}
export declare function prepareAppMeshResource(options: PrepareAppMeshResourceOptions): PreparedAppMeshResourceUse | null;
//# sourceMappingURL=prepared-app-mesh-resource.d.ts.map