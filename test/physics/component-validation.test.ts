import { describe, expect, it } from "vitest";
import {
  createPhysicsCharacterController,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsRigidBodyType,
  validateColliderInput,
  validatePhysicsCharacterControllerInput,
  validatePhysicsCharacterMove,
  validatePhysicsJointInput,
  validateRigidBodyInput,
} from "@aperture-engine/physics";

describe("physics component validation", () => {
  it("accepts valid primitive collider data", () => {
    expect(
      validateColliderInput({
        shape: { kind: "capsule", radius: 0.25, halfHeight: 1 },
        density: 1,
        friction: 0.5,
        restitution: 0,
        collisionGroups: -1,
      }),
    ).toEqual([]);
  });

  it("diagnoses invalid collider dimensions and missing mesh ids", () => {
    const diagnostics = validateColliderInput({
      shape: { kind: "box", halfExtents: [1, 0, Number.NaN] },
      density: -1,
      collisionGroups: 2.5,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aperture.physics.collider.invalidHalfExtent",
      "aperture.physics.collider.invalidHalfExtent",
      "aperture.physics.invalid.density",
      "aperture.physics.invalid.collisionGroups",
    ]);

    expect(
      validateColliderInput({ shape: { kind: "trimesh", meshId: "" } }).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["aperture.physics.invalid.meshId"]);
  });

  it("diagnoses invalid rigid body scalars", () => {
    const diagnostics = validateRigidBodyInput({
      type: PhysicsRigidBodyType.Dynamic,
      gravityScale: Number.POSITIVE_INFINITY,
      linearDamping: -0.1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aperture.physics.invalid.gravityScale",
      "aperture.physics.invalid.linearDamping",
    ]);
  });

  it("diagnoses invalid joint frames and scalars", () => {
    expect(
      validatePhysicsJointInput({
        frameA: [0, 0.70710677, 0, 0.70710677],
        frameB: [0.70710677, 0, 0, 0.70710677],
        axis: [0, 1, 0],
        minLimit: -1,
        maxLimit: 1,
        motorFactor: 2,
        motorMaxForce: 10,
      }),
    ).toEqual([]);

    const diagnostics = validatePhysicsJointInput({
      anchorA: [0, Number.NaN, 0],
      frameA: [0, 0, 0, 0],
      frameB: [0, 2, 0, 0],
      minLimit: 2,
      maxLimit: 1,
      motorFactor: -1,
      motorMaxForce: -2,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aperture.physics.invalid.anchorA",
      "aperture.physics.joint.invalid.frameA",
      "aperture.physics.joint.nonUnit.frameB",
      "aperture.physics.invalid.motorFactor",
      "aperture.physics.invalid.motorMaxForce",
      "aperture.physics.joint.invalidLimitRange",
    ]);
  });

  it("diagnoses invalid character movement settings", () => {
    const diagnostics = validatePhysicsCharacterMove({
      entity: "",
      desiredTranslation: [1, Number.NaN, 0],
      settings: {
        offset: 0,
        snapToGroundDistance: -0.1,
        autostep: {
          maxHeight: -1,
          minWidth: 0,
        },
        characterMass: -1,
      },
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aperture.physics.invalid.entity",
      "aperture.physics.invalid.desiredTranslation",
      "aperture.physics.invalid.offset",
      "aperture.physics.invalid.snapToGroundDistance",
      "aperture.physics.invalid.characterMass",
      "aperture.physics.invalid.autostep.maxHeight",
      "aperture.physics.invalid.autostep.minWidth",
    ]);
  });

  it("creates and validates durable character controller authoring", () => {
    expect(
      validatePhysicsCharacterControllerInput({
        offset: 0.02,
        up: [0, 1, 0],
        snapToGroundDistance: 0.1,
        autostep: {
          maxHeight: 0.35,
          minWidth: 0.2,
          includeDynamicBodies: true,
        },
        characterMass: null,
      }),
    ).toEqual([]);

    const data = createPhysicsCharacterController({
      snapToGroundDistance: 0.1,
      autostep: { maxHeight: 0.35, minWidth: 0.2 },
      characterMass: null,
    });

    expect(PhysicsCharacterController.id).toBe(
      "aperture.physics.characterController",
    );
    expect(data.snapToGroundDistance).toBe(0.1);
    expect(data.autostepEnabled).toBe(true);
    expect(data.autostepMaxHeight).toBe(0.35);
    expect(data.autostepMinWidth).toBe(0.2);
    expect(data.characterMassMode).toBe(PhysicsCharacterMassMode.Disabled);
  });
});
