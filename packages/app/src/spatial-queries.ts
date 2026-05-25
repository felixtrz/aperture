import {
  invertMat4,
  raycast as raycastBounds,
  raycastFirstMeshTriangle,
  raycastMeshTriangles,
  transformPoint,
  transformVector,
  type Entity,
  type Mat4Like,
  type MeshBvh,
  type RaycastableBounds,
  type SpatialTriangleMesh,
  type Vec2Like,
  type Vec3Like,
} from "@aperture-engine/simulation";

import type { EcsEntityRef } from "./config.js";
import type { ApertureQuery } from "./systems.js";

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

interface SpatialMeshRaycastResult {
  readonly hit: SpatialRaycastHit | null;
  readonly queryableMeshCount: number;
}

interface SpatialMeshRaycastHitsResult {
  readonly hits: readonly SpatialRaycastHit[];
  readonly queryableMeshCount: number;
}

export function createSpatialQueries(): SpatialQueries {
  let bounds: readonly SpatialRaycastableBounds[] = [];
  let meshes: readonly SpatialRaycastableMesh[] = [];

  return {
    raycastFirst(ray, options = {}) {
      const source = options.source ?? "bounds";

      if (source === "bounds") {
        return raycastBoundsHit(bounds, ray, options);
      }

      if (source === "collider") {
        return options.fallback === "bounds"
          ? raycastBoundsHit(bounds, ray, options)
          : null;
      }

      const meshResult = raycastMeshHit(meshes, ray, options);

      if (meshResult.hit !== null || options.fallback !== "bounds") {
        return meshResult.hit;
      }

      return meshResult.queryableMeshCount === 0
        ? raycastBoundsHit(bounds, ray, options)
        : null;
    },
    raycastAll(ray, options = {}) {
      const source = options.source ?? "bounds";

      if (source === "bounds") {
        return raycastBoundsHits(bounds, ray, options);
      }

      if (source === "collider") {
        return options.fallback === "bounds"
          ? raycastBoundsHits(bounds, ray, options)
          : [];
      }

      const meshResult = raycastMeshHits(meshes, ray, options);

      if (meshResult.hits.length > 0 || options.fallback !== "bounds") {
        return meshResult.hits;
      }

      return meshResult.queryableMeshCount === 0
        ? raycastBoundsHits(bounds, ray, options)
        : [];
    },
    setBounds(nextBounds) {
      bounds = [...nextBounds];
    },
    setMeshes(nextMeshes) {
      meshes = [...nextMeshes];
    },
  };
}

