import RAPIER from "@dimforge/rapier3d-compat";
import type {
  PhysicsCommand,
  PhysicsJointDescriptor,
  PhysicsVec3,
} from "@aperture-engine/physics";
import { finiteNonNegative, finitePositive } from "./util.js";
import {
  normalizeQuat,
  normalizeVec3,
  quat,
  rotateVec3ByQuat,
  vec,
} from "./math.js";
import type { RapierBodyEntry, RapierJointEntry } from "./types.js";

export function upsertJoint(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  joints: Map<string, RapierJointEntry>,
  command: Extract<PhysicsCommand, { readonly kind: "upsertJoint" }>,
): void {
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

  const joint = world.createImpulseJoint(
    jointData(descriptor),
    bodyA.body,
    bodyB.body,
    true,
  );

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

export function destroyJoint(
  world: RAPIER.World,
  joints: Map<string, RapierJointEntry>,
  entity: string,
): void {
  const entry = joints.get(entity);

  if (entry === undefined) {
    return;
  }

  world.removeImpulseJoint(entry.joint, true);
  joints.delete(entity);
}

export function destroyJointsForBody(
  world: RAPIER.World,
  joints: Map<string, RapierJointEntry>,
  bodyRef: string,
): void {
  for (const entry of [...joints.values()]) {
    if (entry.bodyARef === bodyRef || entry.bodyBRef === bodyRef) {
      destroyJoint(world, joints, entry.entity);
    }
  }
}

export function jointData(
  descriptor: PhysicsJointDescriptor,
): RAPIER.JointData {
  switch (descriptor.kind) {
    case "fixed":
      return RAPIER.JointData.fixed(
        vec(descriptor.anchorA),
        quat(normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1])),
        vec(descriptor.anchorB),
        quat(normalizeQuat(descriptor.frameB ?? [0, 0, 0, 1])),
      );
    case "spherical":
      return RAPIER.JointData.spherical(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
      );
    case "revolute":
      return RAPIER.JointData.revolute(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
        vec(jointAxis(descriptor)),
      );
    case "prismatic":
      return RAPIER.JointData.prismatic(
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
        vec(jointAxis(descriptor)),
      );
    case "distance":
      return RAPIER.JointData.rope(
        finitePositive(descriptor.maxLimit, 1),
        vec(descriptor.anchorA),
        vec(descriptor.anchorB),
      );
    case "generic":
      throw new Error(
        "Rapier backend does not support generic joints in this slice.",
      );
  }
}

export function jointAxis(descriptor: PhysicsJointDescriptor): PhysicsVec3 {
  return normalizeVec3(
    rotateVec3ByQuat(
      descriptor.axis,
      normalizeQuat(descriptor.frameA ?? [0, 0, 0, 1]),
    ),
  );
}

export function applyJointParameters(
  joint: RAPIER.ImpulseJoint,
  descriptor: PhysicsJointDescriptor,
): void {
  if (!isUnitImpulseJoint(joint)) {
    return;
  }

  const minLimit = descriptor.minLimit;
  const maxLimit = descriptor.maxLimit;

  if (
    minLimit !== undefined &&
    maxLimit !== undefined &&
    Number.isFinite(minLimit) &&
    Number.isFinite(maxLimit) &&
    maxLimit > minLimit
  ) {
    joint.setLimits(minLimit, maxLimit);
  }

  if (
    descriptor.motorModel === "force" &&
    typeof (joint as { readonly configureMotorModel?: unknown })
      .configureMotorModel === "function"
  ) {
    joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
  }

  if (descriptor.motorMode === "velocity") {
    const motorFactor = finiteNonNegative(
      descriptor.motorFactor ?? descriptor.motorDamping,
    );

    if (motorFactor > 0) {
      const motorVelocity =
        descriptor.motorVelocity !== undefined &&
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
    const motorTarget =
      descriptor.motorTarget !== undefined &&
      Number.isFinite(descriptor.motorTarget)
        ? descriptor.motorTarget
        : 0;
    const motorVelocity =
      descriptor.motorVelocity !== undefined &&
      Number.isFinite(descriptor.motorVelocity)
        ? descriptor.motorVelocity
        : undefined;

    if (motorVelocity !== undefined) {
      joint.configureMotor(
        motorTarget,
        motorVelocity,
        motorStiffness,
        motorDamping,
      );
    } else {
      joint.configureMotorPosition(motorTarget, motorStiffness, motorDamping);
    }
  }
}

export function isUnitImpulseJoint(
  joint: RAPIER.ImpulseJoint,
): joint is RAPIER.UnitImpulseJoint {
  return (
    typeof (joint as { readonly setLimits?: unknown }).setLimits === "function"
  );
}
