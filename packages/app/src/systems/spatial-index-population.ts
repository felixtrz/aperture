import {
  Mesh,
  MeshQueryAcceleration,
  MeshQueryAccelerationMode,
  Pickable,
  RenderLayer,
  Visibility,
  createSpatialTriangleMeshFromMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  Enabled,
  WorldTransform,
  createMeshBvhCache,
  createMeshHandle,
  identityMat4,
  invertMat4,
  transformAabb,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type Mat4,
  type MeshBvhBuildStrategy,
  type MeshBvhCache,
  type MeshBvhCacheReport,
  type MeshBvhDynamicPolicy,
  type SpatialTriangleMesh,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type {
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "../spatial/index.js";

export interface SpatialIndexPopulationContext {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly spatial: SpatialQueries;
}

export interface SpatialIndexPopulationState {
  readonly bvhCache: MeshBvhCache;
}

export interface SpatialIndexPopulationDiagnostic {
  readonly code: string;
  readonly entity: {
    readonly index: number;
    readonly generation: number;
  };
  readonly message: string;
  readonly severity: "warning" | "error";
}

export interface SpatialIndexPopulationReport {
  readonly bounds: readonly SpatialRaycastableBounds[];
  readonly meshes: readonly SpatialRaycastableMesh[];
  readonly bvhReports: readonly MeshBvhCacheReport[];
  readonly diagnostics: readonly SpatialIndexPopulationDiagnostic[];
}

export function createSpatialIndexPopulationState(): SpatialIndexPopulationState {
  return {
    bvhCache: createMeshBvhCache(),
  };
}

export function populateSpatialIndexFromWorld(
  context: SpatialIndexPopulationContext,
  state: SpatialIndexPopulationState = createSpatialIndexPopulationState(),
): SpatialIndexPopulationReport {
  const query = context.world.queryManager.registerQuery({
    required: [Mesh, WorldTransform],
  });
  const bounds: SpatialRaycastableBounds[] = [];
  const meshes: SpatialRaycastableMesh[] = [];
  const bvhReports: MeshBvhCacheReport[] = [];
  const diagnostics: SpatialIndexPopulationDiagnostic[] = [];

  for (const entity of [...query.entities].sort(compareEntities)) {
    const entry = spatialEntryFromEntity(context, state, entity, diagnostics);

    if (entry === null) {
      continue;
    }

    bounds.push(entry.bounds);
    meshes.push(entry.mesh);

    if (entry.bvhReport !== null) {
      bvhReports.push(entry.bvhReport);
    }
  }

  context.spatial.setBounds(bounds);
  context.spatial.setMeshes(meshes);

  return { bounds, meshes, bvhReports, diagnostics };
}

function spatialEntryFromEntity(
  context: SpatialIndexPopulationContext,
  state: SpatialIndexPopulationState,
  entity: Entity,
  diagnostics: SpatialIndexPopulationDiagnostic[],
): {
  readonly bounds: SpatialRaycastableBounds;
  readonly mesh: SpatialRaycastableMesh;
  readonly bvhReport: MeshBvhCacheReport | null;
} | null {
  if (!entityIsSpatiallyQueryable(entity)) {
    return null;
  }

  const meshId = entity.getValue(Mesh, "meshId") ?? "";
  const meshHandle = parseMeshHandle(meshId);

  if (meshHandle === null) {
    diagnostics.push(diagnostic(entity, "spatial.mesh.missingHandle"));
    return null;
  }

  const meshEntry = context.assetsRegistry.get<"mesh", MeshAsset>(meshHandle);

  if (meshEntry?.status !== "ready" || meshEntry.asset === null) {
    diagnostics.push(diagnostic(entity, "spatial.mesh.notReady"));
    return null;
  }

  const adapterReport = createSpatialTriangleMeshFromMeshAsset(meshEntry.asset);

  if (adapterReport.mesh === null) {
    for (const adapterDiagnostic of adapterReport.diagnostics) {
      diagnostics.push(
        diagnostic(entity, adapterDiagnostic.code, adapterDiagnostic.severity),
      );
    }
    return null;
  }

  const worldFromMesh = readWorldMatrix(entity);
  const meshFromWorld = invertMat4(worldFromMesh);

  if (meshFromWorld === null) {
    diagnostics.push(diagnostic(entity, "spatial.mesh.nonInvertibleTransform"));
    return null;
  }

  const localAabb = localAabbForMesh(adapterReport.mesh);

  if (localAabb === null) {
    diagnostics.push(diagnostic(entity, "spatial.mesh.empty"));
    return null;
  }

  const pickable = pickableState(entity);
  const layerMask = layerMaskForEntity(entity);
  const bvhReport = bvhReportForEntity(
    state,
    entity,
    adapterReport.mesh,
    meshId,
    meshEntry.version,
  );
  const worldAabb = transformAabb(localAabb, worldFromMesh);

  return {
    bounds: {
      entity,
      worldAabb,
      layerMask,
      ...(pickable === undefined ? {} : { pickable }),
    },
    mesh: {
      entity,
      mesh: adapterReport.mesh,
      ...(bvhReport?.bvh === null || bvhReport === null
        ? {}
        : { bvh: bvhReport.bvh }),
      worldFromMesh,
      meshFromWorld,
      layerMask,
      ...(pickable === undefined ? {} : { pickable }),
    },
    bvhReport,
  };
}

function entityIsSpatiallyQueryable(entity: Entity): boolean {
  if (
    entity.hasComponent(Enabled) &&
    entity.getValue(Enabled, "value") === false
  ) {
    return false;
  }

  if (
    entity.hasComponent(Visibility) &&
    entity.getValue(Visibility, "visible") === false
  ) {
    return false;
  }

  return (
    !entity.hasComponent(Pickable) ||
    entity.getValue(Pickable, "enabled") !== false
  );
}

function bvhReportForEntity(
  state: SpatialIndexPopulationState,
  entity: Entity,
  mesh: SpatialTriangleMesh,
  meshKey: string,
  version: number,
): MeshBvhCacheReport | null {
  const mode = entity.hasComponent(MeshQueryAcceleration)
    ? entity.getValue(MeshQueryAcceleration, "mode")
    : MeshQueryAccelerationMode.AutoBvh;

  if (mode === MeshQueryAccelerationMode.None) {
    return null;
  }

  return state.bvhCache.getOrBuild({
    meshKey,
    version,
    mesh,
    options: {
      strategy: accelerationStrategy(entity),
      maxLeafSize: entity.hasComponent(MeshQueryAcceleration)
        ? (entity.getValue(MeshQueryAcceleration, "maxLeafSize") ?? 8)
        : 8,
      maxDepth: entity.hasComponent(MeshQueryAcceleration)
        ? (entity.getValue(MeshQueryAcceleration, "maxDepth") ?? 40)
        : 40,
    },
    dynamicPolicy: dynamicPolicy(entity),
  });
}

function accelerationStrategy(entity: Entity): MeshBvhBuildStrategy {
  const value = entity.hasComponent(MeshQueryAcceleration)
    ? entity.getValue(MeshQueryAcceleration, "strategy")
    : undefined;

  return value === "average" || value === "sah" ? value : "center";
}

function dynamicPolicy(entity: Entity): MeshBvhDynamicPolicy {
  const value = entity.hasComponent(MeshQueryAcceleration)
    ? entity.getValue(MeshQueryAcceleration, "dynamicPolicy")
    : undefined;

  return value === "refit" || value === "rebuild" ? value : "static";
}

function localAabbForMesh(mesh: SpatialTriangleMesh): {
  readonly min: Vec3Like;
  readonly max: Vec3Like;
} | null {
  if (mesh.vertexCount <= 0) {
    return null;
  }

  const min = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ] as [number, number, number];
  const max = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ] as [number, number, number];
  const offset = mesh.positions.offset ?? 0;

  for (let index = 0; index < mesh.vertexCount; index += 1) {
    const base = offset + index * mesh.positions.stride;
    const x = readArrayLike(mesh.positions.data, base);
    const y = readArrayLike(mesh.positions.data, base + 1);
    const z = readArrayLike(mesh.positions.data, base + 2);

    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }

  return { min, max };
}

