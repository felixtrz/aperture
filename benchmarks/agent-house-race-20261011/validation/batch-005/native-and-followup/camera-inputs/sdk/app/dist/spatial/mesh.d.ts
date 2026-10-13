import { type Mat4Like } from "@aperture-engine/simulation";
import type { RayInput, SpatialRaycastHit, SpatialRaycastOptions, SpatialRaycastableMesh } from "./types.js";
export interface SpatialMeshRaycastResult {
    readonly hit: SpatialRaycastHit | null;
    readonly queryableMeshCount: number;
}
export interface SpatialMeshRaycastHitsResult {
    readonly hits: readonly SpatialRaycastHit[];
    readonly queryableMeshCount: number;
}
export declare function raycastMeshHit(meshes: readonly SpatialRaycastableMesh[], ray: RayInput, options: SpatialRaycastOptions): SpatialMeshRaycastResult;
export declare function raycastMeshHits(meshes: readonly SpatialRaycastableMesh[], ray: RayInput, options: SpatialRaycastOptions): SpatialMeshRaycastHitsResult;
export declare function meshQueryTransforms(entry: SpatialRaycastableMesh): {
    readonly meshFromWorld?: Mat4Like;
    readonly worldFromMesh?: Mat4Like;
} | null;
//# sourceMappingURL=mesh.d.ts.map