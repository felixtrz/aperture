import type {
  Entity,
  Mat4Like,
  MeshBvh,
  RaycastableBounds,
  SpatialTriangleMesh,
  Vec3Like,
} from "@aperture-engine/simulation";

import type { EcsEntityRef } from "../config.js";
import type { ApertureQuery } from "../systems.js";

export interface RayInput {
  readonly origin: Vec3Like;
  readonly direction: Vec3Like;
}

export interface SpatialRaycastOptions {
  readonly query?: ApertureQuery;
  readonly maxDistance?: number;
  readonly layerMask?: number;
  readonly source?: "bounds" | "visual-mesh" | "collider";
  readonly fallback?: "none" | "bounds";
  readonly includeBackfaces?: boolean;
  readonly includeUv?: boolean;
  readonly includeNormal?: boolean;
  readonly includeSensors?: boolean;
  readonly filter?: (entity: Entity) => boolean;
}

export interface SpatialRaycastHit {
  readonly entity: {
    readonly entity: Entity;
    readonly ref: EcsEntityRef;
  };
  readonly distance: number;
  readonly point: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
  readonly uv?: readonly [number, number];
  readonly barycentric?: readonly [number, number, number];
  readonly faceIndex?: number;
  readonly submeshIndex?: number;
  readonly materialSlot?: number;
  readonly source: "bounds" | "mesh-linear" | "mesh-bvh" | "collider";
}

export interface SpatialPickableState {
  readonly enabled?: boolean;
  readonly layerMask?: number;
  readonly precision?: "bounds" | "visual-mesh" | "collider";
  readonly blocksLower?: boolean;
  readonly priority?: number;
}

export interface SpatialRaycastableBounds extends RaycastableBounds<Entity> {
  readonly visible?: boolean;
  readonly pickable?: SpatialPickableState;
}

export interface SpatialRaycastableMesh {
  readonly entity: Entity;
  readonly mesh: SpatialTriangleMesh;
  readonly bvh?: MeshBvh;
  readonly worldFromMesh?: Mat4Like;
  readonly meshFromWorld?: Mat4Like;
  readonly layerMask?: number;
  readonly visible?: boolean;
  readonly pickable?: SpatialPickableState;
}

export interface SpatialClosestPointOptions {
  readonly query?: ApertureQuery;
  /** World-space cap; results farther than this from the query point are dropped. */
  readonly maxDistance?: number;
  readonly layerMask?: number;
  readonly filter?: (entity: Entity) => boolean;
}

export interface SpatialClosestPointHit {
  readonly entity: {
    readonly entity: Entity;
    readonly ref: EcsEntityRef;
  };
  /** Closest surface point, in world space. */
  readonly point: readonly [number, number, number];
  /** World-space distance from the query point to {@link point}. */
  readonly distance: number;
  readonly faceIndex: number;
  readonly submeshIndex: number;
  readonly materialSlot: number;
}

export interface SpatialOverlapOptions {
  readonly query?: ApertureQuery;
  readonly layerMask?: number;
  readonly filter?: (entity: Entity) => boolean;
}

export interface SpatialOverlapHit {
  readonly entity: {
    readonly entity: Entity;
    readonly ref: EcsEntityRef;
  };
}

export interface SpatialQueries {
  raycastFirst(
    ray: RayInput,
    options?: SpatialRaycastOptions,
  ): SpatialRaycastHit | null;
  raycastAll(
    ray: RayInput,
    options?: SpatialRaycastOptions,
  ): readonly SpatialRaycastHit[];
  /**
   * Closest point on any registered BVH-backed visual mesh to a world-space
   * point, or null if none is in range. Meshes without a BVH are skipped.
   */
  closestPoint(
    point: readonly [number, number, number],
    options?: SpatialClosestPointOptions,
  ): SpatialClosestPointHit | null;
  /**
   * Entities whose BVH-backed visual mesh overlaps a world-space sphere. Meshes
   * without a BVH are skipped; the radius is treated as world-space (exact for
   * rigid mesh transforms).
   */
  overlapSphere(
    center: readonly [number, number, number],
    radius: number,
    options?: SpatialOverlapOptions,
  ): readonly SpatialOverlapHit[];
  /**
   * Entities whose BVH-backed visual mesh overlaps a world-space axis-aligned
   * box. Meshes without a BVH are skipped.
   */
  overlapBox(
    min: readonly [number, number, number],
    max: readonly [number, number, number],
    options?: SpatialOverlapOptions,
  ): readonly SpatialOverlapHit[];
  /**
   * Entities whose BVH-backed visual mesh overlaps a world-space capsule
   * (segment + radius). Meshes without a BVH are skipped; the radius is
   * world-space (exact for rigid mesh transforms).
   */
  overlapCapsule(
    start: readonly [number, number, number],
    end: readonly [number, number, number],
    radius: number,
    options?: SpatialOverlapOptions,
  ): readonly SpatialOverlapHit[];
  setBounds(bounds: readonly SpatialRaycastableBounds[]): void;
  setMeshes(meshes: readonly SpatialRaycastableMesh[]): void;
}
