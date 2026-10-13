import { type SpatialColliderQueries } from "./collider.js";
import type { SpatialQueries } from "./types.js";
export type { RayInput, SpatialClosestPointHit, SpatialClosestPointOptions, SpatialOverlapHit, SpatialOverlapOptions, SpatialPickableState, SpatialQueries, SpatialRaycastHit, SpatialRaycastOptions, SpatialRaycastableBounds, SpatialRaycastableMesh, } from "./types.js";
export interface CreateSpatialQueriesOptions {
    readonly colliders?: SpatialColliderQueries;
}
export declare function createSpatialQueries(setup?: CreateSpatialQueriesOptions): SpatialQueries;
//# sourceMappingURL=index.d.ts.map