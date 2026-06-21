import RAPIER from "/aperture/worker-modules/packages/physics-rapier/node_modules/@dimforge/rapier3d-compat/rapier.mjs";
import { PhysicsRigidBodyType, } from "/aperture/worker-modules/packages/physics/dist/index.js";
import { colliderDesc, colliderKeyFor, collidersForCommand, } from "./colliders.js";
import { destroyJointsForBody } from "./joints.js";
import { quat, vec, vec3 } from "./math.js";
export function upsertBody(world, bodies, joints, command, options = {}) {
    const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;
    const colliderDescriptors = collidersForCommand(command);
    const colliderKey = colliderKeyFor(colliderDescriptors);
    const canSleep = command.canSleep !== false;
    const existing = bodies.get(command.entity);
    if (existing !== undefined &&
        existing.bodyType === bodyType &&
        existing.colliderKey === colliderKey &&
        existing.canSleep === canSleep) {
        updateBodyLocks(existing, command);
        updateBody(existing.body, command);
        setVelocity(existing, command.velocity);
        configureBody(existing.body, command);
        applyExternalEffects(existing, command);
        return;
    }
    const colliderDescs = colliderDescriptors.map((descriptor, index) => ({
        entity: descriptor.entity ??
            (index === 0 ? command.entity : `${command.entity}#${index}`),
        desc: colliderDesc(descriptor, options),
        descriptor,
    }));
    if (existing !== undefined) {
        destroyBody(world, bodies, joints, command.entity);
    }
    const body = world.createRigidBody(bodyDesc(command, bodyType));
    const colliders = colliderDescs.map((entry) => ({
        entity: entry.entity,
        collider: world.createCollider(entry.desc, body),
        descriptor: entry.descriptor,
    }));
    const entry = {
        entity: command.entity,
        body,
        colliders,
        bodyType,
        colliderKey,
        canSleep,
        lockTranslations: locksOrDefault(command.lockTranslations),
        lockRotations: locksOrDefault(command.lockRotations),
    };
    bodies.set(command.entity, entry);
    updateBody(body, command);
    setVelocity(entry, command.velocity);
    configureBody(body, command);
    applyExternalEffects(entry, command);
}
export function destroyBody(world, bodies, joints, entity) {
    const entry = bodies.get(entity);
    if (entry === undefined) {
        return;
    }
    destroyJointsForBody(world, joints, entity);
    world.removeRigidBody(entry.body);
    bodies.delete(entity);
}
function bodyDesc(command, bodyType) {
    const desc = bodyDescForType(bodyType);
    const transform = command.transform;
    desc.setTranslation(...transform.translation);
    desc.setRotation(quat(transform.rotation));
    if (command.velocity !== undefined) {
        const velocity = maskedVelocityForCommand(command.velocity, command);
        desc.setLinvel(...velocity.linear);
        desc.setAngvel(vec(velocity.angular));
    }
    if (command.gravityScale !== undefined) {
        desc.setGravityScale(command.gravityScale);
    }
    if (command.linearDamping !== undefined) {
        desc.setLinearDamping(command.linearDamping);
    }
    if (command.angularDamping !== undefined) {
        desc.setAngularDamping(command.angularDamping);
    }
    if (command.canSleep !== undefined) {
        desc.setCanSleep(command.canSleep);
    }
    if (command.ccdEnabled !== undefined) {
        desc.setCcdEnabled(command.ccdEnabled);
    }
    if (command.lockTranslations !== undefined) {
        desc.enabledTranslations(!command.lockTranslations[0], !command.lockTranslations[1], !command.lockTranslations[2]);
    }
    if (command.lockRotations !== undefined) {
        desc.enabledRotations(!command.lockRotations[0], !command.lockRotations[1], !command.lockRotations[2]);
    }
    return desc;
}
function configureBody(body, command) {
    if (command.gravityScale !== undefined) {
        body.setGravityScale(command.gravityScale, false);
    }
    if (command.linearDamping !== undefined) {
        body.setLinearDamping(command.linearDamping);
    }
    if (command.angularDamping !== undefined) {
        body.setAngularDamping(command.angularDamping);
    }
    if (command.ccdEnabled !== undefined) {
        body.enableCcd(command.ccdEnabled);
    }
    if (command.lockTranslations !== undefined) {
        body.setEnabledTranslations(!command.lockTranslations[0], !command.lockTranslations[1], !command.lockTranslations[2], false);
    }
    if (command.lockRotations !== undefined) {
        body.setEnabledRotations(!command.lockRotations[0], !command.lockRotations[1], !command.lockRotations[2], false);
    }
}
function updateBodyLocks(entry, command) {
    entry.lockTranslations = locksOrDefault(command.lockTranslations);
    entry.lockRotations = locksOrDefault(command.lockRotations);
}
function bodyDescForType(bodyType) {
    switch (bodyType) {
        case PhysicsRigidBodyType.Static:
            return RAPIER.RigidBodyDesc.fixed();
        case PhysicsRigidBodyType.KinematicPosition:
            return RAPIER.RigidBodyDesc.kinematicPositionBased();
        case PhysicsRigidBodyType.KinematicVelocity:
            return RAPIER.RigidBodyDesc.kinematicVelocityBased();
        case PhysicsRigidBodyType.Dynamic:
            return RAPIER.RigidBodyDesc.dynamic();
    }
}
function updateBody(body, command) {
    const translation = vec(command.transform.translation);
    const rotation = quat(command.transform.rotation);
    const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;
    const kinematicTarget = command.kinematicTarget ?? command.transform;
    if (bodyType === PhysicsRigidBodyType.KinematicPosition) {
        body.setNextKinematicTranslation(vec(kinematicTarget.translation));
        body.setNextKinematicRotation(quat(kinematicTarget.rotation));
    }
    else {
        body.setTranslation(translation, false);
        body.setRotation(rotation, false);
    }
}
export function setVelocity(entry, velocity) {
    if (entry === undefined || velocity === undefined) {
        return;
    }
    const maskedVelocity = {
        linear: maskLockedAxes(velocity.linear, entry.lockTranslations),
        angular: maskLockedAxes(velocity.angular, entry.lockRotations),
    };
    const wakeUp = velocityMagnitude(maskedVelocity) > 0;
    entry.body.setLinvel(vec(maskedVelocity.linear), wakeUp);
    entry.body.setAngvel(vec(maskedVelocity.angular), wakeUp);
}
function applyExternalEffects(entry, command) {
    if (entry === undefined || !entry.body.isDynamic()) {
        return;
    }
    if (command.externalForce !== undefined) {
        entry.body.addForce(vec(maskLockedAxes(command.externalForce.force, entry.lockTranslations)), true);
        entry.body.addTorque(vec(maskLockedAxes(command.externalForce.torque, entry.lockRotations)), true);
    }
    if (command.externalImpulse !== undefined) {
        entry.body.applyImpulse(vec(maskLockedAxes(command.externalImpulse.impulse, entry.lockTranslations)), true);
        entry.body.applyTorqueImpulse(vec(maskLockedAxes(command.externalImpulse.angularImpulse, entry.lockRotations)), true);
    }
}
function maskedVelocityForCommand(velocity, command) {
    return {
        linear: maskLockedAxes(velocity.linear, command.lockTranslations),
        angular: maskLockedAxes(velocity.angular, command.lockRotations),
    };
}
function locksOrDefault(locks) {
    return locks ?? [false, false, false];
}
function maskLockedAxes(value, locks) {
    if (locks === undefined) {
        return value;
    }
    return [
        locks[0] ? 0 : value[0],
        locks[1] ? 0 : value[1],
        locks[2] ? 0 : value[2],
    ];
}
function velocityMagnitude(velocity) {
    return Math.hypot(velocity.linear[0], velocity.linear[1], velocity.linear[2], velocity.angular[0], velocity.angular[1], velocity.angular[2]);
}
export function bodyResult(entry) {
    const translation = entry.body.translation();
    const rotation = entry.body.rotation();
    const linear = maskLockedAxes(vec3(entry.body.linvel()), entry.lockTranslations);
    const angular = maskLockedAxes(vec3(entry.body.angvel()), entry.lockRotations);
    return {
        entity: entry.entity,
        transform: {
            translation: [translation.x, translation.y, translation.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        },
        velocity: {
            linear,
            angular,
        },
        sleeping: entry.body.isSleeping(),
    };
}
//# sourceMappingURL=bodies.js.map