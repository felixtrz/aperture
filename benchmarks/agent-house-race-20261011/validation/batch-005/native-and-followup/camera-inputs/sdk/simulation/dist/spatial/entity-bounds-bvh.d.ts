import { type Vec3Like } from "@aperture-engine/math";
import type { RaycastHit, RaycastOptions, RaycastableBounds } from "../raycaster.js";
export interface EntityBoundsBvhOptions {
    readonly maxLeafSize?: number;
    readonly maxDepth?: number;
}
export interface EntityBoundsBvhQueryStats {
    candidateEntityCount: number;
    testedEntityCount: number;
    visitedNodeCount: number;
}
export interface EntityBoundsBvhRaycastOptions extends RaycastOptions {
    readonly stats?: EntityBoundsBvhQueryStats;
}
export declare function createEntityBoundsBvh<TEntity>(bounds: readonly RaycastableBounds<TEntity>[], options?: EntityBoundsBvhOptions): EntityBoundsBvh<TEntity>;
export declare function createEntityBoundsBvhQueryStats(): EntityBoundsBvhQueryStats;
export declare class EntityBoundsBvh<TEntity> {
    private readonly options;
    private readonly items;
    private readonly indexByEntity;
    private root;
    private dirty;
    constructor(bounds: readonly RaycastableBounds<TEntity>[], options?: EntityBoundsBvhOptions);
    get count(): number;
    raycast(origin: Vec3Like, direction: Vec3Like, options?: EntityBoundsBvhRaycastOptions): RaycastHit<TEntity>[];
    updateBounds(entity: TEntity, bounds: Omit<RaycastableBounds<TEntity>, "entity">): boolean;
    refitDirty(): void;
}
//# sourceMappingURL=entity-bounds-bvh.d.ts.map