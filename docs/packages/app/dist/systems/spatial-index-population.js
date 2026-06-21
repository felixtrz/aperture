import { Mesh, MeshQueryAcceleration, MeshQueryAccelerationMode, Pickable, RenderLayer, Visibility, createSpatialTriangleMeshFromMeshAsset, } from "@aperture-engine/render";
import { Enabled, WorldTransform, createMeshBvhCache, createMeshHandle, identityMat4, invertMat4, transformAabb, } from "@aperture-engine/simulation";
export function createSpatialIndexPopulationState() {
    return {
        bvhCache: createMeshBvhCache(),
        entries: new Map(),
        meshAssets: new Map(),
    };
}
export function populateSpatialIndexFromWorld(context, state = createSpatialIndexPopulationState()) {
    const query = context.world.queryManager.registerQuery({
        required: [Mesh, WorldTransform],
    });
    const bounds = [];
    const meshes = [];
    const bvhReports = [];
    const diagnostics = [];
    const liveMeshKeys = new Set();
    const liveEntityKeys = new Set();
    const liveMeshAssetKeys = new Set();
    for (const entity of [...query.entities].sort(compareEntities)) {
        const entityKey = spatialEntityKey(entity);
        liveEntityKeys.add(entityKey);
        const entry = spatialEntryFromEntity(context, state, entity, entityKey, diagnostics, liveMeshAssetKeys);
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
function spatialEntryFromEntity(context, state, entity, entityKey, diagnostics, liveMeshAssetKeys) {
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
    const meshEntry = context.assetsRegistry.get(meshHandle);
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
    if (cached !== undefined &&
        cached.entityVersion === entityVersion &&
        cached.meshId === meshId &&
        cached.meshVersion === meshEntry.version) {
        if (cached.transformVersion === transformVersion) {
            return {
                ...cached,
                bvhReport: reusableBvhReport(cached.bvhReport),
            };
        }
        const refreshed = refreshCachedSpatialEntry(cached, entity, transformVersion, diagnostics);
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
    const meshAsset = cachedSpatialMeshAsset(state, meshId, meshAssetKey, meshEntry.version, meshEntry.asset);
    if (meshAsset.mesh === null || meshAsset.localAabb === null) {
        for (const adapterDiagnostic of meshAsset.diagnostics) {
            diagnostics.push(diagnostic(entity, adapterDiagnostic.code, adapterDiagnostic.severity));
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
    const bvhReport = bvhReportForEntity(state, entity, meshAsset.mesh, meshId, meshEntry.version);
    const worldAabb = transformAabb(meshAsset.localAabb, worldFromMesh);
    const entry = {
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
function entityIsSpatiallyQueryable(entity) {
    if (entity.hasComponent(Enabled) &&
        entity.getValue(Enabled, "value") === false) {
        return false;
    }
    if (entity.hasComponent(Visibility) &&
        entity.getValue(Visibility, "visible") === false) {
        return false;
    }
    return (!entity.hasComponent(Pickable) ||
        entity.getValue(Pickable, "enabled") !== false);
}
function bvhReportForEntity(state, entity, mesh, meshKey, version) {
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
function cachedSpatialMeshAsset(state, meshId, meshAssetKey, version, asset) {
    const cached = state.meshAssets.get(meshAssetKey);
    if (cached !== undefined &&
        cached.meshId === meshId &&
        cached.version === version) {
        return cached;
    }
    const adapterReport = createSpatialTriangleMeshFromMeshAsset(asset);
    const localAabb = adapterReport.mesh === null ? null : localAabbForMesh(adapterReport.mesh);
    const diagnostics = adapterReport.mesh !== null && localAabb === null
        ? [
            ...adapterReport.diagnostics,
            { code: "spatial.mesh.empty", severity: "error" },
        ]
        : adapterReport.diagnostics;
    const entry = {
        meshId,
        version,
        mesh: adapterReport.mesh,
        localAabb,
        diagnostics,
    };
    state.meshAssets.set(meshAssetKey, entry);
    return entry;
}
function refreshCachedSpatialEntry(cached, entity, transformVersion, diagnostics) {
    const worldFromMesh = readWorldMatrix(entity);
    const meshFromWorld = invertMat4(worldFromMesh);
    if (meshFromWorld === null) {
        diagnostics.push(diagnostic(entity, "spatial.mesh.nonInvertibleTransform"));
        return null;
    }
    const worldAabb = transformAabb(cached.localAabb, worldFromMesh);
    const bounds = {
        ...cached.bounds,
        worldAabb,
    };
    const mesh = {
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
function reusableBvhReport(report) {
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
function pruneSpatialEntryCache(entries, liveEntityKeys) {
    for (const key of entries.keys()) {
        if (!liveEntityKeys.has(key)) {
            entries.delete(key);
        }
    }
}
function pruneSpatialMeshAssetCache(entries, liveMeshAssetKeys) {
    for (const key of entries.keys()) {
        if (!liveMeshAssetKeys.has(key)) {
            entries.delete(key);
        }
    }
}
function accelerationStrategy(entity) {
    const value = entity.hasComponent(MeshQueryAcceleration)
        ? entity.getValue(MeshQueryAcceleration, "strategy")
        : undefined;
    return value === "average" || value === "sah" ? value : "center";
}
function dynamicPolicy(entity) {
    const value = entity.hasComponent(MeshQueryAcceleration)
        ? entity.getValue(MeshQueryAcceleration, "dynamicPolicy")
        : undefined;
    return value === "refit" || value === "rebuild" ? value : "static";
}
function localAabbForMesh(mesh) {
    if (mesh.vertexCount <= 0) {
        return null;
    }
    const min = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
    ];
    const max = [
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
    ];
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
function pickableState(entity) {
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
function pickablePrecision(entity) {
    const value = entity.getValue(Pickable, "precision");
    return value === "visual-mesh" || value === "collider" ? value : "bounds";
}
function layerMaskForEntity(entity) {
    return entity.hasComponent(RenderLayer)
        ? (entity.getValue(RenderLayer, "mask") ?? 1)
        : 1;
}
function readWorldMatrix(entity) {
    const matrix = identityMat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
function spatialEntityKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
function parseMeshHandle(value) {
    const prefix = "mesh:";
    return value.startsWith(prefix) && value.length > prefix.length
        ? createMeshHandle(value.slice(prefix.length))
        : null;
}
function diagnostic(entity, code, severity = "error") {
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
function compareEntities(left, right) {
    return left.index - right.index || left.generation - right.generation;
}
function readArrayLike(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric mesh value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=spatial-index-population.js.map