import { PhysicsRigidBodyType } from "./components.js";
import { isColliderScaleApproximated } from "./collider-scale.js";
export const TEST_PHYSICS_BACKEND_CAPABILITIES = {
    compoundColliders: true,
    continuousCollisionDetection: false,
    characterController: true,
    linkedBodyContacts: false,
    combinedPositionVelocityMotors: false,
    motorForceLimits: false,
    automaticBreakForce: false,
    jointImpulseReadback: false,
    pairedNonFixedFrameB: false,
};
export const RAPIER_PHYSICS_BACKEND_CAPABILITIES = {
    compoundColliders: true,
    continuousCollisionDetection: true,
    characterController: true,
    linkedBodyContacts: true,
    combinedPositionVelocityMotors: true,
    motorForceLimits: false,
    automaticBreakForce: false,
    jointImpulseReadback: false,
    pairedNonFixedFrameB: false,
};
export function collectUnsupportedPhysicsCommandFeatures(backend, buffer, options = {}) {
    const features = [];
    for (const command of buffer.commands) {
        if (command.kind === "upsertBody") {
            features.push(...collectUnsupportedPhysicsBodyFeatures(backend, command.entity, command, options));
            continue;
        }
        if (command.kind === "upsertJoint") {
            features.push(...collectUnsupportedPhysicsJointFeatures(backend, command.entity, command.joint));
        }
    }
    return features;
}
export function collectUnsupportedPhysicsBodyFeatures(backend, entity, body, options = {}) {
    const features = [];
    if (body.ccdEnabled === true &&
        !backendSupportsContinuousCollisionDetection(backend)) {
        features.push({
            code: "physics.rigidBody.ccd.unsupported",
            feature: "rigidBody.ccdEnabled",
            backend,
            entity,
            message: "RigidBody.ccdEnabled is authored on this body, but the active backend does not implement continuous collision detection.",
            suggestedFix: "Use the Rapier backend for high-speed dynamic bodies, or keep ccdEnabled false until the active backend implements swept collision handling.",
        });
    }
    if (physicsBodyCommandHasUnsupportedParentedBody(body)) {
        features.push({
            code: "physics.rigidBody.parentedBody.unsupported",
            feature: "rigidBody.parentedBody",
            backend,
            entity,
            message: "RigidBody is authored on a parented entity whose world pose was not resolvable this step (no resolved WorldTransform, or a degenerate/non-decomposable world matrix), so the body cannot be synced to a backend world pose.",
            suggestedFix: "Step through stepPhysicsWorld (which guarantees and resolves WorldTransform for parented bodies), and ensure the parent chain has finite, non-zero-scale transforms so the world pose decomposes.",
        });
    }
    for (const collider of colliderDescriptorsForBodyCommand(body)) {
        const colliderEntity = collider.entity ?? entity;
        if (!isAssetBackedColliderShape(collider.shape)) {
            // Primitive colliders now bake the entity scale into their dimensions
            // (see collider-scale.ts). Surface a diagnostic only when the authored
            // scale cannot be represented exactly (non-uniform sphere, or non-uniform
            // radial scale on capsule/cylinder/cone): those use an enclosing
            // (largest-axis) approximation that may not match the rendered geometry.
            if (collider.scale !== undefined &&
                isColliderScaleApproximated(collider.shape, collider.scale)) {
                features.push({
                    code: "physics.collider.scale.approximated",
                    feature: `collider.${collider.shape.kind}.scale`,
                    backend,
                    entity: colliderEntity,
                    message: `Collider shape '${collider.shape.kind}' has a non-uniform ECS scale that a ${collider.shape.kind} cannot represent exactly; the collider uses an enclosing (largest-axis) approximation that may not match the rendered geometry.`,
                    suggestedFix: "Use a box collider for non-uniform scale, author the primitive at the intended proportions, or keep the scale uniform across the shape's radial axes.",
                    details: {
                        scale: collider.scale,
                    },
                });
            }
            continue;
        }
        if (options.assetBackedColliders !== "provider") {
            features.push({
                code: "physics.collider.assetShape.unsupported",
                feature: `collider.${collider.shape.kind}`,
                backend,
                entity: colliderEntity,
                message: `Collider shape '${collider.shape.kind}' is authored, but the active backend does not yet sync asset-backed collider geometry.`,
                suggestedFix: "Use primitive colliders for now, or provide backend collider geometry cooking for the active backend.",
            });
            continue;
        }
        if (assetColliderHasUnsupportedScale(collider)) {
            features.push({
                code: "physics.collider.scale.unsupported",
                feature: `collider.${collider.shape.kind}.scale`,
                backend,
                entity: colliderEntity,
                message: `Collider shape '${collider.shape.kind}' is asset-backed and authored with non-unit ECS scale, but this V1 sync path does not silently bake scale into backend collider geometry.`,
                suggestedFix: "Bake scale into the source mesh or heightfield asset and keep the physics collider entity scale at [1, 1, 1].",
                details: {
                    scale: collider.scale,
                },
            });
        }
        if ((collider.shape.kind === "trimesh" ||
            collider.shape.kind === "heightfield") &&
            body.bodyType !== PhysicsRigidBodyType.Static) {
            features.push({
                code: "physics.collider.dynamicAssetShape.unsupported",
                feature: `collider.${collider.shape.kind}.dynamicBody`,
                backend,
                entity: colliderEntity,
                message: `Collider shape '${collider.shape.kind}' is only supported on static bodies in this V1 asset-backed collider path.`,
                suggestedFix: "Use a static body for trimesh/heightfield terrain, or use a convexHull collider for dynamic mesh-shaped bodies.",
            });
        }
    }
    return features;
}
export function collectUnsupportedPhysicsJointFeatures(backend, entity, joint) {
    const features = [];
    if (joint.kind === "generic") {
        features.push({
            code: "physics.joint.unsupported",
            feature: "joint.generic",
            backend,
            entity,
            message: "PhysicsJoint.kind is 'generic', but the active backend route does not yet expose a backend-neutral generic constraint axis/mask mapping.",
            suggestedFix: "Use fixed, spherical, revolute, prismatic, or distance joints for now, or add an explicit generic-joint descriptor contract before authoring generic constraints.",
        });
        return features;
    }
    const breakForce = joint.breakForce;
    if (breakForce !== undefined &&
        Number.isFinite(breakForce) &&
        breakForce > 0) {
        features.push({
            code: "physics.joint.breakForce.unsupported",
            feature: "joint.breakForce",
            backend,
            entity,
            value: breakForce,
            message: "PhysicsJoint.breakForce is authored on this joint, but the active backend cannot enforce joint break thresholds or emit truthful jointBreak events.",
            suggestedFix: "Leave breakForce at 0 for now, or implement gameplay-owned joint destruction until a physics backend exposes joint impulse/readback support.",
        });
    }
    const frameB = joint.frameB;
    if (frameB !== undefined &&
        joint.kind !== "fixed" &&
        !isIdentityQuat(frameB)) {
        features.push({
            code: "physics.joint.frameB.unsupported",
            feature: "joint.frameB",
            backend,
            entity,
            message: "PhysicsJoint.frameB is authored on a non-fixed joint, but the active backend cannot encode a paired body-B joint frame for this joint kind.",
            suggestedFix: "Keep frameB as the identity for non-fixed joints, or constrain the joint through currently supported frameA-oriented unit-axis semantics until a backend exposes paired non-fixed joint frames.",
        });
    }
    const motorMaxForce = joint.motorMaxForce;
    if (motorMaxForce !== undefined &&
        Number.isFinite(motorMaxForce) &&
        motorMaxForce > 0) {
        features.push({
            code: "physics.joint.motorMaxForce.unsupported",
            feature: "joint.motorMaxForce",
            backend,
            entity,
            value: motorMaxForce,
            message: "PhysicsJoint.motorMaxForce is authored on this joint, but the active backend cannot enforce motor force limits through the current public adapter API.",
            suggestedFix: "Leave motorMaxForce at 0 for now, or implement gameplay-side motor disabling until a backend exposes enforceable motor force/max-impulse controls.",
        });
    }
    return features;
}
function backendSupportsContinuousCollisionDetection(backend) {
    return backend === "rapier";
}
export function physicsBodyCommandHasUnsupportedAssetCollider(body, options = {}) {
    return colliderDescriptorsForBodyCommand(body).some((collider) => {
        if (!isAssetBackedColliderShape(collider.shape)) {
            return false;
        }
        if (options.assetBackedColliders !== "provider") {
            return true;
        }
        return (assetColliderHasUnsupportedScale(collider) ||
            ((collider.shape.kind === "trimesh" ||
                collider.shape.kind === "heightfield") &&
                body.bodyType !== PhysicsRigidBodyType.Static));
    });
}
export function physicsBodyCommandHasUnsupportedParentedBody(body) {
    return body.parented === true;
}
export function physicsBodyCommandHasUnsupportedSyncFeature(body, options = {}) {
    return (physicsBodyCommandHasUnsupportedAssetCollider(body, options) ||
        physicsBodyCommandHasUnsupportedParentedBody(body));
}
export function physicsJointCommandHasUnsupportedSyncFeature(backend, joint) {
    return collectUnsupportedPhysicsJointFeatures(backend, "", joint).some((feature) => feature.code === "physics.joint.unsupported");
}
function colliderDescriptorsForBodyCommand(body) {
    if (body.colliders !== undefined && body.colliders.length > 0) {
        return body.colliders;
    }
    if (body.collider !== undefined) {
        return [body.collider];
    }
    return [];
}
function isAssetBackedColliderShape(shape) {
    switch (shape.kind) {
        case "convexHull":
        case "trimesh":
        case "heightfield":
            return true;
        case "box":
        case "sphere":
        case "capsule":
        case "cylinder":
        case "cone":
            return false;
    }
}
function assetColliderHasUnsupportedScale(collider) {
    const scale = collider.scale;
    return (scale !== undefined &&
        (Math.abs(scale[0] - 1) > 0.000001 ||
            Math.abs(scale[1] - 1) > 0.000001 ||
            Math.abs(scale[2] - 1) > 0.000001));
}
export function createUnsupportedJointImpulseReadbackFeature(backend, entity) {
    return {
        code: "physics.joint.impulseReadback.unsupported",
        feature: "joint.impulseReadback",
        backend,
        entity,
        message: "The active physics route does not expose native joint impulse readback, so automatic breakForce thresholds cannot be enforced truthfully.",
        suggestedFix: "Use explicit gameplay-owned joint breaks for now, or add backend-native joint impulse readback before enforcing automatic breakForce thresholds.",
    };
}
function isIdentityQuat(value) {
    return (Math.abs(value[0]) <= 0.000001 &&
        Math.abs(value[1]) <= 0.000001 &&
        Math.abs(value[2]) <= 0.000001 &&
        Math.abs(value[3] - 1) <= 0.000001);
}
export function createPhysicsResultBuffer() {
    return {
        bodies: [],
        events: [],
    };
}
export function summarizePhysicsDebugGeometry(geometry) {
    const colors = new Map();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let finiteLineCount = 0;
    for (const line of geometry.lines) {
        if (!isFiniteVec3(line.from) ||
            !isFiniteVec3(line.to) ||
            !isFiniteColor(line.color)) {
            continue;
        }
        finiteLineCount += 1;
        includePointInBounds(min, max, line.from);
        includePointInBounds(min, max, line.to);
        const key = line.color.join(",");
        const existing = colors.get(key);
        if (existing === undefined) {
            colors.set(key, { color: [...line.color], lineCount: 1 });
        }
        else {
            existing.lineCount += 1;
        }
    }
    const colorSummaries = [...colors.values()].sort((left, right) => left.color.join(",").localeCompare(right.color.join(",")));
    return {
        lineCount: geometry.lines.length,
        finiteLineCount,
        invalidLineCount: geometry.lines.length - finiteLineCount,
        colorCount: colorSummaries.length,
        colors: colorSummaries.map((summary) => ({
            color: summary.color,
            lineCount: summary.lineCount,
        })),
        bounds: finiteLineCount === 0
            ? null
            : {
                min,
                max,
            },
    };
}
export function createPhysicsRayProbeDebugLines(probes = [], raycastFirst) {
    const lines = [];
    for (const probe of probes) {
        const hit = raycastFirst(probe.ray, probe.options);
        if (hit === null) {
            lines.push({
                from: vec3(probe.ray.origin),
                to: rayEndpoint(probe.ray),
                color: color(probe.missColor, [0.45, 0.55, 0.65, 1]),
            });
            continue;
        }
        lines.push({
            from: vec3(probe.ray.origin),
            to: vec3(hit.point),
            color: color(probe.hitColor, [1, 0.86, 0.12, 1]),
        });
        lines.push({
            from: vec3(hit.point),
            to: addScaled(hit.point, hit.normal, finitePositive(probe.normalLength, 0.35)),
            color: color(probe.normalColor, [1, 0.2, 0.12, 1]),
        });
    }
    return lines;
}
export function createPhysicsAabbDebugLines(aabbs, inputColor) {
    const lines = [];
    const lineColor = color(inputColor, [0.95, 0.65, 0.15, 1]);
    const edgeIndices = [
        [0, 1],
        [1, 3],
        [3, 2],
        [2, 0],
        [4, 5],
        [5, 7],
        [7, 6],
        [6, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
    ];
    for (const aabb of aabbs) {
        if (!isFiniteVec3(aabb.min) || !isFiniteVec3(aabb.max)) {
            continue;
        }
        const vertices = [
            [aabb.min[0], aabb.min[1], aabb.min[2]],
            [aabb.max[0], aabb.min[1], aabb.min[2]],
            [aabb.min[0], aabb.max[1], aabb.min[2]],
            [aabb.max[0], aabb.max[1], aabb.min[2]],
            [aabb.min[0], aabb.min[1], aabb.max[2]],
            [aabb.max[0], aabb.min[1], aabb.max[2]],
            [aabb.min[0], aabb.max[1], aabb.max[2]],
            [aabb.max[0], aabb.max[1], aabb.max[2]],
        ];
        for (const [fromIndex, toIndex] of edgeIndices) {
            const from = vertices[fromIndex];
            const to = vertices[toIndex];
            if (from === undefined || to === undefined) {
                continue;
            }
            lines.push({
                from: vec3(from),
                to: vec3(to),
                color: lineColor,
            });
        }
    }
    return lines;
}
function rayEndpoint(ray) {
    return addScaled(ray.origin, ray.direction, finitePositive(ray.maxDistance, 1));
}
function addScaled(origin, direction, scale) {
    return [
        origin[0] + direction[0] * scale,
        origin[1] + direction[1] * scale,
        origin[2] + direction[2] * scale,
    ];
}
function color(input, fallback) {
    return input ?? fallback;
}
function vec3(input) {
    return [input[0], input[1], input[2]];
}
function includePointInBounds(min, max, point) {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    min[2] = Math.min(min[2], point[2]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
    max[2] = Math.max(max[2], point[2]);
}
function isFiniteVec3(input) {
    return input.every(Number.isFinite);
}
function isFiniteColor(input) {
    return input.every(Number.isFinite);
}
function finitePositive(value, fallback) {
    return value !== undefined && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
//# sourceMappingURL=backend.js.map