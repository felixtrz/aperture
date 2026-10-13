import { type Vec3Like } from "@aperture-engine/simulation";
import type { SpatialOverlapHit, SpatialOverlapOptions, SpatialRaycastableMesh } from "./types.js";
/** Entities whose BVH-backed mesh overlaps a world-space sphere. */
export declare function overlapSphereOnMeshes(meshes: readonly SpatialRaycastableMesh[], center: Vec3Like, radius: number, options: SpatialOverlapOptions): readonly SpatialOverlapHit[];
/**
 * Entities whose BVH-backed mesh overlaps a world-space AABB. The box is handed
 * to the BVH with the mesh-from-world transform so it is localized exactly
 * (including rotation) rather than treated as axis-aligned in mesh space.
 */
export declare function overlapBoxOnMeshes(meshes: readonly SpatialRaycastableMesh[], min: Vec3Like, max: Vec3Like, options: SpatialOverlapOptions): readonly SpatialOverlapHit[];
/**
 * Entities whose BVH-backed mesh overlaps a world-space capsule. The segment
 * endpoints are transformed into mesh space; the radius is world-space (exact
 * for rigid mesh transforms).
 */
export declare function overlapCapsuleOnMeshes(meshes: readonly SpatialRaycastableMesh[], start: Vec3Like, end: Vec3Like, radius: number, options: SpatialOverlapOptions): readonly SpatialOverlapHit[];
//# sourceMappingURL=overlap.d.ts.map