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

export interface SpatialQueries {
  raycastFirst(
    ray: RayInput,
    options?: SpatialRaycastOptions,
  ): SpatialRaycastHit | null;
  raycastAll(
    ray: RayInput,
    options?: SpatialRaycastOptions,
  ): readonly SpatialRaycastHit[];
  setBounds(bounds: readonly SpatialRaycastableBounds[]): void;
  setMeshes(meshes: readonly SpatialRaycastableMesh[]): void;
}
