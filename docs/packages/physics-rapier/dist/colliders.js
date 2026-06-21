import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsMaterialCombineRule, } from "@aperture-engine/physics";
import { quat, vec } from "./math.js";
import { colliderShapeRotation } from "./shapes.js";
export class RapierColliderSyncError extends Error {
    feature;
    constructor(feature) {
        super(feature.message);
        this.name = "RapierColliderSyncError";
        this.feature = feature;
    }
}
export function isRapierColliderSyncError(error) {
    return error instanceof RapierColliderSyncError;
}
export function colliderDesc(collider, options = {}) {
    const shape = collider.shape;
    let desc;
    switch (shape.kind) {
        case "box":
            desc = RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
            break;
        case "sphere":
            desc = RAPIER.ColliderDesc.ball(shape.radius);
            break;
        case "capsule":
            desc = RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
            break;
        case "cylinder":
            desc = RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius);
            break;
        case "cone":
            desc = RAPIER.ColliderDesc.cone(shape.halfHeight, shape.radius);
            break;
        case "convexHull":
            {
                const geometry = requireTriangleMeshGeometry(collider, options);
                const convexHull = RAPIER.ColliderDesc.convexHull(geometry.positions);
                if (convexHull === null) {
                    throw new RapierColliderSyncError(colliderFeature(collider, {
                        code: "physics.collider.cooking.failed",
                        feature: "collider.convexHull",
                        message: `Rapier could not cook convex hull collider geometry '${geometry.key}'.`,
                        suggestedFix: "Use a non-empty, non-degenerate mesh with enough unique 3D points for convex hull cooking.",
                        details: {
                            geometryKey: geometry.key,
                            vertexCount: geometry.vertexCount,
                            triangleCount: geometry.triangleCount,
                        },
                    }));
                }
                desc = convexHull;
            }
            break;
        case "trimesh":
            {
                const geometry = requireTriangleMeshGeometry(collider, options);
                desc = RAPIER.ColliderDesc.trimesh(geometry.positions, geometry.indices, rapierTrimeshFlags());
            }
            break;
        case "heightfield":
            {
                const geometry = requireHeightfieldGeometry(collider, options);
                desc = RAPIER.ColliderDesc.heightfield(geometry.rows - 1, geometry.columns - 1, geometry.heights, vec(geometry.scale), RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES);
            }
            break;
    }
    if (collider.offsetTranslation !== undefined) {
        desc.setTranslation(...collider.offsetTranslation);
    }
    const rotation = colliderShapeRotation(collider);
    if (rotation !== null) {
        desc.setRotation(quat(rotation));
    }
    if (collider.sensor !== undefined) {
        desc.setSensor(collider.sensor);
    }
    if (collider.density !== undefined) {
        desc.setDensity(collider.density);
    }
    if (collider.friction !== undefined) {
        desc.setFriction(collider.friction);
    }
    if (collider.restitution !== undefined) {
        desc.setRestitution(collider.restitution);
    }
    if (collider.frictionCombine !== undefined) {
        desc.setFrictionCombineRule(coefficientCombineRule(collider.frictionCombine));
    }
    if (collider.restitutionCombine !== undefined) {
        desc.setRestitutionCombineRule(coefficientCombineRule(collider.restitutionCombine));
    }
    if (collider.collisionGroups !== undefined) {
        desc.setCollisionGroups(collider.collisionGroups);
    }
    if (collider.solverGroups !== undefined) {
        desc.setSolverGroups(collider.solverGroups);
    }
    desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS |
        RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    desc.setContactForceEventThreshold(0);
    return desc;
}
function requireTriangleMeshGeometry(collider, options) {
    const shape = collider.shape;
    if (shape.kind !== "convexHull" && shape.kind !== "trimesh") {
        throw new Error(`Expected mesh-backed collider, received '${shape.kind}'.`);
    }
    const result = options.colliderGeometryProvider?.triangleMesh(shape.meshId);
    if (result === undefined) {
        throw new RapierColliderSyncError(colliderFeature(collider, {
            code: "physics.collider.assetShape.unsupported",
            feature: `collider.${shape.kind}`,
            message: `Collider shape '${shape.kind}' is authored, but the Rapier backend was created without a collider geometry provider.`,
            suggestedFix: "Create the Rapier backend with a PhysicsColliderGeometryProvider that can resolve Collider.meshId.",
            details: { meshId: shape.meshId },
        }));
    }
    if (!result.ok) {
        throw new RapierColliderSyncError(colliderFeature(collider, result.error));
    }
    return result.geometry;
}
function requireHeightfieldGeometry(collider, options) {
    const shape = collider.shape;
    if (shape.kind !== "heightfield") {
        throw new Error(`Expected heightfield-backed collider, received '${shape.kind}'.`);
    }
    const result = options.colliderGeometryProvider?.heightfield(shape.assetId);
    if (result === undefined) {
        throw new RapierColliderSyncError(colliderFeature(collider, {
            code: "physics.collider.assetShape.unsupported",
            feature: "collider.heightfield",
            message: "Collider shape 'heightfield' is authored, but the Rapier backend was created without a collider geometry provider.",
            suggestedFix: "Create the Rapier backend with a PhysicsColliderGeometryProvider that can resolve Collider.heightfieldAssetId.",
            details: { assetId: shape.assetId },
        }));
    }
    if (!result.ok) {
        throw new RapierColliderSyncError(colliderFeature(collider, result.error));
    }
    return result.geometry;
}
function colliderFeature(collider, error) {
    return {
        code: error.code,
        feature: error.feature,
        backend: "rapier",
        entity: collider.entity ?? "unknown",
        ...(error.details === undefined ? {} : { details: error.details }),
        message: error.message,
        suggestedFix: error.suggestedFix,
    };
}
function rapierTrimeshFlags() {
    return (RAPIER.TriMeshFlags.DELETE_BAD_TOPOLOGY_TRIANGLES |
        RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES |
        RAPIER.TriMeshFlags.DELETE_DUPLICATE_TRIANGLES |
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
}
function coefficientCombineRule(rule) {
    switch (rule) {
        case PhysicsMaterialCombineRule.Average:
            return RAPIER.CoefficientCombineRule.Average;
        case PhysicsMaterialCombineRule.Min:
            return RAPIER.CoefficientCombineRule.Min;
        case PhysicsMaterialCombineRule.Multiply:
            return RAPIER.CoefficientCombineRule.Multiply;
        case PhysicsMaterialCombineRule.Max:
            return RAPIER.CoefficientCombineRule.Max;
    }
}
export function collidersForCommand(command) {
    return (command.colliders ??
        (command.collider === undefined ? [] : [command.collider]));
}
export function primaryCollider(entry) {
    return entry.colliders[0] ?? null;
}
export function colliderCount(bodies) {
    return [...bodies.values()].reduce((total, entry) => total + entry.colliders.length, 0);
}
export function colliderEntries(bodies) {
    return [...bodies.values()]
        .sort((left, right) => left.entity.localeCompare(right.entity))
        .flatMap((body) => body.colliders
        .slice()
        .sort((left, right) => left.entity.localeCompare(right.entity))
        .map((collider) => ({ body, collider })));
}
export function colliderMatchForCollider(bodies, collider) {
    return colliderMatchForHandle(bodies, collider.handle);
}
export function entityForCollider(bodies, collider) {
    return colliderMatchForCollider(bodies, collider)?.body.entity ?? null;
}
export function colliderKeyFor(colliders) {
    return colliders.length === 0 ? "none" : JSON.stringify(colliders);
}
export function colliderMatchForHandle(bodies, handle) {
    for (const entry of bodies.values()) {
        for (const collider of entry.colliders) {
            if (collider.collider.handle === handle) {
                return { body: entry, collider };
            }
        }
    }
    return null;
}
/**
 * Build a Rapier-collider-handle -> match index in a single pass over the body
 * store. Per-step event resolution previously ran a nested O(bodies x colliders)
 * scan (`colliderMatchForHandle`) up to four times per contact pair; building
 * this index once per step and looking up O(1) collapses that to one pass plus
 * O(1) per handle. Rebuilt every step from the live body store, so it can never
 * go stale across upsert/destroy.
 */
export function buildColliderHandleIndex(bodies) {
    const index = new Map();
    for (const entry of bodies.values()) {
        for (const collider of entry.colliders) {
            index.set(collider.collider.handle, { body: entry, collider });
        }
    }
    return index;
}
export function compareColliderMatches(left, right) {
    return (left.body.entity.localeCompare(right.body.entity) ||
        left.collider.entity.localeCompare(right.collider.entity));
}
//# sourceMappingURL=colliders.js.map