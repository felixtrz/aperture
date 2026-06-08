import { describe, expect, it } from "vitest";
import {
  Collider,
  PhysicsRigidBodyType,
  RigidBody,
  collectPhysicsCommands,
  collectUnsupportedPhysicsCommandFeatures,
  createCollider,
  createRigidBody,
  isColliderScaleApproximated,
  isNonUnitScale,
  registerPhysicsComponents,
  scaleColliderShape,
  type PhysicsColliderDescriptor,
  type PhysicsShape,
  type PhysicsVec3,
} from "@aperture-engine/physics";
import {
  LocalTransform,
  createLocalTransform,
  createWorld,
} from "@aperture-engine/simulation";

function colliderDescriptorFor(
  shape: PhysicsShape,
  scale: PhysicsVec3,
): PhysicsColliderDescriptor {
  const world = createWorld({ entityCapacity: 2 });
  registerPhysicsComponents(world);
  world.registerComponent(LocalTransform);

  const body = world.createEntity();
  body.addComponent(LocalTransform, createLocalTransform({ scale }));
  body.addComponent(
    RigidBody,
    createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
  );
  body.addComponent(Collider, createCollider({ shape }));

  const command = collectPhysicsCommands(world).commands.find(
    (entry) => entry.kind === "upsertBody",
  );

  if (command === undefined || command.collider === undefined) {
    throw new Error("expected an upsertBody command with a collider");
  }

  return command.collider;
}

function scaleFeatureCodesFor(
  shape: PhysicsShape,
  scale: PhysicsVec3,
): string[] {
  const world = createWorld({ entityCapacity: 2 });
  registerPhysicsComponents(world);
  world.registerComponent(LocalTransform);

  const body = world.createEntity();
  body.addComponent(LocalTransform, createLocalTransform({ scale }));
  body.addComponent(
    RigidBody,
    createRigidBody({ type: PhysicsRigidBodyType.Dynamic }),
  );
  body.addComponent(Collider, createCollider({ shape }));

  return collectUnsupportedPhysicsCommandFeatures(
    "rapier",
    collectPhysicsCommands(world),
  ).map((feature) => feature.code);
}

describe("collider scale baking (ecs-sync)", () => {
  it("bakes non-unit scale into box half-extents per axis and records the scale", () => {
    const collider = colliderDescriptorFor(
      { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
      [2, 3, 4],
    );

    expect(collider.shape).toEqual({
      kind: "box",
      halfExtents: [1, 1.5, 2],
    });
    expect(collider.scale).toEqual([2, 3, 4]);
  });

  it("scales a sphere by the largest axis under non-uniform scale", () => {
    const collider = colliderDescriptorFor(
      { kind: "sphere", radius: 1 },
      [1, 2, 3],
    );

    expect(collider.shape).toEqual({ kind: "sphere", radius: 3 });
  });

  it("scales a capsule radius (radial) and halfHeight (axial) for the Y axis", () => {
    const collider = colliderDescriptorFor(
      { kind: "capsule", radius: 1, halfHeight: 2, axis: "y" },
      [3, 5, 3],
    );

    expect(collider.shape).toMatchObject({
      kind: "capsule",
      radius: 3,
      halfHeight: 10,
    });
  });

  it("leaves unit-scale primitive descriptors byte-identical (no scale field)", () => {
    const collider = colliderDescriptorFor(
      { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
      [1, 1, 1],
    );

    expect(collider.shape).toEqual({
      kind: "box",
      halfExtents: [0.5, 0.5, 0.5],
    });
    expect(collider.scale).toBeUndefined();
  });
});

describe("collider scale diagnostics (backend)", () => {
  it("emits no diagnostic for exact box scale", () => {
    expect(
      scaleFeatureCodesFor(
        { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
        [2, 3, 4],
      ),
    ).toEqual([]);
  });

  it("emits no diagnostic for uniform sphere scale", () => {
    expect(
      scaleFeatureCodesFor({ kind: "sphere", radius: 1 }, [2, 2, 2]),
    ).toEqual([]);
  });

  it("flags a non-uniform sphere scale as approximated", () => {
    expect(
      scaleFeatureCodesFor({ kind: "sphere", radius: 1 }, [1, 2, 3]),
    ).toContain("physics.collider.scale.approximated");
  });

  it("flags a capsule with non-uniform radial scale", () => {
    expect(
      scaleFeatureCodesFor(
        { kind: "capsule", radius: 1, halfHeight: 2, axis: "y" },
        [3, 5, 4],
      ),
    ).toContain("physics.collider.scale.approximated");
  });

  it("does not flag a capsule with uniform radial scale", () => {
    expect(
      scaleFeatureCodesFor(
        { kind: "capsule", radius: 1, halfHeight: 2, axis: "y" },
        [3, 5, 3],
      ),
    ).toEqual([]);
  });
});

describe("scaleColliderShape (pure)", () => {
  it("scales box half-extents per axis", () => {
    expect(
      scaleColliderShape({ kind: "box", halfExtents: [1, 2, 3] }, [2, 2, 2]),
    ).toEqual({ kind: "box", halfExtents: [2, 4, 6] });
  });

  it("uses the X component as the capsule's axial scale when axis is x", () => {
    expect(
      scaleColliderShape(
        { kind: "capsule", radius: 1, halfHeight: 2, axis: "x" },
        [5, 3, 3],
      ),
    ).toMatchObject({ radius: 3, halfHeight: 10 });
  });

  it("uses scale magnitude (negative scale mirrors, dimensions stay positive)", () => {
    expect(
      scaleColliderShape({ kind: "box", halfExtents: [1, 1, 1] }, [-2, 1, 1]),
    ).toEqual({ kind: "box", halfExtents: [2, 1, 1] });
  });

  it("leaves asset shapes unchanged", () => {
    const shape: PhysicsShape = { kind: "trimesh", meshId: "mesh:level" };

    expect(scaleColliderShape(shape, [2, 3, 4])).toBe(shape);
  });
});

describe("isColliderScaleApproximated / isNonUnitScale (pure)", () => {
  it("box is always exact", () => {
    expect(
      isColliderScaleApproximated(
        { kind: "box", halfExtents: [1, 1, 1] },
        [1, 2, 3],
      ),
    ).toBe(false);
  });

  it("sphere is exact only under uniform scale", () => {
    const sphere: PhysicsShape = { kind: "sphere", radius: 1 };

    expect(isColliderScaleApproximated(sphere, [2, 2, 2])).toBe(false);
    expect(isColliderScaleApproximated(sphere, [2, 2, 3])).toBe(true);
  });

  it("capsule is exact only when its radial axes scale uniformly", () => {
    const capsule: PhysicsShape = {
      kind: "capsule",
      radius: 1,
      halfHeight: 2,
      axis: "y",
    };

    expect(isColliderScaleApproximated(capsule, [3, 9, 3])).toBe(false);
    expect(isColliderScaleApproximated(capsule, [3, 9, 4])).toBe(true);
  });

  it("detects non-unit scale within epsilon", () => {
    expect(isNonUnitScale([1, 1, 1])).toBe(false);
    expect(isNonUnitScale([1, 1, 1.5])).toBe(true);
  });
});
