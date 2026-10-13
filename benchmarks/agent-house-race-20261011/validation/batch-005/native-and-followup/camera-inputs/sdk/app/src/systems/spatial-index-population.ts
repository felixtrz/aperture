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
  readonly entries: Map<string, CachedSpatialEntry>;
  readonly meshAssets: Map<string, CachedSpatialMeshAsset>;
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
    entries: new Map(),
    meshAssets: new Map(),
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
  const liveMeshKeys = new Set<string>();
  const liveEntityKeys = new Set<string>();
  const liveMeshAssetKeys = new Set<string>();

  for (const entity of [...query.entities].sort(compareEntities)) {
    const entityKey = spatialEntityKey(entity);

    liveEntityKeys.add(entityKey);

    const entry = spatialEntryFromEntity(
      context,
      state,
      entity,
      entityKey,
      diagnostics,
      liveMeshAssetKeys,
    );

    if (entry === null) {
      continue;
    }

    bounds.push(entry.bounds);
    meshes.push(entry.mesh);

    if (entry.bvhReport !== null) {
      bvhReports.push(entry.bvhReport);
      liveMeshKeys.add(entry.meshKey);
    }
  }

  pruneSpatialEntryCache(state.entries, liveEntityKeys);
  pruneSpatialMeshAssetCache(state.meshAssets, liveMeshAssetKeys);
  // Reclaim BVH cache entries for meshes that are no longer indexed this pass
  // (despawned entities, removed mesh assets) so the cache does not leak.
  state.bvhCache.prune(liveMeshKeys);

  context.spatial.setBounds(bounds);
  context.spatial.setMeshes(meshes);

  return { bounds, meshes, bvhReports, diagnostics };
}

