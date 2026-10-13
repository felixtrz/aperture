import { type Aabb, type BoundingSphere, type RayHit, type Vec3Like } from "@aperture-engine/math";
export interface RaycastableBounds<TEntity = unknown> {
    readonly entity: TEntity;
    readonly worldAabb: Aabb;
    readonly worldSphere?: BoundingSphere;
    readonly layerMask?: number;
}
export interface RaycastWorld<TEntity = unknown> {
    readonly bounds: readonly RaycastableBounds<TEntity>[];
}
export interface RaycastOptions {
    readonly maxDistance?: number;
    readonly layerMask?: number;
}
export interface RaycastHit<TEntity = unknown> extends RayHit {
    readonly entity: TEntity;
    readonly bounds: RaycastableBounds<TEntity>;
}
export declare function raycast<TEntity>(world: RaycastWorld<TEntity> | readonly RaycastableBounds<TEntity>[], origin: Vec3Like, direction: Vec3Like, options?: RaycastOptions): RaycastHit<TEntity>[];
//# sourceMappingURL=raycaster.d.ts.map