import RAPIER from "@dimforge/rapier3d-compat";
import { colliderLocalPointToWorld, colliderLocalVectorToWorld, distanceVec3, normalizeVec3, quat, subtractVec3, vec, vec3, } from "./math.js";
import { queryShape, queryShapeRotation } from "./shapes.js";
export function queryFilterFlags(options) {
    return options.includeSensors === true
        ? undefined
        : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
}
export function queryFilterGroups(options) {
    return options.collisionGroups;
}
export function castShapeFirstByCollider(bodies, shape, cast, options) {
    const rapierShape = queryShape(shape);
    const shapeRotation = queryShapeRotation(cast.from.rotation, shape);
    const shapeVelocity = subtractVec3(cast.to.translation, cast.from.translation);
    const hits = [];
    for (const entry of bodies.values()) {
        for (const colliderEntry of entry.colliders) {
            if (!queryAllowsCollider(entry, colliderEntry, options)) {
                continue;
            }
            const hit = colliderEntry.collider.castShape(vec([0, 0, 0]), rapierShape, vec(cast.from.translation), quat(shapeRotation), vec(shapeVelocity), 0, 1, true);
            if (hit === null) {
                continue;
            }
            hits.push({
                entity: entry.entity,
                collider: colliderEntry.entity,
                timeOfImpact: hit.time_of_impact,
                point: colliderLocalPointToWorld(colliderEntry.collider, hit.witness1),
                normal: normalizeVec3(colliderLocalVectorToWorld(colliderEntry.collider, hit.normal1)),
            });
        }
    }
    return (hits.sort((left, right) => left.timeOfImpact - right.timeOfImpact ||
        left.entity.localeCompare(right.entity) ||
        (left.collider ?? "").localeCompare(right.collider ?? ""))[0] ?? null);
}
export function projectPointByCollider(bodies, point, options) {
    const projections = [];
    for (const entry of bodies.values()) {
        for (const colliderEntry of entry.colliders) {
            if (!queryAllowsCollider(entry, colliderEntry, options)) {
                continue;
            }
            const projection = colliderEntry.collider.projectPoint(vec(point), false);
            if (projection === null) {
                continue;
            }
            const projectedPoint = vec3(projection.point);
            projections.push({
                entity: entry.entity,
                collider: colliderEntry.entity,
                point: projectedPoint,
                normal: normalizeVec3(subtractVec3(point, projectedPoint)),
                distance: distanceVec3(point, projectedPoint),
                inside: projection.isInside,
            });
        }
    }
    return (projections.sort((left, right) => left.distance - right.distance ||
        left.entity.localeCompare(right.entity) ||
        (left.collider ?? "").localeCompare(right.collider ?? ""))[0] ?? null);
}
export function queryAllowsCollider(entry, colliderEntry, options) {
    const collider = colliderEntry.collider;
    if (entry.entity === options.excludeEntity ||
        colliderEntry.entity === options.excludeEntity) {
        return false;
    }
    if (collider.isSensor() && options.includeSensors !== true) {
        return false;
    }
    if (options.collisionGroups !== undefined &&
        !interactionGroupsCompatible(options.collisionGroups, collider.collisionGroups())) {
        return false;
    }
    return true;
}
function interactionGroupsCompatible(query, collider) {
    return ((query >>> 16) & collider) !== 0 && ((collider >>> 16) & query) !== 0;
}
//# sourceMappingURL=queries.js.map