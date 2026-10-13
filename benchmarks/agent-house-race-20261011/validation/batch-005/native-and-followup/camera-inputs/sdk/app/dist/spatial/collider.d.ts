import type { EcsWorld } from "@aperture-engine/simulation";
import type { PhysicsBackend } from "@aperture-engine/physics";
import type { RayInput, SpatialRaycastHit, SpatialRaycastOptions } from "./types.js";
export interface SpatialColliderQueries {
    readonly world: EcsWorld;
    getPhysicsBackend(): PhysicsBackend | null;
}
export declare function raycastColliderHit(colliderQueries: SpatialColliderQueries | undefined, ray: RayInput, options: SpatialRaycastOptions): SpatialRaycastHit | null;
export declare function raycastColliderHits(colliderQueries: SpatialColliderQueries | undefined, ray: RayInput, options: SpatialRaycastOptions): readonly SpatialRaycastHit[];
//# sourceMappingURL=collider.d.ts.map