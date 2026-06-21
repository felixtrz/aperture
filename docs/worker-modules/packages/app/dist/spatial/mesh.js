import { invertMat4, raycastFirstMeshTriangle, raycastMeshTriangles, transformPoint, transformVector, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { spatialEntryMatches } from "./filters.js";
import { distanceBetween, entityRef, normalizeTuple3, tuple2, tuple3, } from "./math.js";
export function raycastMeshHit(meshes, ray, options) {
    const queryEntities = options.query?.entities;
    let closest = null;
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
        const localHit = entry.bvh === undefined
            ? raycastFirstMeshTriangle(entry.mesh, localRay, meshRaycastOptions(options, transforms.meshFromWorld !== undefined))
            : entry.bvh.raycastFirst(localRay, meshRaycastOptions(options, transforms.meshFromWorld !== undefined));
        if (localHit === null) {
            continue;
        }
        const hit = spatialHitFromMeshHit(entry, ray, localHit, transforms);
        if (options.maxDistance !== undefined &&
            hit.distance > options.maxDistance) {
            continue;
        }
        if (closest === null ||
            hit.distance < closest.distance ||
            (hit.distance === closest.distance &&
                hit.entity.ref.index < closest.entity.ref.index)) {
            closest = hit;
        }
    }
    return { hit: closest, queryableMeshCount };
}
export function raycastMeshHits(meshes, ray, options) {
    const queryEntities = options.query?.entities;
    const hits = [];
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
        const localHits = entry.bvh === undefined
            ? raycastMeshTriangles(entry.mesh, localRay, meshRaycastOptions(options, transforms.meshFromWorld !== undefined))
            : entry.bvh.raycast(localRay, meshRaycastOptions(options, transforms.meshFromWorld !== undefined));
        for (const localHit of localHits) {
            const hit = spatialHitFromMeshHit(entry, ray, localHit, transforms);
            if (options.maxDistance !== undefined &&
                hit.distance > options.maxDistance) {
                continue;
            }
            hits.push(hit);
        }
    }
    return { hits: sortSpatialHits(hits), queryableMeshCount };
}
export function meshQueryTransforms(entry) {
    const meshFromWorld = entry.meshFromWorld ??
        (entry.worldFromMesh === undefined
            ? undefined
            : invertMat4(entry.worldFromMesh));
    const worldFromMesh = entry.worldFromMesh ??
        (entry.meshFromWorld === undefined
            ? undefined
            : invertMat4(entry.meshFromWorld));
    if ((entry.worldFromMesh !== undefined || entry.meshFromWorld !== undefined) &&
        (meshFromWorld === null || worldFromMesh === null)) {
        return null;
    }
    return {
        ...(meshFromWorld == null ? {} : { meshFromWorld }),
        ...(worldFromMesh == null ? {} : { worldFromMesh }),
    };
}
function localRayForEntry(ray, meshFromWorld) {
    return meshFromWorld === undefined
        ? ray
        : {
            origin: transformPoint(meshFromWorld, ray.origin),
            direction: transformVector(meshFromWorld, ray.direction),
        };
}
function meshRaycastOptions(options, hasMeshTransform) {
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
function spatialHitFromMeshHit(entry, ray, localHit, transforms) {
    const worldPoint = transforms.worldFromMesh === undefined
        ? localHit.point
        : transformPoint(transforms.worldFromMesh, localHit.point);
    const worldNormal = transforms.worldFromMesh === undefined
        ? localHit.normal
        : normalizeTuple3(transformVector(transforms.worldFromMesh, localHit.normal));
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
function sortSpatialHits(hits) {
    return [...hits].sort((a, b) => a.distance - b.distance || a.entity.ref.index - b.entity.ref.index);
}
//# sourceMappingURL=mesh.js.map