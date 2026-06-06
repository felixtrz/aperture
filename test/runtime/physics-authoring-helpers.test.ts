import { describe, expect, it } from "vitest";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsColliderAxis,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  createSimulationApp,
  withCollider,
  withExternalForce,
  withExternalImpulse,
  withKinematicTarget,
  withPhysicsCharacterController,
  withPhysicsDebug,
  withPhysicsGravity,
  withPhysicsJoint,
  withPhysicsMaterial,
  withPhysicsVelocity,
  withRigidBody,
} from "@aperture-engine/runtime";

describe("runtime physics authoring helpers", () => {
  it("registers and attaches physics body, collider, motion, material, and debug components", () => {
    const app = createSimulationApp();
    const body = app.spawn(
      withRigidBody({
        type: PhysicsRigidBodyType.KinematicPosition,
        gravityScale: 0,
        linearDamping: 0.25,
        angularDamping: 0.5,
        ccdEnabled: true,
        lockRotationZ: true,
      }),
      withCollider({
        shape: {
          kind: "capsule",
          radius: 0.25,
          halfHeight: 1.5,
          axis: PhysicsColliderAxis.Z,
        },
        offsetTranslation: [1, 2, 3],
        offsetRotation: [0, 0, 0, 1],
        sensor: true,
        density: 2,
        friction: 0.75,
        restitution: 0.15,
        collisionGroups: 7,
        solverGroups: 11,
      }),
      withPhysicsVelocity({
        linear: [1, 2, 3],
        angular: [4, 5, 6],
      }),
      withExternalForce({
        force: [7, 8, 9],
        torque: [1, 0, 0],
      }),
      withExternalImpulse({
        impulse: [0, 2, 0],
        angularImpulse: [0, 0.5, 0],
      }),
      withKinematicTarget({
        translation: [3, 2, 1],
        rotation: [0, 0, 0, 1],
      }),
      withPhysicsGravity({
        gravity: [0, -3, 0],
      }),
      withPhysicsCharacterController({
        offset: 0.02,
        snapToGroundDistance: 0.05,
        autostep: { maxHeight: 0.2, minWidth: 0.1 },
        characterMass: null,
      }),
      withPhysicsMaterial({
        friction: 0.9,
        restitution: 0.2,
        density: 3,
        frictionCombine: PhysicsMaterialCombineRule.Multiply,
        restitutionCombine: PhysicsMaterialCombineRule.Max,
      }),
      withPhysicsDebug({
        colliderWireframes: true,
        contactNormals: true,
        bodyStateMarkers: true,
      }),
    );

    expect(body.hasComponent(RigidBody)).toBe(true);
    expect(body.getValue(RigidBody, "type")).toBe(
      PhysicsRigidBodyType.KinematicPosition,
    );
    expect(body.getValue(RigidBody, "gravityScale")).toBe(0);
    expect(body.getValue(RigidBody, "ccdEnabled")).toBe(true);
    expect(body.getValue(RigidBody, "lockRotationZ")).toBe(true);

    expect(body.hasComponent(Collider)).toBe(true);
    expect(body.getValue(Collider, "shapeKind")).toBe("capsule");
    expect(body.getValue(Collider, "axis")).toBe(PhysicsColliderAxis.Z);
    expect(body.getValue(Collider, "radius")).toBe(0.25);
    expect(body.getValue(Collider, "halfHeight")).toBe(1.5);
    expect(
      Array.from(body.getVectorView(Collider, "offsetTranslation")),
    ).toEqual([1, 2, 3]);
    expect(body.getValue(Collider, "sensor")).toBe(true);
    expect(body.getValue(Collider, "collisionGroups")).toBe(7);
    expect(body.getValue(Collider, "solverGroups")).toBe(11);

    expect(Array.from(body.getVectorView(PhysicsVelocity, "linear"))).toEqual([
      1, 2, 3,
    ]);
    expect(Array.from(body.getVectorView(PhysicsVelocity, "angular"))).toEqual([
      4, 5, 6,
    ]);
    expect(Array.from(body.getVectorView(ExternalForce, "force"))).toEqual([
      7, 8, 9,
    ]);
    expect(Array.from(body.getVectorView(ExternalForce, "torque"))).toEqual([
      1, 0, 0,
    ]);
    expect(Array.from(body.getVectorView(ExternalImpulse, "impulse"))).toEqual([
      0, 2, 0,
    ]);
    expect(
      Array.from(body.getVectorView(ExternalImpulse, "angularImpulse")),
    ).toEqual([0, 0.5, 0]);
    expect(
      Array.from(body.getVectorView(KinematicTarget, "translation")),
    ).toEqual([3, 2, 1]);
    expect(Array.from(body.getVectorView(PhysicsGravity, "gravity"))).toEqual([
      0, -3, 0,
    ]);
    expect(body.getValue(PhysicsCharacterController, "offset")).toBeCloseTo(
      0.02,
    );
    expect(
      body.getValue(PhysicsCharacterController, "snapToGroundDistance"),
    ).toBeCloseTo(0.05);
    expect(body.getValue(PhysicsCharacterController, "autostepEnabled")).toBe(
      true,
    );
    expect(body.getValue(PhysicsCharacterController, "characterMassMode")).toBe(
      PhysicsCharacterMassMode.Disabled,
    );

    expect(body.getValue(PhysicsMaterial, "friction")).toBeCloseTo(0.9);
    expect(body.getValue(PhysicsMaterial, "restitution")).toBeCloseTo(0.2);
    expect(body.getValue(PhysicsMaterial, "frictionCombine")).toBe(
      PhysicsMaterialCombineRule.Multiply,
    );
    expect(body.getValue(PhysicsMaterial, "restitutionCombine")).toBe(
      PhysicsMaterialCombineRule.Max,
    );
    expect(body.getValue(PhysicsDebug, "colliderWireframes")).toBe(true);
    expect(body.getValue(PhysicsDebug, "contactNormals")).toBe(true);
    expect(body.getValue(PhysicsDebug, "bodyStateMarkers")).toBe(true);
    expect(body.getValue(PhysicsDebug, "jointFrames")).toBe(false);
  });

  it("authors joint components through the runtime barrel", () => {
    const app = createSimulationApp();
    const joint = app.spawn(
      withPhysicsJoint({
        kind: PhysicsJointKind.Distance,
        bodyARef: "1:0",
        bodyBRef: "2:0",
        anchorA: [0, 1, 0],
        anchorB: [0, -1, 0],
        frameA: [0, 0.70710677, 0, 0.70710677],
        frameB: [0.70710677, 0, 0, 0.70710677],
        axis: [1, 0, 0],
        minLimit: 0.25,
        maxLimit: 2,
        motorMode: PhysicsJointMotorMode.Velocity,
        motorModel: PhysicsJointMotorModel.Force,
        motorVelocity: 0.75,
        motorFactor: 4,
        motorMaxForce: 20,
        contactsEnabled: false,
        breakForce: 100,
      }),
    );

    expect(joint.hasComponent(PhysicsJoint)).toBe(true);
    expect(joint.getValue(PhysicsJoint, "kind")).toBe(
      PhysicsJointKind.Distance,
    );
    expect(joint.getValue(PhysicsJoint, "bodyARef")).toBe("1:0");
    expect(joint.getValue(PhysicsJoint, "bodyBRef")).toBe("2:0");
    expect(Array.from(joint.getVectorView(PhysicsJoint, "anchorA"))).toEqual([
      0, 1, 0,
    ]);
    expectVectorClose(
      joint.getVectorView(PhysicsJoint, "frameA"),
      [0, 0.70710677, 0, 0.70710677],
    );
    expectVectorClose(
      joint.getVectorView(PhysicsJoint, "frameB"),
      [0.70710677, 0, 0, 0.70710677],
    );
    expect(Array.from(joint.getVectorView(PhysicsJoint, "axis"))).toEqual([
      1, 0, 0,
    ]);
    expect(joint.getValue(PhysicsJoint, "minLimit")).toBe(0.25);
    expect(joint.getValue(PhysicsJoint, "motorMode")).toBe(
      PhysicsJointMotorMode.Velocity,
    );
    expect(joint.getValue(PhysicsJoint, "motorModel")).toBe(
      PhysicsJointMotorModel.Force,
    );
    expect(joint.getValue(PhysicsJoint, "motorVelocity")).toBe(0.75);
    expect(joint.getValue(PhysicsJoint, "motorFactor")).toBe(4);
    expect(joint.getValue(PhysicsJoint, "motorMaxForce")).toBe(20);
    expect(joint.getValue(PhysicsJoint, "contactsEnabled")).toBe(false);
    expect(joint.getValue(PhysicsJoint, "breakForce")).toBe(100);
  });
});

function expectVectorClose(
  actual: ArrayLike<number>,
  expected: readonly number[],
): void {
  const values = Array.from(actual);
  expect(values).toHaveLength(expected.length);
  for (const [index, value] of values.entries()) {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN);
  }
}
