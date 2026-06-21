import { PhysicsRigidBodyType, } from "../components.js";
import { add, addScaled, cloneVec3, multiplyQuat, normalizeQuat, scale, transformLocalPoint, } from "./math.js";
import { boundingRadiusForShape } from "./shapes.js";
export function bodyResult(body) {
    return {
        entity: body.entity,
        transform: cloneTransform(body.transform),
        velocity: cloneVelocity(body.velocity),
        sleeping: body.sleeping,
    };
}
export function collidersForCommand(command) {
    const descriptors = command.colliders ??
        (command.collider === undefined ? undefined : [command.collider]);
    if (descriptors !== undefined && descriptors.length > 0) {
        return descriptors.map((descriptor, index) => testColliderForDescriptor(command.entity, descriptor, index));
    }
    return [
        {
            entity: command.entity,
            radius: command.radius ?? 0.5,
            colliderOffsetTranslation: [0, 0, 0],
            sensor: false,
            collisionGroups: -1,
        },
    ];
}
function testColliderForDescriptor(body, descriptor, index) {
    return {
        entity: descriptor.entity ?? (index === 0 ? body : `${body}#${index}`),
        radius: boundingRadiusForShape(descriptor.shape),
        colliderOffsetTranslation: cloneVec3(descriptor.offsetTranslation ?? [0, 0, 0]),
        sensor: descriptor.sensor === true,
        collisionGroups: descriptor.collisionGroups ?? -1,
    };
}
export function colliderCount(bodies) {
    return [...bodies.values()].reduce((total, body) => total + body.colliders.length, 0);
}
export function colliderCenter(body, collider) {
    return transformLocalPoint(body.transform, collider.colliderOffsetTranslation);
}
export function cloneTransform(transform) {
    return {
        translation: cloneVec3(transform.translation),
        rotation: [
            transform.rotation[0],
            transform.rotation[1],
            transform.rotation[2],
            transform.rotation[3],
        ],
    };
}
export function kinematicTransformForCommand(command) {
    const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;
    return bodyType === PhysicsRigidBodyType.KinematicPosition
        ? command.kinematicTarget
        : undefined;
}
export function cloneVelocity(velocity) {
    return {
        linear: cloneVec3(velocity.linear),
        angular: cloneVec3(velocity.angular),
    };
}
export function zeroVelocity() {
    return {
        linear: [0, 0, 0],
        angular: [0, 0, 0],
    };
}
export function cloneExternalForce(value) {
    return {
        force: cloneVec3(value.force),
        torque: cloneVec3(value.torque),
    };
}
export function zeroExternalForce() {
    return {
        force: [0, 0, 0],
        torque: [0, 0, 0],
    };
}
export function cloneExternalImpulse(value) {
    return {
        impulse: cloneVec3(value.impulse),
        angularImpulse: cloneVec3(value.angularImpulse),
    };
}
export function zeroExternalImpulse() {
    return {
        impulse: [0, 0, 0],
        angularImpulse: [0, 0, 0],
    };
}
export function applyForceAndImpulse(body, fixedDelta, gravity) {
    const linear = maskLockedAxes(add(addScaled(addScaled(body.velocity.linear, gravity, fixedDelta * body.gravityScale), body.externalForce.force, fixedDelta), body.pendingImpulse.impulse), body.lockTranslations);
    const angular = maskLockedAxes(add(addScaled(body.velocity.angular, body.externalForce.torque, fixedDelta), body.pendingImpulse.angularImpulse), body.lockRotations);
    body.velocity = {
        linear,
        angular,
    };
    body.pendingImpulse = zeroExternalImpulse();
}
export function integrateTranslation(body, fixedDelta) {
    return [
        body.lockTranslations[0]
            ? body.transform.translation[0]
            : body.transform.translation[0] + body.velocity.linear[0] * fixedDelta,
        body.lockTranslations[1]
            ? body.transform.translation[1]
            : body.transform.translation[1] + body.velocity.linear[1] * fixedDelta,
        body.lockTranslations[2]
            ? body.transform.translation[2]
            : body.transform.translation[2] + body.velocity.linear[2] * fixedDelta,
    ];
}
export function integrateRotation(body, fixedDelta) {
    const angularSpeed = Math.hypot(body.velocity.angular[0], body.velocity.angular[1], body.velocity.angular[2]);
    if (!Number.isFinite(angularSpeed) || angularSpeed === 0) {
        return normalizeQuat(body.transform.rotation);
    }
    const halfAngle = (angularSpeed * fixedDelta) / 2;
    const scaleByAxis = Math.sin(halfAngle) / angularSpeed;
    const delta = normalizeQuat([
        body.velocity.angular[0] * scaleByAxis,
        body.velocity.angular[1] * scaleByAxis,
        body.velocity.angular[2] * scaleByAxis,
        Math.cos(halfAngle),
    ]);
    return multiplyQuat(delta, body.transform.rotation);
}
export function applyDamping(body, fixedDelta) {
    body.velocity = {
        linear: scale(body.velocity.linear, dampingFactor(body.linearDamping, fixedDelta)),
        angular: scale(body.velocity.angular, dampingFactor(body.angularDamping, fixedDelta)),
    };
}
function dampingFactor(damping, fixedDelta) {
    if (!Number.isFinite(damping) || damping <= 0) {
        return 1;
    }
    return 1 / (1 + damping * fixedDelta);
}
export function maskLockedAxes(value, locks) {
    return [
        locks[0] ? 0 : value[0],
        locks[1] ? 0 : value[1],
        locks[2] ? 0 : value[2],
    ];
}
export function velocityMagnitude(velocity) {
    return Math.hypot(velocity.linear[0], velocity.linear[1], velocity.linear[2], velocity.angular[0], velocity.angular[1], velocity.angular[2]);
}
export function bodyRadius(body) {
    return body.colliders[0]?.radius ?? 0.5;
}
//# sourceMappingURL=bodies.js.map