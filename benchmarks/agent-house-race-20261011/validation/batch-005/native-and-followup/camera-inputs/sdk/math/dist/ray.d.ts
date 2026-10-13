import type { Aabb, BoundingSphere, Ray, RayHit } from "./types.js";
export declare function intersectRayAabb(ray: Ray, aabb: Aabb, maxDistance?: number): RayHit | null;
export declare function intersectRaySphere(ray: Ray, sphere: BoundingSphere, maxDistance?: number): RayHit | null;
//# sourceMappingURL=ray.d.ts.map