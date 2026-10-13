import { type MeshHandle } from "@aperture-engine/simulation";
import { type MeshAsset, type MeshUploadPlanDiagnostic } from "@aperture-engine/render";
import { type MeshUploadBufferDescriptorDiagnostic, type MeshUploadBufferDescriptorPlan } from "./mesh-buffer-descriptors.js";
import { type MeshGpuBufferCreationDiagnostic, type MeshGpuBufferResource } from "./mesh-buffer-resources.js";
import type { WebGpuBufferDeviceLike } from "../../gpu/buffer.js";
export type PreparedMeshGpuResourceCacheStatus = "created" | "reused" | "failed";
export interface PreparedMeshGpuResource {
    readonly cacheKey: string;
    readonly sourceMeshKey: string;
    readonly sourceVersion: number;
    readonly layoutKey: string;
    lastUsedFrame: number;
    readonly mesh: MeshGpuBufferResource;
}
import type { createRenderedGeometryInspector } from "../../app/rendered-geometry-inspector.js";
export interface PreparedMeshGpuResourceCache {
    readonly geometryInspection?: ReturnType<typeof createRenderedGeometryInspector>;
    readonly resources: Map<string, PreparedMeshGpuResource>;
}
export interface PreparedMeshGpuResourceCacheSummaryLayout {
    layoutKey: string;
    entries: number;
}
export interface PreparedMeshGpuResourceCacheSummary {
    totalEntries: number;
    layouts: PreparedMeshGpuResourceCacheSummaryLayout[];
}
export interface PreparedMeshGpuResourceCacheEvictionOptions {
    readonly currentFrame: number;
    readonly maxUnusedFrames: number;
}
export interface PreparedMeshGpuResourceCacheEvictionReport {
    readonly checked: number;
    readonly retained: number;
    readonly evicted: number;
    readonly skippedInUse: number;
}
export type PreparedMeshGpuResourceDiagnostic = MeshUploadPlanDiagnostic | MeshUploadBufferDescriptorDiagnostic | MeshGpuBufferCreationDiagnostic;
export interface PrepareMeshGpuResourceOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly cache: PreparedMeshGpuResourceCache;
    readonly handle: MeshHandle;
    readonly mesh: MeshAsset;
    readonly sourceVersion: number;
    readonly frame?: number | undefined;
}
export interface PrepareMeshGpuResourceResult {
    readonly valid: boolean;
    readonly status: PreparedMeshGpuResourceCacheStatus;
    readonly resource: PreparedMeshGpuResource | null;
    readonly diagnostics: readonly PreparedMeshGpuResourceDiagnostic[];
}
export declare function createPreparedMeshGpuResourceCache(geometryInspection?: ReturnType<typeof createRenderedGeometryInspector>): PreparedMeshGpuResourceCache;
export declare function createPreparedMeshGpuResourceCacheSummary(): PreparedMeshGpuResourceCacheSummary;
export declare function writePreparedMeshGpuResourceCacheSummary(summary: PreparedMeshGpuResourceCacheSummary, cache: PreparedMeshGpuResourceCache): PreparedMeshGpuResourceCacheSummary;
export declare function evictPreparedMeshGpuResourceCacheEntries(cache: PreparedMeshGpuResourceCache, options: PreparedMeshGpuResourceCacheEvictionOptions): PreparedMeshGpuResourceCacheEvictionReport;
export declare function prepareMeshGpuResource(options: PrepareMeshGpuResourceOptions): PrepareMeshGpuResourceResult;
export declare function preparedMeshGpuResourceCacheKey(input: {
    readonly sourceMeshKey: string;
    readonly sourceVersion: number;
    readonly layoutKey: string;
}): string;
export declare function preparedMeshGpuResourceLayoutKey(plan: MeshUploadBufferDescriptorPlan): string;
//# sourceMappingURL=prepared-mesh-cache.d.ts.map