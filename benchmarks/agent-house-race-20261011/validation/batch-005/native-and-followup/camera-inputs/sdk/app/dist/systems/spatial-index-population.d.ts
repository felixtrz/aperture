import { type AssetRegistry, type EcsWorld, type MeshBvhCache, type MeshBvhCacheReport, type SpatialTriangleMesh, type Vec3Like } from "@aperture-engine/simulation";
import type { SpatialQueries, SpatialRaycastableBounds, SpatialRaycastableMesh } from "../spatial/index.js";
export interface SpatialIndexPopulationContext {
    readonly world: EcsWorld;
    readonly assetsRegistry: AssetRegistry;
    readonly spatial: SpatialQueries;
}
export interface SpatialIndexPopulationState {
    readonly bvhCache: MeshBvhCache;
    readonly entries: Map<string, CachedSpatialEntry>;
    readonly meshAssets: Map<string, CachedSpatialMeshAsset>;
}
export interface SpatialIndexPopulationDiagnostic {
    readonly code: string;
    readonly entity: {
        readonly index: number;
        readonly generation: number;
    };
    readonly message: string;
    readonly severity: "warning" | "error";
}
export interface SpatialIndexPopulationReport {
    readonly bounds: readonly SpatialRaycastableBounds[];
    readonly meshes: readonly SpatialRaycastableMesh[];
    readonly bvhReports: readonly MeshBvhCacheReport[];
    readonly diagnostics: readonly SpatialIndexPopulationDiagnostic[];
}
export declare function createSpatialIndexPopulationState(): SpatialIndexPopulationState;
export declare function populateSpatialIndexFromWorld(context: SpatialIndexPopulationContext, state?: SpatialIndexPopulationState): SpatialIndexPopulationReport;
interface CachedSpatialEntry {
    readonly entityVersion: number;
    readonly transformVersion: number;
    readonly meshId: string;
    readonly meshVersion: number;
    readonly localAabb: {
        readonly min: Vec3Like;
        readonly max: Vec3Like;
    };
    readonly bounds: SpatialRaycastableBounds;
    readonly mesh: SpatialRaycastableMesh;
    readonly bvhReport: MeshBvhCacheReport | null;
    readonly meshKey: string;
}
interface CachedSpatialMeshAsset {
    readonly meshId: string;
    readonly version: number;
    readonly mesh: SpatialTriangleMesh | null;
    readonly localAabb: {
        readonly min: Vec3Like;
        readonly max: Vec3Like;
    } | null;
    readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: "warning" | "error";
    }[];
}
export {};
//# sourceMappingURL=spatial-index-population.d.ts.map