import {
  PhysicsRigidBodyType,
  type PhysicsQuat,
  type PhysicsVec3,
} from "../components.js";
import type {
  PhysicsBodyResult,
  PhysicsColliderDescriptor,
  PhysicsCommandBuffer,
  PhysicsExternalForceValue,
  PhysicsExternalImpulseValue,
  PhysicsTransform,
  PhysicsVelocityValue,
} from "../backend.js";
import {
  add,
  addScaled,
  cloneVec3,
  multiplyQuat,
  normalizeQuat,
  scale,
  transformLocalPoint,
} from "./math.js";
import { boundingRadiusForShape } from "./shapes.js";
import type { TestBody, TestCollider } from "./types.js";

export function bodyResult(body: TestBody): PhysicsBodyResult {
  return {
    entity: body.entity,
    transform: cloneTransform(body.transform),
    velocity: cloneVelocity(body.velocity),
    sleeping: body.sleeping,
  };
}

export function collidersForCommand(
  command: Extract<
    PhysicsCommandBuffer["commands"][number],
    { readonly kind: "upsertBody" }
  >,
): readonly TestCollider[] {
  const descriptors =
    command.colliders ??
    (command.collider === undefined ? undefined : [command.collider]);

  if (descriptors !== undefined && descriptors.length > 0) {
    return descriptors.map((descriptor, index) =>
      testColliderForDescriptor(command.entity, descriptor, index),
    );
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

export function testColliderForDescriptor(
  body: string,
  descriptor: PhysicsColliderDescriptor,
  index: number,
): TestCollider {
  return {
    entity: descriptor.entity ?? (index === 0 ? body : `${body}#${index}`),
    radius: boundingRadiusForShape(descriptor.shape),
    colliderOffsetTranslation: cloneVec3(
      descriptor.offsetTranslation ?? [0, 0, 0],
    ),
    sensor: descriptor.sensor === true,
    collisionGroups: descriptor.collisionGroups ?? -1,
  };
}

export function colliderCount(bodies: ReadonlyMap<string, TestBody>): number {
  return [...bodies.values()].reduce(
    (total, body) => total + body.colliders.length,
    0,
  );
}

export function colliderCenter(
  body: TestBody,
  collider: TestCollider,
): PhysicsVec3 {
  return transformLocalPoint(
    body.transform,
    collider.colliderOffsetTranslation,
  );
}

export function cloneTransform(transform: PhysicsTransform): PhysicsTransform {
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

export function kinematicTransformForCommand(
  command: Extract<
    PhysicsCommandBuffer["commands"][number],
    { readonly kind: "upsertBody" }
  >,
): PhysicsTransform | undefined {
  const bodyType = command.bodyType ?? PhysicsRigidBodyType.Dynamic;

  return bodyType === PhysicsRigidBodyType.KinematicPosition
    ? command.kinematicTarget
    : undefined;
}

export function cloneVelocity(
  velocity: PhysicsVelocityValue,
): PhysicsVelocityValue {
  return {
    linear: cloneVec3(velocity.linear),
    angular: cloneVec3(velocity.angular),
  };
}

export function zeroVelocity(): PhysicsVelocityValue {
  return {
    linear: [0, 0, 0],
    angular: [0, 0, 0],
  };
}

export function cloneExternalForce(
  value: PhysicsExternalForceValue,
): PhysicsExternalForceValue {
  return {
    force: cloneVec3(value.force),
    torque: cloneVec3(value.torque),
  };
}

export function zeroExternalForce(): PhysicsExternalForceValue {
  return {
    force: [0, 0, 0],
    torque: [0, 0, 0],
  };
}

export function cloneExternalImpulse(
  value: PhysicsExternalImpulseValue,
): PhysicsExternalImpulseValue {
  return {
    impulse: cloneVec3(value.impulse),
    angularImpulse: cloneVec3(value.angularImpulse),
  };
}

export function zeroExternalImpulse(): PhysicsExternalImpulseValue {
  return {
    impulse: [0, 0, 0],
    angularImpulse: [0, 0, 0],
  };
}

export function applyForceAndImpulse(
  body: TestBody,
  fixedDelta: number,
  gravity: PhysicsVec3,
): void {
  const linear = maskLockedAxes(
    add(
      addScaled(
        addScaled(
          body.velocity.linear,
          gravity,
          fixedDelta * body.gravityScale,
        ),
        body.externalForce.force,
        fixedDelta,
      ),
      body.pendingImpulse.impulse,
    ),
    body.lockTranslations,
  );
  const angular = maskLockedAxes(
    add(
      addScaled(body.velocity.angular, body.externalForce.torque, fixedDelta),
      body.pendingImpulse.angularImpulse,
    ),
    body.lockRotations,
  );

  body.velocity = {
    linear,
    angular,
  };
  body.pendingImpulse = zeroExternalImpulse();
}

export function integrateTranslation(
  body: TestBody,
  fixedDelta: number,
): PhysicsVec3 {
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

export function integrateRotation(
  body: TestBody,
  fixedDelta: number,
): PhysicsQuat {
  const angularSpeed = Math.hypot(
    body.velocity.angular[0],
    body.velocity.angular[1],
    body.velocity.angular[2],
  );

  if (!Number.isFinite(angularSpeed) || angularSpeed === 0) {
    return normalizeQuat(body.transform.rotation);
  }

  const halfAngle = (angularSpeed * fixedDelta) / 2;
  const scaleByAxis = Math.sin(halfAngle) / angularSpeed;
  const delta: PhysicsQuat = normalizeQuat([
    body.velocity.angular[0] * scaleByAxis,
    body.velocity.angular[1] * scaleByAxis,
    body.velocity.angular[2] * scaleByAxis,
    Math.cos(halfAngle),
  ]);

  return multiplyQuat(delta, body.transform.rotation);
}

export function applyDamping(body: TestBody, fixedDelta: number): void {
  body.velocity = {
    linear: scale(
      body.velocity.linear,
      dampingFactor(body.linearDamping, fixedDelta),
    ),
    angular: scale(
      body.velocity.angular,
      dampingFactor(body.angularDamping, fixedDelta),
    ),
  };
}

export function dampingFactor(damping: number, fixedDelta: number): number {
  if (!Number.isFinite(damping) || damping <= 0) {
    return 1;
  }

  return 1 / (1 + damping * fixedDelta);
}

export function maskLockedAxes(
  value: PhysicsVec3,
  locks: readonly [boolean, boolean, boolean],
): PhysicsVec3 {
  return [
    locks[0] ? 0 : value[0],
    locks[1] ? 0 : value[1],
    locks[2] ? 0 : value[2],
  ];
}

export function velocityMagnitude(velocity: PhysicsVelocityValue): number {
  return Math.hypot(
    velocity.linear[0],
    velocity.linear[1],
    velocity.linear[2],
    velocity.angular[0],
    velocity.angular[1],
    velocity.angular[2],
  );
}

export function bodyRadius(body: TestBody): number {
  return body.colliders[0]?.radius ?? 0.5;
}
