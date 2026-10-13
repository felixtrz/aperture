import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { entityRef, tuple3 } from "./math.js";
export function raycastColliderHit(colliderQueries, ray, options) {
    return raycastColliderHits(colliderQueries, ray, options)[0] ?? null;
}
export function raycastColliderHits(colliderQueries, ray, options) {
    const backend = colliderQueries?.getPhysicsBackend() ?? null;
    if (colliderQueries === undefined || backend === null) {
        return [];
    }
    const queryEntities = options.query?.entities;
    const hits = [];
    for (const hit of backend.raycastAll({
        origin: tuple3(ray.origin),
        direction: tuple3(ray.direction),
        ...(options.maxDistance === undefined
            ? {}
            : { maxDistance: options.maxDistance }),
    }, physicsQueryOptions(options))) {
        const entity = entityFromPhysicsHit(colliderQueries.world, hit);
        if (entity === null) {
            continue;
        }
        if (queryEntities !== undefined && !queryEntities.has(entity)) {
            continue;
        }
        if (options.filter?.(entity) === false) {
            continue;
        }
        hits.push(spatialHitFromPhysicsHit(entity, hit));
    }
    return hits.sort(compareSpatialColliderHits);
}
function entityFromPhysicsHit(world, hit) {
    const ref = parsePhysicsEntityRef(hit.entity);
    if (ref === null) {
        return null;
    }
    const resolved = resolveActiveEntity(world, ref);
    return resolved.ok ? resolved.entity : null;
}
function spatialHitFromPhysicsHit(entity, hit) {
    return {
        entity: {
            entity,
            ref: entityRef(entity),
        },
        distance: hit.distance,
        point: tuple3(hit.point),
        normal: tuple3(hit.normal),
        source: "collider",
    };
}
function physicsQueryOptions(options) {
    return {
        ...(options.layerMask === undefined
            ? {}
            : { collisionGroups: options.layerMask }),
        ...(options.includeSensors === undefined
            ? {}
            : { includeSensors: options.includeSensors }),
    };
}
function parsePhysicsEntityRef(ref) {
    const separator = ref.indexOf(":");
    if (separator <= 0 || separator !== ref.lastIndexOf(":")) {
        return null;
    }
    const index = Number.parseInt(ref.slice(0, separator), 10);
    const generation = Number.parseInt(ref.slice(separator + 1), 10);
    if (!Number.isInteger(index) || !Number.isInteger(generation)) {
        return null;
    }
    return { index, generation };
}
function compareSpatialColliderHits(a, b) {
    return (a.distance - b.distance ||
        a.entity.ref.index - b.entity.ref.index ||
        a.entity.ref.generation - b.entity.ref.generation);
}
//# sourceMappingURL=collider.js.map