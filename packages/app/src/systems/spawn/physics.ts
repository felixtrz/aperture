import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsCharacterController,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsMaterial,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsCharacterController,
  createPhysicsDebug,
  createPhysicsGravity,
  createPhysicsJoint,
  createPhysicsMaterial,
  createPhysicsVelocity,
  createRigidBody,
  registerPhysicsComponents,
} from "@aperture-engine/physics";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type {
  PhysicsComponentDescriptor,
  PhysicsSpawnDescriptor,
} from "./types.js";

export function applyPhysicsSpawnDescriptor(
  world: EcsWorld,
  entity: Entity,
  input: PhysicsSpawnDescriptor | undefined,
): void {
  if (input === undefined) {
    return;
  }

  registerPhysicsComponents(world);

  if (input.rigidBody !== undefined) {
    entity.addComponent(
      RigidBody,
      createRigidBody(componentInput(input.rigidBody)),
    );
  }

  if (input.collider !== undefined) {
    entity.addComponent(
      Collider,
      createCollider(componentInput(input.collider)),
    );
  }

  if (input.velocity !== undefined) {
    entity.addComponent(
      PhysicsVelocity,
      createPhysicsVelocity(componentInput(input.velocity)),
    );
  }

  if (input.externalForce !== undefined) {
    entity.addComponent(
      ExternalForce,
      createExternalForce(componentInput(input.externalForce)),
    );
  }

  if (input.externalImpulse !== undefined) {
    entity.addComponent(
      ExternalImpulse,
      createExternalImpulse(componentInput(input.externalImpulse)),
    );
  }

  if (input.kinematicTarget !== undefined) {
    entity.addComponent(
      KinematicTarget,
      createKinematicTarget(componentInput(input.kinematicTarget)),
    );
  }

  if (input.gravity !== undefined) {
    entity.addComponent(
      PhysicsGravity,
      createPhysicsGravity(componentInput(input.gravity)),
    );
  }

  if (input.characterController !== undefined) {
    entity.addComponent(
      PhysicsCharacterController,
      createPhysicsCharacterController(
        componentInput(input.characterController),
      ),
    );
  }

  if (input.material !== undefined) {
    entity.addComponent(
      PhysicsMaterial,
      createPhysicsMaterial(componentInput(input.material)),
    );
  }

  if (input.joint !== undefined) {
    entity.addComponent(
      PhysicsJoint,
      createPhysicsJoint(componentInput(input.joint)),
    );
  }

  if (input.debug !== undefined) {
    entity.addComponent(
      PhysicsDebug,
      createPhysicsDebug(componentInput(input.debug)),
    );
  }
}

function componentInput<TInput>(
  input: PhysicsComponentDescriptor<TInput>,
): TInput {
  return input === true ? ({} as TInput) : input;
}