function raycastBoundsHit(
  bounds: readonly SpatialRaycastableBounds[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): SpatialRaycastHit | null {
  return raycastBoundsHits(bounds, ray, options)[0] ?? null;
}

function raycastBoundsHits(
  bounds: readonly SpatialRaycastableBounds[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): readonly SpatialRaycastHit[] {
  const queryEntities = options.query?.entities;
  const candidates =
    queryEntities === undefined
      ? bounds
      : bounds.filter((candidate) => queryEntities.has(candidate.entity));
  const filteredCandidates = candidates.filter((candidate) =>
    spatialEntryMatches(candidate, candidate.entity, options, "bounds"),
  );
  return raycastBounds(filteredCandidates, ray.origin, ray.direction, {
    ...(options.maxDistance === undefined
      ? {}
      : { maxDistance: options.maxDistance }),
    ...(options.layerMask === undefined
      ? {}
      : { layerMask: options.layerMask }),
  }).map((boundsHit) => ({
    entity: {
      entity: boundsHit.entity,
      ref: entityRef(boundsHit.entity),
    },
    distance: boundsHit.distance,
    point: tuple3(boundsHit.point),
    source: "bounds",
  }));
}

function raycastMeshHit(
  meshes: readonly SpatialRaycastableMesh[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): SpatialMeshRaycastResult {
  const queryEntities = options.query?.entities;
  let closest: SpatialRaycastHit | null = null;
  let queryableMeshCount = 0;

  for (const entry of meshes) {
    if (queryEntities !== undefined && !queryEntities.has(entry.entity)) {
      continue;
    }

    if (!spatialEntryMatches(entry, entry.entity, options, "mesh")) {
      continue;
    }

    const transforms = meshQueryTransforms(entry);

    if (transforms === null) {
      continue;
    }

    queryableMeshCount += 1;

    const localRay = localRayForEntry(ray, transforms.meshFromWorld);
    const localHit =
      entry.bvh === undefined
        ? raycastFirstMeshTriangle(
            entry.mesh,
            localRay,
            meshRaycastOptions(options, transforms.meshFromWorld !== undefined),
          )
        : entry.bvh.raycastFirst(
            localRay,
            meshRaycastOptions(options, transforms.meshFromWorld !== undefined),
          );

    if (localHit === null) {
      continue;
    }

    const hit = spatialHitFromMeshHit(entry, ray, localHit, transforms);

    if (
      options.maxDistance !== undefined &&
      hit.distance > options.maxDistance
    ) {
      continue;
    }

    if (
      closest === null ||
      hit.distance < closest.distance ||
      (hit.distance === closest.distance &&
        hit.entity.ref.index < closest.entity.ref.index)
    ) {
      closest = hit;
    }
  }

  return { hit: closest, queryableMeshCount };
}

function raycastMeshHits(
  meshes: readonly SpatialRaycastableMesh[],
  ray: RayInput,
  options: SpatialRaycastOptions,
): SpatialMeshRaycastHitsResult {
  const queryEntities = options.query?.entities;
  const hits: SpatialRaycastHit[] = [];
  let queryableMeshCount = 0;

  for (const entry of meshes) {
    if (queryEntities !== undefined && !queryEntities.has(entry.entity)) {
      continue;
    }

    if (!spatialEntryMatches(entry, entry.entity, options, "mesh")) {
      continue;
    }

    const transforms = meshQueryTransforms(entry);

    if (transforms === null) {
      continue;
    }

    queryableMeshCount += 1;

    const localRay = localRayForEntry(ray, transforms.meshFromWorld);
    const localHits =
      entry.bvh === undefined
        ? raycastMeshTriangles(
            entry.mesh,
            localRay,
            meshRaycastOptions(options, transforms.meshFromWorld !== undefined),
          )
        : entry.bvh.raycast(
            localRay,
            meshRaycastOptions(options, transforms.meshFromWorld !== undefined),
          );

    for (const localHit of localHits) {
      const hit = spatialHitFromMeshHit(entry, ray, localHit, transforms);

      if (
        options.maxDistance !== undefined &&
        hit.distance > options.maxDistance
      ) {
        continue;
      }

      hits.push(hit);
    }
  }

  return { hits: sortSpatialHits(hits), queryableMeshCount };
}

function meshQueryTransforms(entry: SpatialRaycastableMesh): {
  readonly meshFromWorld?: Mat4Like;
  readonly worldFromMesh?: Mat4Like;
} | null {
  const meshFromWorld =
    entry.meshFromWorld ??
    (entry.worldFromMesh === undefined
      ? undefined
      : invertMat4(entry.worldFromMesh));
  const worldFromMesh =
    entry.worldFromMesh ??
    (entry.meshFromWorld === undefined
      ? undefined
      : invertMat4(entry.meshFromWorld));

  if (
    (entry.worldFromMesh !== undefined || entry.meshFromWorld !== undefined) &&
    (meshFromWorld === null || worldFromMesh === null)
  ) {
    return null;
  }

  return {
    ...(meshFromWorld === undefined ? {} : { meshFromWorld }),
    ...(worldFromMesh === undefined ? {} : { worldFromMesh }),
  };
}

function localRayForEntry(
  ray: RayInput,
  meshFromWorld: Mat4Like | undefined,
): RayInput {
  return meshFromWorld === undefined
    ? ray
    : {
        origin: transformPoint(meshFromWorld, ray.origin),
        direction: transformVector(meshFromWorld, ray.direction),
      };
}

function meshRaycastOptions(
  options: SpatialRaycastOptions,
  hasMeshTransform: boolean,
) {
  return {
    ...(options.maxDistance === undefined || hasMeshTransform
      ? {}
      : { maxDistance: options.maxDistance }),
    ...(options.includeBackfaces === undefined
      ? {}
      : { includeBackfaces: options.includeBackfaces }),
    ...(options.includeUv === undefined
      ? {}
      : { includeUv: options.includeUv }),
    ...(options.includeNormal === undefined
      ? {}
      : { includeNormal: options.includeNormal }),
  };
}

function spatialHitFromMeshHit(
  entry: SpatialRaycastableMesh,
  ray: RayInput,
  localHit: {
    readonly distance: number;
    readonly point: Vec3Like;
    readonly normal: Vec3Like;
    readonly uv?: Vec2Like;
    readonly barycentric: Vec3Like;
    readonly faceIndex: number;
    readonly submeshIndex: number;
    readonly materialSlot: number;
    readonly source: "mesh-linear" | "mesh-bvh";
  },
  transforms: {
    readonly worldFromMesh?: Mat4Like;
  },
): SpatialRaycastHit {
  const worldPoint =
    transforms.worldFromMesh === undefined
      ? localHit.point
      : transformPoint(transforms.worldFromMesh, localHit.point);
  const worldNormal =
    transforms.worldFromMesh === undefined
      ? localHit.normal
      : normalizeTuple3(
          transformVector(transforms.worldFromMesh, localHit.normal),
        );

  return {
    entity: {
      entity: entry.entity,
      ref: entityRef(entry.entity),
    },
    distance: distanceBetween(ray.origin, worldPoint),
    point: tuple3(worldPoint),
    normal: tuple3(worldNormal),
    ...(localHit.uv === undefined ? {} : { uv: tuple2(localHit.uv) }),
    barycentric: tuple3(localHit.barycentric),
    faceIndex: localHit.faceIndex,
    submeshIndex: localHit.submeshIndex,
    materialSlot: localHit.materialSlot,
    source: localHit.source,
  };
}

function sortSpatialHits(
  hits: readonly SpatialRaycastHit[],
): readonly SpatialRaycastHit[] {
  return [...hits].sort(
    (a, b) =>
      a.distance - b.distance || a.entity.ref.index - b.entity.ref.index,
  );
}

function spatialEntryMatches(
  entry: {
    readonly layerMask?: number;
    readonly visible?: boolean;
    readonly pickable?: SpatialPickableState;
  },
  entity: Entity,
  options: SpatialRaycastOptions,
  sourceKind: "bounds" | "mesh",
): boolean {
  if (entry.visible === false || options.filter?.(entity) === false) {
    return false;
  }

  if (entry.pickable?.enabled === false) {
    return false;
  }

  if (
    sourceKind === "mesh" &&
    entry.pickable?.precision !== undefined &&
    entry.pickable.precision !== "visual-mesh"
  ) {
    return false;
  }

  return (
    spatialLayerMatches(entry.layerMask, options.layerMask) &&
    (entry.pickable?.layerMask === undefined ||
      spatialLayerMatches(entry.pickable.layerMask, options.layerMask))
  );
}

function spatialLayerMatches(
  objectLayerMask: number | undefined,
  queryLayerMask: number | undefined,
): boolean {
  return (
    (((objectLayerMask ?? 0x00000001) >>> 0) &
      ((queryLayerMask ?? 0xffffffff) >>> 0)) !==
    0
  );
}

function entityRef(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function tuple3(values: ArrayLike<number>): [number, number, number] {
  return [values[0]!, values[1]!, values[2]!];
}

function tuple2(values: Vec2Like): [number, number] {
  return [values[0]!, values[1]!];
}

function normalizeTuple3(values: ArrayLike<number>): [number, number, number] {
  const x = values[0]!;
  const y = values[1]!;
  const z = values[2]!;
  const length = Math.hypot(x, y, z);

  if (!Number.isFinite(length) || length <= 1e-8) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

function distanceBetween(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}