function pickableState(entity: Entity): SpatialPickableState | undefined {
  if (!entity.hasComponent(Pickable)) {
    return undefined;
  }

  return {
    enabled: entity.getValue(Pickable, "enabled") ?? true,
    layerMask: entity.getValue(Pickable, "layerMask") ?? 1,
    precision: pickablePrecision(entity),
    blocksLower: entity.getValue(Pickable, "blocksLower") ?? false,
    priority: entity.getValue(Pickable, "priority") ?? 0,
  };
}

function pickablePrecision(
  entity: Entity,
): NonNullable<SpatialPickableState["precision"]> {
  const value = entity.getValue(Pickable, "precision");

  return value === "visual-mesh" || value === "collider" ? value : "bounds";
}

function layerMaskForEntity(entity: Entity): number {
  return entity.hasComponent(RenderLayer)
    ? (entity.getValue(RenderLayer, "mask") ?? 1)
    : 1;
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();

  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

function parseMeshHandle(value: string) {
  const prefix = "mesh:";
  return value.startsWith(prefix) && value.length > prefix.length
    ? createMeshHandle(value.slice(prefix.length))
    : null;
}

function diagnostic(
  entity: Entity,
  code: string,
  severity: "warning" | "error" = "error",
): SpatialIndexPopulationDiagnostic {
  return {
    code,
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
    severity,
    message: `Spatial index population skipped entity ${entity.index}:${entity.generation} for ${code}.`,
  };
}

function compareEntities(left: Entity, right: Entity): number {
  return left.index - right.index || left.generation - right.generation;
}

function readArrayLike(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric mesh value at index ${index}.`);
  }

  return value;
}
