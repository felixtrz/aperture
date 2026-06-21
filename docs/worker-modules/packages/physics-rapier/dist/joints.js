import RAPIER from "/aperture/worker-modules/packages/physics-rapier/node_modules/@dimforge/rapier3d-compat/rapier.mjs";
import { finiteNonNegative, finitePositive } from "./util.js";
import { normalizeQuat, normalizeVec3, quat, rotateVec3ByQuat, vec, } from "./math.js";
export function upsertJoint(world, bodies, joints, command) {
    const descriptor = command.joint;
    const bodyA = bodies.get(descriptor.bodyARef);
    const bodyB = bodies.get(descriptor.bodyBRef);
    if (bodyA === undefined || bodyB === undefined) {
        destroyJoint(world, joints, command.entity);
        return;
    }
    const descriptorKey = JSON.stringify(descriptor);
    const existing = joints.get(command.entity);
    if (existing !== undefined && existing.descriptorKey === descriptorKey) {
        return;
    }
    if (existing !== undefined) {
        destroyJoint(world, joints, command.entity);
    }
    const joint = world.createImpulseJoint(jointData(descriptor), bodyA.body, bodyB.body, true);
    joint.setContactsEnabled(descriptor.contactsEnabled !== false);
    applyJointParameters(joint, descriptor);
    joints.set(command.entity, {
        entity: command.entity,
        bodyARef: descriptor.bodyARef,
        bodyBRef: descriptor.bodyBRef,
        descriptor,
        joint,
        descriptorKey,
    });
}
export function destroyJoint(world, joints, entity) {
    const entry = joints.get(entity);
    if (entry === undefined) {
        return;
    }
    world.removeImpulseJoint(entry.joint, true);
    joints.delete(entity);
}
export function destroyJointsForBody(world, joints, bodyRef) {
    for (const entry of [...joints.values()]) {
        if (entry.bodyARef === bodyRef || entry.bodyBRef === bodyRef) {
            destroyJoint(world, joints, entry.entity);
        }
    }
}
function jointData(descriptor) {
    switch (descriptor.kind) {
        case "fixed":
            return RAPIER.JointData.fixed(vec(descriptor.anchorA), quat(normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1])), vec(descriptor.anchorB), quat(normalizeQuat(descriptor.frameB ?? [0, 0, 0, 1])));
        case "spherical":
            return RAPIER.JointData.spherical(vec(descriptor.anchorA), vec(descriptor.anchorB));
        case "revolute":
            return RAPIER.JointData.revolute(vec(descriptor.anchorA), vec(descriptor.anchorB), vec(jointAxis(descriptor)));
        case "prismatic":
            return RAPIER.JointData.prismatic(vec(descriptor.anchorA), vec(descriptor.anchorB), vec(jointAxis(descriptor)));
        case "distance":
            return RAPIER.JointData.rope(finitePositive(descriptor.maxLimit, 1), vec(descriptor.anchorA), vec(descriptor.anchorB));
        case "generic":
            throw new Error("Rapier backend does not support generic joints in this slice.");
    }
}
export function jointAxis(descriptor) {
    return normalizeVec3(rotateVec3ByQuat(descriptor.axis, normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1])));
}
function applyJointParameters(joint, descriptor) {
    if (!isUnitImpulseJoint(joint)) {
        return;
    }
    const minLimit = descriptor.minLimit;
    const maxLimit = descriptor.maxLimit;
    if (minLimit !== undefined &&
        maxLimit !== undefined &&
        Number.isFinite(minLimit) &&
        Number.isFinite(maxLimit) &&
        maxLimit > minLimit) {
        joint.setLimits(minLimit, maxLimit);
    }
    if (descriptor.motorModel === "force" &&
        typeof joint
            .configureMotorModel === "function") {
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    }
    if (descriptor.motorMode === "velocity") {
        const motorFactor = finiteNonNegative(descriptor.motorFactor ?? descriptor.motorDamping);
        if (motorFactor > 0) {
            const motorVelocity = descriptor.motorVelocity !== undefined &&
                Number.isFinite(descriptor.motorVelocity)
                ? descriptor.motorVelocity
                : 0;
            joint.configureMotorVelocity(motorVelocity, motorFactor);
        }
        return;
    }
    const motorStiffness = finiteNonNegative(descriptor.motorStiffness);
    const motorDamping = finiteNonNegative(descriptor.motorDamping);
    if (motorStiffness > 0 || motorDamping > 0) {
        const motorTarget = descriptor.motorTarget !== undefined &&
            Number.isFinite(descriptor.motorTarget)
            ? descriptor.motorTarget
            : 0;
        const motorVelocity = descriptor.motorVelocity !== undefined &&
            Number.isFinite(descriptor.motorVelocity)
            ? descriptor.motorVelocity
            : undefined;
        if (motorVelocity !== undefined) {
            joint.configureMotor(motorTarget, motorVelocity, motorStiffness, motorDamping);
        }
        else {
            joint.configureMotorPosition(motorTarget, motorStiffness, motorDamping);
        }
    }
}
function isUnitImpulseJoint(joint) {
    return (typeof joint.setLimits === "function");
}
//# sourceMappingURL=joints.js.map