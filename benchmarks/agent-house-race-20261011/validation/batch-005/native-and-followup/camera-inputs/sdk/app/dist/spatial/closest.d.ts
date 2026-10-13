import { type Vec3Like } from "@aperture-engine/simulation";
import type { SpatialClosestPointHit, SpatialClosestPointOptions, SpatialRaycastableMesh } from "./types.js";
export interface SpatialMeshClosestPointResult {
    readonly hit: SpatialClosestPointHit | null;
    readonly queryableMeshCount: number;
}
/**
 * Closest point on any BVH-backed registered mesh to a world-space point.
 *
 * The query point is transformed into each mesh's local space, resolved against
 * its BVH, and the resulting surface point transformed back to world space; the
 * winner is chosen by world-space distance (so meshes with different transforms
 * are compared consistently). `maxDistance` is applied as a world-space filter.
 * Meshes without a BVH are skipped (there is no triangle-scan closest-point
 * fallback today).
 */
export declare function closestPointOnMeshes(meshes: readonly SpatialRaycastableMesh[], point: Vec3Like, options: SpatialClosestPointOptions): SpatialMeshClosestPointResult;
//# sourceMappingURL=closest.d.ts.map