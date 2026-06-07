import { describe, expect, it } from "vitest";
import {
  Collider,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsDebug,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
} from "@aperture-engine/physics";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import {
  createSystem,
  material,
  mesh,
  physics as physicsDescriptor,
} from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import {
  APERTURE_SCENE_FORMAT_VERSION,
  Name,
  getChildren,
  serializeEntityComponents,
  serializeEntityRef,
  setParent,
  type ApertureSceneDocument,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

const SetupSystem: ApertureSystemModule = {
  default: class PhysicsAuthoringSetupSystem extends createSystem({
    priority: 0,
  }) {},
};

function buildPrefabFromTemplate(template: Entity): ApertureSceneDocument {
  return {
    formatVersion: APERTURE_SCENE_FORMAT_VERSION,
    entities: [
      {
        id: serializeEntityRef(template),
        components: serializeEntityComponents(template),
      },
    ],
  };
}

describe("app physics authoring descriptors", () => {
  it("adds physics components to mesh spawns and preserves them through prefab serialization", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [SetupSystem],
    });
    const context = runner.app.context;
    const template = context.spawn.mesh({
      key: "physics.template",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({ baseColor: [0.2, 0.7, 0.9, 1] }),
      transform: { translation: [0, 1, 0] },
      physics: physicsDescriptor.body({
        rigidBody: physicsDescriptor.rigidBody({
          type: PhysicsRigidBodyType.Dynamic,
          linearDamping: 0.2,
        }),
        collider: physicsDescriptor.collider({
          shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
          friction: 0.8,
          restitution: 0.1,
        }),
        velocity: physicsDescriptor.velocity({
          linear: [1, 2, 3],
        }),
        material: physicsDescriptor.material({
          friction: 0.4,
          restitution: 0.2,
          density: 2,
          frictionCombine: PhysicsMaterialCombineRule.Max,
        }),
        characterController: physicsDescriptor.characterController({
          snapToGroundDistance: 0.05,
          autostep: { maxHeight: 0.2, minWidth: 0.1 },
          characterMass: null,
        }),
      }),
    });

    expect(template.hasComponent(RigidBody)).toBe(true);
    expect(template.getValue(RigidBody, "type")).toBe(
      PhysicsRigidBodyType.Dynamic,
    );
    expect(template.getValue(Collider, "shapeKind")).toBe("box");
    expect(template.getValue(Collider, "friction")).toBeCloseTo(0.8);
    expect(
      Array.from(template.getVectorView(PhysicsVelocity, "linear")),
    ).toEqual([1, 2, 3]);
    expect(template.hasComponent(PhysicsMaterial)).toBe(true);
    expect(template.getValue(PhysicsMaterial, "friction")).toBeCloseTo(0.4);
    expect(template.getValue(PhysicsMaterial, "frictionCombine")).toBe(
      PhysicsMaterialCombineRule.Max,
    );
    expect(template.hasComponent(PhysicsCharacterController)).toBe(true);
    expect(
      template.getValue(PhysicsCharacterController, "snapToGroundDistance"),
    ).toBeCloseTo(0.05);
    expect(
      template.getValue(PhysicsCharacterController, "autostepEnabled"),
    ).toBe(true);
    expect(
      template.getValue(PhysicsCharacterController, "characterMassMode"),
    ).toBe(PhysicsCharacterMassMode.Disabled);

    const document = buildPrefabFromTemplate(template);
    const componentIds = document.entities[0]!.components.map(
      (component) => component.id,
    );

    expect(componentIds).toContain(RigidBody.id);
    expect(componentIds).toContain(Collider.id);
    expect(componentIds).toContain(PhysicsVelocity.id);
    expect(componentIds).toContain(PhysicsMaterial.id);
    expect(componentIds).toContain(PhysicsCharacterController.id);

    template.destroy();

    const handle = context.prefabs.register(document);
    const instance = context.spawn.prefab(handle, {
      key: "physics.instance",
      transform: { translation: [2, 3, 4] },
    });

    expect(instance.hasComponent(RigidBody)).toBe(true);
    expect(instance.getValue(RigidBody, "type")).toBe(
      PhysicsRigidBodyType.Dynamic,
    );
    expect(instance.getValue(Collider, "friction")).toBeCloseTo(0.8);
    expect(
      Array.from(instance.getVectorView(PhysicsVelocity, "linear")),
    ).toEqual([1, 2, 3]);
    expect(instance.hasComponent(PhysicsMaterial)).toBe(true);
    expect(instance.getValue(PhysicsMaterial, "friction")).toBeCloseTo(0.4);
    expect(instance.hasComponent(PhysicsCharacterController)).toBe(true);
    expect(
      instance.getValue(PhysicsCharacterController, "snapToGroundDistance"),
    ).toBeCloseTo(0.05);
  });

  it("spawns non-render physics entities for joints and debug flags", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [SetupSystem],
    });
    const context = runner.app.context;
    const joint = context.spawn.physics({
      key: "physics.joint",
      physics: {
        joint: physicsDescriptor.joint({
          kind: PhysicsJointKind.Distance,
          bodyARef: "1:0",
          bodyBRef: "2:0",
          minLimit: 0.5,
          maxLimit: 2,
        }),
        debug: true,
      },
    });

    expect(joint.hasComponent(PhysicsJoint)).toBe(true);
    expect(joint.getValue(PhysicsJoint, "kind")).toBe(
      PhysicsJointKind.Distance,
    );
    expect(joint.getValue(PhysicsJoint, "bodyARef")).toBe("1:0");
    expect(joint.getValue(PhysicsJoint, "maxLimit")).toBe(2);
    expect(joint.hasComponent(PhysicsDebug)).toBe(true);
    expect(joint.getValue(PhysicsDebug, "colliderWireframes")).toBe(false);
    expect(joint.getValue(PhysicsDebug, "bodyStateMarkers")).toBe(false);
  });

  it("diagnoses invalid spawn physics descriptors and skips only invalid components", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [SetupSystem],
    });
    const context = runner.app.context;
    const entity = context.spawn.physics({
      key: "physics.invalid.descriptors",
      physics: {
        rigidBody: physicsDescriptor.rigidBody({
          type: PhysicsRigidBodyType.Dynamic,
        }),
        collider: physicsDescriptor.collider({
          shape: { kind: "sphere", radius: 0 },
          density: -1,
        }),
        characterController: physicsDescriptor.characterController({
          offset: 0,
          autostep: { maxHeight: -1, minWidth: 0 },
          characterMass: -1,
        }),
        material: physicsDescriptor.material({ density: 2 }),
        joint: physicsDescriptor.joint({
          kind: PhysicsJointKind.Distance,
          anchorA: [0, Number.NaN, 0],
          frameA: [0, 0, 0, 0],
          minLimit: 2,
          maxLimit: 1,
        }),
        debug: true,
      },
    });

    expect(entity.hasComponent(RigidBody)).toBe(true);
    expect(entity.hasComponent(Collider)).toBe(false);
    expect(entity.hasComponent(PhysicsCharacterController)).toBe(false);
    expect(entity.hasComponent(PhysicsJoint)).toBe(false);
    expect(entity.hasComponent(PhysicsMaterial)).toBe(true);
    expect(entity.hasComponent(PhysicsDebug)).toBe(true);

    expect(context.diagnostics.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.invalid.radius",
          data: expect.objectContaining({
            component: "collider",
            message: "radius must be a positive finite number.",
          }),
        }),
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.invalid.density",
          data: expect.objectContaining({
            component: "collider",
          }),
        }),
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.invalid.offset",
          data: expect.objectContaining({
            component: "characterController",
          }),
        }),
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.invalid.autostep.maxHeight",
          data: expect.objectContaining({
            component: "characterController",
          }),
        }),
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.invalid.anchorA",
          data: expect.objectContaining({
            component: "joint",
          }),
        }),
        expect.objectContaining({
          severity: "error",
          code: "aperture.physics.joint.invalidLimitRange",
          data: expect.objectContaining({
            component: "joint",
          }),
        }),
      ]),
    );
  });

  it("remaps physics joint body refs when spawning prefab clones", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [SetupSystem],
    });
    const context = runner.app.context;
    const world = runner.app.lowLevel.world;
    const anchor = context.spawn.physics({
      name: "physics.prefab.anchor",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: physicsDescriptor.rigidBody({
          type: PhysicsRigidBodyType.Static,
        }),
        collider: physicsDescriptor.collider({
          shape: { kind: "sphere", radius: 0.25 },
        }),
      },
    });
    const bob = context.spawn.physics({
      name: "physics.prefab.bob",
      transform: { translation: [0, 1, 0] },
      physics: {
        rigidBody: physicsDescriptor.rigidBody({
          type: PhysicsRigidBodyType.Dynamic,
        }),
        collider: physicsDescriptor.collider({
          shape: { kind: "sphere", radius: 0.25 },
        }),
      },
    });
    const joint = context.spawn.physics({
      name: "physics.prefab.joint",
      physics: {
        joint: physicsDescriptor.joint({
          kind: PhysicsJointKind.Distance,
          bodyARef: serializeEntityRef(anchor),
          bodyBRef: serializeEntityRef(bob),
          maxLimit: 1.25,
        }),
      },
    });
    setParent(world, bob, anchor);
    setParent(world, joint, anchor);

    const document: ApertureSceneDocument = {
      formatVersion: APERTURE_SCENE_FORMAT_VERSION,
      entities: [anchor, bob, joint].map((entity) => ({
        id: serializeEntityRef(entity),
        components: serializeEntityComponents(entity),
      })),
    };
    anchor.destroy();
    bob.destroy();
    joint.destroy();

    const handle = context.prefabs.register(document);
    const firstRoot = context.spawn.prefab(handle, {
      key: "physics.prefab.first",
    });
    const secondRoot = context.spawn.prefab(handle, {
      key: "physics.prefab.second",
    });
    const first = prefabEntitiesByName(world, firstRoot);
    const second = prefabEntitiesByName(world, secondRoot);
    const firstJoint = first.get("physics.prefab.joint")!;
    const secondJoint = second.get("physics.prefab.joint")!;

    expect(firstJoint.getValue(PhysicsJoint, "bodyARef")).toBe(
      serializeEntityRef(first.get("physics.prefab.anchor")!),
    );
    expect(firstJoint.getValue(PhysicsJoint, "bodyBRef")).toBe(
      serializeEntityRef(first.get("physics.prefab.bob")!),
    );
    expect(secondJoint.getValue(PhysicsJoint, "bodyARef")).toBe(
      serializeEntityRef(second.get("physics.prefab.anchor")!),
    );
    expect(secondJoint.getValue(PhysicsJoint, "bodyBRef")).toBe(
      serializeEntityRef(second.get("physics.prefab.bob")!),
    );
    expect(firstJoint.getValue(PhysicsJoint, "bodyARef")).not.toBe(
      secondJoint.getValue(PhysicsJoint, "bodyARef"),
    );
  });
});

function prefabEntitiesByName(
  world: EcsWorld,
  root: Entity,
): Map<string, Entity> {
  const entities = [root, ...getChildren(world, root)];
  const map = new Map<string, Entity>();
  for (const entity of entities) {
    map.set(entity.getValue(Name, "value") as string, entity);
  }
  return map;
}