function spatialEntryFromEntity(
  context: SpatialIndexPopulationContext,
  state: SpatialIndexPopulationState,
  entity: Entity,
  entityKey: string,
  diagnostics: SpatialIndexPopulationDiagnostic[],
  liveMeshAssetKeys: Set<string>,
): {
  readonly bounds: SpatialRaycastableBounds;
  readonly mesh: SpatialRaycastableMesh;
  readonly bvhReport: MeshBvhCacheReport | null;
  readonly meshKey: string;
} | null {
  if (!entityIsSpatiallyQueryable(entity)) {
    state.entries.delete(entityKey);
    return null;
  }

  const meshId = entity.getValue(Mesh, "meshId") ?? "";
  const meshHandle = parseMeshHandle(meshId);

  if (meshHandle === null) {
    state.entries.delete(entityKey);
    diagnostics.push(diagnostic(entity, "spatial.mesh.missingHandle"));
    return null;
  }

  const meshEntry = context.assetsRegistry.get<"mesh", MeshAsset>(meshHandle);

  if (meshEntry?.status !== "ready" || meshEntry.asset === null) {
    state.entries.delete(entityKey);
    diagnostics.push(diagnostic(entity, "spatial.mesh.notReady"));
    return null;
  }

  const meshAssetKey = `${meshId}:${meshEntry.version}`;
  const entityVersion = context.world.entityVersion(entity);
  const transformVersion = context.world.entityTransformVersion(entity);
  const cached = state.entries.get(entityKey);

  liveMeshAssetKeys.add(meshAssetKey);

  if (
    cached !== undefined &&
    cached.entityVersion === entityVersion &&
    cached.meshId === meshId &&
    cached.meshVersion === meshEntry.version
  ) {
    if (cached.transformVersion === transformVersion) {
      return {
        ...cached,
        bvhReport: reusableBvhReport(cached.bvhReport),
      };
    }

    const refreshed = refreshCachedSpatialEntry(
      cached,
      entity,
      transformVersion,
      diagnostics,
    );

    if (refreshed === null) {
      state.entries.delete(entityKey);
      return null;
    }

    state.entries.set(entityKey, refreshed);
    return {
      ...refreshed,
      bvhReport: reusableBvhReport(refreshed.bvhReport),
    };
  }

  state.entries.delete(entityKey);

  const meshAsset = cachedSpatialMeshAsset(
    state,
    meshId,
    meshAssetKey,
    meshEntry.version,
    meshEntry.asset,
  );

  if (meshAsset.mesh === null || meshAsset.localAabb === null) {
    for (const adapterDiagnostic of meshAsset.diagnostics) {
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

  const pickable = pickableState(entity);
  const layerMask = layerMaskForEntity(entity);
  const bvhReport = bvhReportForEntity(
    state,
    entity,
    meshAsset.mesh,
    meshId,
    meshEntry.version,
  );
  const worldAabb = transformAabb(meshAsset.localAabb, worldFromMesh);
  const entry: CachedSpatialEntry = {
    entityVersion,
    transformVersion,
    meshId,
    meshVersion: meshEntry.version,
    localAabb: meshAsset.localAabb,
    bounds: {
      entity,
      worldAabb,
      layerMask,
      ...(pickable === undefined ? {} : { pickable }),
    },
    mesh: {
      entity,
      mesh: meshAsset.mesh,
      ...(bvhReport?.bvh === null || bvhReport === null
        ? {}
        : { bvh: bvhReport.bvh }),
      worldFromMesh,
      meshFromWorld,
      layerMask,
      ...(pickable === undefined ? {} : { pickable }),
    },
    bvhReport,
    meshKey: meshId,
  };

  state.entries.set(entityKey, entry);
  return entry;
}

interface CachedSpatialEntry {
  readonly entityVersion: number;
  readonly transformVersion: number;
  readonly meshId: string;
  readonly meshVersion: number;
  readonly localAabb: {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
  };
  readonly bounds: SpatialRaycastableBounds;
  readonly mesh: SpatialRaycastableMesh;
  readonly bvhReport: MeshBvhCacheReport | null;
  readonly meshKey: string;
}

interface CachedSpatialMeshAsset {
  readonly meshId: string;
  readonly version: number;
  readonly mesh: SpatialTriangleMesh | null;
  readonly localAabb: {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
  } | null;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "warning" | "error";
  }[];
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

function cachedSpatialMeshAsset(
  state: SpatialIndexPopulationState,
  meshId: string,
  meshAssetKey: string,
  version: number,
  asset: MeshAsset,
): CachedSpatialMeshAsset {
  const cached = state.meshAssets.get(meshAssetKey);

  if (
    cached !== undefined &&
    cached.meshId === meshId &&
    cached.version === version
  ) {
    return cached;
  }

  const adapterReport = createSpatialTriangleMeshFromMeshAsset(asset);
  const localAabb =
    adapterReport.mesh === null ? null : localAabbForMesh(adapterReport.mesh);
  const diagnostics =
    adapterReport.mesh !== null && localAabb === null
      ? [
          ...adapterReport.diagnostics,
          { code: "spatial.mesh.empty", severity: "error" as const },
        ]
      : adapterReport.diagnostics;
  const entry: CachedSpatialMeshAsset = {
    meshId,
    version,
    mesh: adapterReport.mesh,
    localAabb,
    diagnostics,
  };

  state.meshAssets.set(meshAssetKey, entry);
  return entry;
}

function refreshCachedSpatialEntry(
  cached: CachedSpatialEntry,
  entity: Entity,
  transformVersion: number,
  diagnostics: SpatialIndexPopulationDiagnostic[],
): CachedSpatialEntry | null {
  const worldFromMesh = readWorldMatrix(entity);
  const meshFromWorld = invertMat4(worldFromMesh);

  if (meshFromWorld === null) {
    diagnostics.push(diagnostic(entity, "spatial.mesh.nonInvertibleTransform"));
    return null;
  }

  const worldAabb = transformAabb(cached.localAabb, worldFromMesh);
  const bounds: SpatialRaycastableBounds = {
    ...cached.bounds,
    worldAabb,
  };
  const mesh: SpatialRaycastableMesh = {
    ...cached.mesh,
    worldFromMesh,
    meshFromWorld,
  };

  return {
    ...cached,
    transformVersion,
    bounds,
    mesh,
  };
}

function reusableBvhReport(
  report: MeshBvhCacheReport | null,
): MeshBvhCacheReport | null {
  if (report === null) {
    return null;
  }

  return {
    ...report,
    reused: report.bvh !== null,
    refit: false,
    built: false,
    buildTimeMs: 0,
  };
}

function pruneSpatialEntryCache(
  entries: Map<string, CachedSpatialEntry>,
  liveEntityKeys: ReadonlySet<string>,
): void {
  for (const key of entries.keys()) {
    if (!liveEntityKeys.has(key)) {
      entries.delete(key);
    }
  }
}

function pruneSpatialMeshAssetCache(
  entries: Map<string, CachedSpatialMeshAsset>,
  liveMeshAssetKeys: ReadonlySet<string>,
): void {
  for (const key of entries.keys()) {
    if (!liveMeshAssetKeys.has(key)) {
      entries.delete(key);
    }
  }
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

function spatialEntityKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
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
