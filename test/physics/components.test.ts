import { describe, expect, it } from "vitest";
import {
  createComponentRegistry,
  createWorld,
  deserializeEntityComponents,
  serializeEntityComponents,
} from "@aperture-engine/simulation";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsBodyState,
  PhysicsColliderShapeKind,
  PhysicsJoint,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  createCollider,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsBodyState,
  createPhysicsJoint,
  createPhysicsMaterial,
  createPhysicsVelocity,
  createRigidBody,
  registerPhysicsComponents,
} from "@aperture-engine/physics";

describe("physics ECS components", () => {
  it("registers and stores backend-neutral rigid body and collider authoring", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);

    const query = world.queryManager.registerQuery({
      required: [RigidBody, Collider],
    });
    const entity = world.createEntity();

    entity.addComponent(
      RigidBody,
      createRigidBody({
        type: PhysicsRigidBodyType.KinematicPosition,
        gravityScale: 0,
        linearDamping: 0.25,
        lockRotationX: true,
      }),
    );
    entity.addComponent(
      Collider,
      createCollider({
        shape: { kind: "sphere", radius: 1.25 },
        offsetTranslation: [0, 2, 0],
        sensor: true,
        collisionGroups: 0xff00,
      }),
    );

    expect(query.entities.has(entity)).toBe(true);
    expect(entity.getValue(RigidBody, "type")).toBe("kinematicPosition");
    expect(entity.getValue(RigidBody, "gravityScale")).toBe(0);
    expect(entity.getValue(RigidBody, "lockRotationX")).toBe(true);
    expect(entity.getValue(Collider, "shapeKind")).toBe(
      PhysicsColliderShapeKind.Sphere,
    );
    expect(entity.getValue(Collider, "radius")).toBe(1.25);
    expect(entity.getValue(Collider, "sensor")).toBe(true);
    expect(entity.getValue(Collider, "collisionGroups")).toBe(0xff00);
    expectVector(
      entity.getVectorView(Collider, "offsetTranslation"),
      [0, 2, 0],
    );
  });

  it("creates physics command/material/joint component data with JSON-safe fields", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    const entity = world.createEntity();

    entity.addComponent(
      PhysicsVelocity,
      createPhysicsVelocity({ linear: [1, 2, 3], angular: [0, 1, 0] }),
    );
    entity.addComponent(
      ExternalForce,
      createExternalForce({ force: [0, -9.8, 0], torque: [0, 0, 1] }),
    );
    entity.addComponent(
      ExternalImpulse,
      createExternalImpulse({ impulse: [5, 0, 0], angularImpulse: [0, 2, 0] }),
    );
    entity.addComponent(
      KinematicTarget,
      createKinematicTarget({ translation: [3, 4, 5] }),
    );
    entity.addComponent(
      PhysicsMaterial,
      createPhysicsMaterial({
        friction: 0.7,
        restitution: 0.2,
        frictionCombine: PhysicsMaterialCombineRule.Max,
      }),
    );
    entity.addComponent(
      PhysicsJoint,
      createPhysicsJoint({
        kind: "revolute",
        bodyARef: "1:0",
        bodyBRef: "2:0",
        frameA: [0, 0.70710677, 0, 0.70710677],
        frameB: [0.70710677, 0, 0, 0.70710677],
        axis: [0, 1, 0],
        motorMode: PhysicsJointMotorMode.Velocity,
        motorModel: PhysicsJointMotorModel.Force,
        motorVelocity: 0.5,
        motorFactor: 3,
        motorMaxForce: 12,
        contactsEnabled: false,
      }),
    );

    expectVector(entity.getVectorView(PhysicsVelocity, "linear"), [1, 2, 3]);
    expectVector(entity.getVectorView(ExternalForce, "force"), [0, -9.8, 0]);
    expectVector(entity.getVectorView(ExternalImpulse, "impulse"), [5, 0, 0]);
    expectVector(
      entity.getVectorView(KinematicTarget, "translation"),
      [3, 4, 5],
    );
    expect(entity.getValue(PhysicsMaterial, "frictionCombine")).toBe("max");
    expect(entity.getValue(PhysicsJoint, "bodyARef")).toBe("1:0");
    expect(entity.getValue(PhysicsJoint, "kind")).toBe("revolute");
    expect(entity.getValue(PhysicsJoint, "motorMaxForce")).toBe(12);
    expectVector(
      entity.getVectorView(PhysicsJoint, "frameA"),
      [0, 0.70710677, 0, 0.70710677],
    );
    expectVector(
      entity.getVectorView(PhysicsJoint, "frameB"),
      [0.70710677, 0, 0, 0.70710677],
    );
    expect(entity.getValue(PhysicsJoint, "motorMode")).toBe("velocity");
    expect(entity.getValue(PhysicsJoint, "motorModel")).toBe("force");
    expect(entity.getValue(PhysicsJoint, "motorVelocity")).toBe(0.5);
    expect(entity.getValue(PhysicsJoint, "motorFactor")).toBe(3);
    expect(entity.getValue(PhysicsJoint, "contactsEnabled")).toBe(false);

    const serialized = serializeEntityComponents(entity);
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it("round-trips physics authoring while excluding derived body state", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerPhysicsComponents(world);
    const source = world.createEntity();
    source.addComponent(
      RigidBody,
      createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
    );
    source.addComponent(
      Collider,
      createCollider({ shape: { kind: "box", halfExtents: [1, 2, 3] } }),
    );
    source.addComponent(
      PhysicsBodyState,
      createPhysicsBodyState({
        backendBodyId: "rapier:handle:123",
        currentTranslation: [9, 9, 9],
      }),
    );

    const serialized = serializeEntityComponents(source);
    expect(serialized.map((entry) => entry.id)).toContain(RigidBody.id);
    expect(serialized.map((entry) => entry.id)).toContain(Collider.id);
    expect(serialized.map((entry) => entry.id)).not.toContain(
      PhysicsBodyState.id,
    );

    const target = world.createEntity();
    const result = deserializeEntityComponents(target, serialized, {
      registry: createComponentRegistry([
        RigidBody,
        Collider,
        PhysicsBodyState,
      ]),
    });
    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    expect(target.getValue(RigidBody, "type")).toBe("dynamic");
    expect(target.hasComponent(PhysicsBodyState)).toBe(false);
    expectVector(target.getVectorView(Collider, "halfExtents"), [1, 2, 3]);
  });
});

function expectVector(
  actual: ArrayLike<number>,
  expected: readonly number[],
): void {
  const values = Array.from(actual);
  expect(values).toHaveLength(expected.length);
  for (const [index, value] of values.entries()) {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN);
  }
}
