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
  type ColliderInput,
  type PhysicsCharacterControllerInput,
  type PhysicsJointInput,
  validateColliderInput,
  validatePhysicsCharacterControllerInput,
  validatePhysicsJointInput,
  validateRigidBodyInput,
  type PhysicsValidationDiagnostic,
  type RigidBodyInput,
} from "@aperture-engine/physics";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { SystemDiagnostics } from "../diagnostics.js";
import type {
  PhysicsComponentDescriptor,
  PhysicsSpawnDescriptor,
} from "./types.js";

export interface ApplyPhysicsSpawnDescriptorOptions {
  readonly world: EcsWorld;
  readonly entity: Entity;
  readonly input: PhysicsSpawnDescriptor | undefined;
  readonly diagnostics?: SystemDiagnostics;
}

type PhysicsSpawnComponentName =
  | "rigidBody"
  | "collider"
  | "characterController"
  | "joint";

interface PhysicsSpawnComponentInputByName {
  readonly rigidBody: RigidBodyInput;
  readonly collider: ColliderInput;
  readonly characterController: PhysicsCharacterControllerInput;
  readonly joint: PhysicsJointInput;
}

export function applyPhysicsSpawnDescriptor(
  options: ApplyPhysicsSpawnDescriptorOptions,
): void {
  const { world, entity, input, diagnostics } = options;

  if (input === undefined) {
    return;
  }

  registerPhysicsComponents(world);

  if (input.rigidBody !== undefined) {
    const rigidBody = componentInput(input.rigidBody);

    if (validateComponent("rigidBody", rigidBody, diagnostics)) {
      entity.addComponent(RigidBody, createRigidBody(rigidBody));
    }
  }

  if (input.collider !== undefined) {
    const collider = componentInput(input.collider);

    if (validateComponent("collider", collider, diagnostics)) {
      entity.addComponent(Collider, createCollider(collider));
    }
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
    const characterController = componentInput(input.characterController);

    if (
      validateComponent("characterController", characterController, diagnostics)
    ) {
      entity.addComponent(
        PhysicsCharacterController,
        createPhysicsCharacterController(characterController),
      );
    }
  }

  if (input.material !== undefined) {
    entity.addComponent(
      PhysicsMaterial,
      createPhysicsMaterial(componentInput(input.material)),
    );
  }

  if (input.joint !== undefined) {
    const joint = componentInput(input.joint);

    if (validateComponent("joint", joint, diagnostics)) {
      entity.addComponent(PhysicsJoint, createPhysicsJoint(joint));
    }
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

function validateComponent<TComponent extends PhysicsSpawnComponentName>(
  component: TComponent,
  input: PhysicsSpawnComponentInputByName[TComponent],
  diagnostics: SystemDiagnostics | undefined,
): boolean {
  const validationDiagnostics = physicsValidationDiagnostics(component, input);

  if (validationDiagnostics.length === 0) {
    return true;
  }

  for (const validationDiagnostic of validationDiagnostics) {
    diagnostics?.error(validationDiagnostic.code, {
      component,
      message: validationDiagnostic.message,
      ...(validationDiagnostic.data === undefined
        ? {}
        : { details: validationDiagnostic.data }),
    });
  }

  return false;
}

function physicsValidationDiagnostics<
  TComponent extends PhysicsSpawnComponentName,
>(
  component: TComponent,
  input: PhysicsSpawnComponentInputByName[TComponent],
): readonly PhysicsValidationDiagnostic[] {
  switch (component) {
    case "rigidBody":
      return validateRigidBodyInput(input);
    case "collider":
      return validateColliderInput(input);
    case "characterController":
      return validatePhysicsCharacterControllerInput(input);
    case "joint":
      return validatePhysicsJointInput(input);
  }
}
