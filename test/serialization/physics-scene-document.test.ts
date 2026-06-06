import { describe, expect, it } from "vitest";
import {
  APERTURE_SCENE_FORMAT_VERSION,
  LocalTransform,
  Name,
  createComponentRegistry,
  createLocalTransform,
  createWorld,
  instantiatePrefab,
  loadScene,
  registerMetadataComponents,
  registerTransformComponents,
  saveScene,
  serializeEntityRef,
  type ApertureSceneDocument,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Collider,
  PHYSICS_AUTHORING_COMPONENTS,
  PHYSICS_ENTITY_REF_STRING_FIELDS,
  PhysicsBodyState,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsRigidBodyType,
  RigidBody,
  createCollider,
  createPhysicsBodyState,
  createPhysicsJoint,
  createRigidBody,
  registerPhysicsComponents,
  stepPhysicsWorld,
  validatePhysicsSceneAssetReferences,
  type PhysicsShape,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";

const PHYSICS_SCENE_REGISTRY = createComponentRegistry(
  [LocalTransform, Name, ...PHYSICS_AUTHORING_COMPONENTS],
  { entityRefStringFields: PHYSICS_ENTITY_REF_STRING_FIELDS },
);

describe("physics scene document serialization (PHYS-12)", () => {
  it("round-trips physics authoring, remaps joint body refs, and rebuilds backend state", () => {
    const source = buildPhysicsScene();
    const originalAnchorRef = serializeEntityRef(source.anchor);
    const originalBobRef = serializeEntityRef(source.bob);

    const document = saveScene(source.world);
    expect(document.formatVersion).toBe(APERTURE_SCENE_FORMAT_VERSION);
    expect(componentIds(document)).not.toContain(PhysicsBodyState.id);
    expect(jointFields(document)).toMatchObject({
      bodyARef: originalAnchorRef,
      bodyBRef: originalBobRef,
    });

    const json = JSON.parse(JSON.stringify(document)) as ApertureSceneDocument;
    const target = createWorld({ entityCapacity: 32 });
    target.createEntity();
    target.createEntity();

    const loaded = loadScene(target, json, {
      registry: PHYSICS_SCENE_REGISTRY,
    });
    expect(loaded).toMatchObject({ ok: true, diagnostics: [] });

    const loadedEntities = byName(loaded.entities);
    const loadedAnchor = loadedEntities.get("anchor")!;
    const loadedBob = loadedEntities.get("bob")!;
    const loadedJoint = loadedEntities.get("joint")!;

    expect(loadedAnchor.hasComponent(RigidBody)).toBe(true);
    expect(loadedBob.hasComponent(Collider)).toBe(true);
    expect(loadedBob.hasComponent(PhysicsBodyState)).toBe(false);
    expect(loadedJoint.getValue(PhysicsJoint, "bodyARef")).toBe(
      serializeEntityRef(loadedAnchor),
    );
    expect(loadedJoint.getValue(PhysicsJoint, "bodyBRef")).toBe(
      serializeEntityRef(loadedBob),
    );
    expect(loadedJoint.getValue(PhysicsJoint, "bodyARef")).not.toBe(
      originalAnchorRef,
    );
    expect(loadedJoint.getValue(PhysicsJoint, "bodyBRef")).not.toBe(
      originalBobRef,
    );

    const backend = createTestPhysicsBackend();
    backend.init();
    const report = stepPhysicsWorld({
      world: target,
      backend,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.sync.bodyCount).toBe(2);
    expect(report.sync.jointCount).toBe(1);
    expect(report.readback.bodyCount).toBe(2);
    expect(report.writeback.bodyStateWrites).toBe(2);
    expect(loadedBob.hasComponent(PhysicsBodyState)).toBe(true);
  });

  it("prefab clones remap physics joint refs per instance", () => {
    const document = saveScene(buildPhysicsScene().world);
    const world = createWorld({ entityCapacity: 48 });

    const first = instantiatePrefab(world, document, {
      registry: PHYSICS_SCENE_REGISTRY,
      transform: { translation: [0, 0, 0] },
    });
    const second = instantiatePrefab(world, document, {
      registry: PHYSICS_SCENE_REGISTRY,
      transform: { translation: [3, 0, 0] },
    });

    expect(first).toMatchObject({ ok: true, diagnostics: [] });
    expect(second).toMatchObject({ ok: true, diagnostics: [] });

    const firstEntities = byName(first.entities);
    const secondEntities = byName(second.entities);
    const firstAnchor = firstEntities.get("anchor")!;
    const firstBob = firstEntities.get("bob")!;
    const firstJoint = firstEntities.get("joint")!;
    const secondAnchor = secondEntities.get("anchor")!;
    const secondBob = secondEntities.get("bob")!;
    const secondJoint = secondEntities.get("joint")!;

    expect(firstJoint.getValue(PhysicsJoint, "bodyARef")).toBe(
      serializeEntityRef(firstAnchor),
    );
    expect(firstJoint.getValue(PhysicsJoint, "bodyBRef")).toBe(
      serializeEntityRef(firstBob),
    );
    expect(secondJoint.getValue(PhysicsJoint, "bodyARef")).toBe(
      serializeEntityRef(secondAnchor),
    );
    expect(secondJoint.getValue(PhysicsJoint, "bodyBRef")).toBe(
      serializeEntityRef(secondBob),
    );
    expect(firstJoint.getValue(PhysicsJoint, "bodyARef")).not.toBe(
      secondJoint.getValue(PhysicsJoint, "bodyARef"),
    );

    const backend = createTestPhysicsBackend();
    backend.init();
    const report = stepPhysicsWorld({
      world,
      backend,
      fixedDelta: 1 / 60,
      fixedStep: 1,
    });

    expect(report.sync.bodyCount).toBe(4);
    expect(report.sync.jointCount).toBe(2);
    expect(report.writeback.bodyStateWrites).toBe(4);
  });

  it("diagnoses missing and stale serialized collider asset references", () => {
    const world = createWorld({ entityCapacity: 16 });
    registerTransformComponents(world);
    registerMetadataComponents(world);
    registerPhysicsComponents(world);

    createPhysicsAssetCollider(world, "empty-mesh", {
      kind: "trimesh",
      meshId: "",
    });
    createPhysicsAssetCollider(world, "stale-mesh", {
      kind: "convexHull",
      meshId: "missing-mesh",
    });
    createPhysicsAssetCollider(world, "valid-mesh", {
      kind: "trimesh",
      meshId: "mesh-ok",
    });
    createPhysicsAssetCollider(world, "empty-heightfield", {
      kind: "heightfield",
      assetId: "",
    });
    createPhysicsAssetCollider(world, "stale-heightfield", {
      kind: "heightfield",
      assetId: "missing-heightfield",
    });
    createPhysicsAssetCollider(world, "valid-heightfield", {
      kind: "heightfield",
      assetId: "heightfield-ok",
    });

    const document = saveScene(world);
    const diagnostics = validatePhysicsSceneAssetReferences(document, {
      meshExists: (meshId) => meshId === "mesh-ok",
      heightfieldExists: (assetId) => assetId === "heightfield-ok",
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aperture.physics.scene.collider.missingMeshId",
      "aperture.physics.scene.collider.staleMeshId",
      "aperture.physics.scene.collider.missingHeightfieldAssetId",
      "aperture.physics.scene.collider.staleHeightfieldAssetId",
    ]);
    expect(diagnostics[1]).toMatchObject({
      data: {
        field: "meshId",
        shapeKind: "convexHull",
        meshId: "missing-mesh",
      },
    });
    expect(diagnostics[3]).toMatchObject({
      data: {
        field: "heightfieldAssetId",
        shapeKind: "heightfield",
        assetId: "missing-heightfield",
      },
    });
  });
});

function buildPhysicsScene(): {
  readonly world: ReturnType<typeof createWorld>;
  readonly anchor: Entity;
  readonly bob: Entity;
  readonly joint: Entity;
} {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerPhysicsComponents(world);

  const anchor = createPhysicsBody(world, "anchor", [0, 0, 0], {
    type: PhysicsRigidBodyType.Static,
  });
  const bob = createPhysicsBody(world, "bob", [0, 1, 0], {
    type: PhysicsRigidBodyType.Dynamic,
  });
  bob.addComponent(
    PhysicsBodyState,
    createPhysicsBodyState({
      currentTranslation: [100, 100, 100],
      backendBodyId: "derived-stale-body",
    }),
  );

  const joint = world.createEntity();
  joint.addComponent(Name, { value: "joint" });
  joint.addComponent(
    PhysicsJoint,
    createPhysicsJoint({
      kind: PhysicsJointKind.Distance,
      bodyARef: serializeEntityRef(anchor),
      bodyBRef: serializeEntityRef(bob),
      maxLimit: 1.25,
    }),
  );

  return { world, anchor, bob, joint };
}

function createPhysicsBody(
  world: ReturnType<typeof createWorld>,
  name: string,
  translation: readonly [number, number, number],
  rigidBody: Parameters<typeof createRigidBody>[0],
): Entity {
  const entity = world.createEntity();
  entity.addComponent(Name, { value: name });
  entity.addComponent(LocalTransform, createLocalTransform({ translation }));
  entity.addComponent(RigidBody, createRigidBody(rigidBody));
  entity.addComponent(
    Collider,
    createCollider({ shape: { kind: "sphere", radius: 0.25 } }),
  );
  return entity;
}

function createPhysicsAssetCollider(
  world: ReturnType<typeof createWorld>,
  name: string,
  shape: PhysicsShape,
): Entity {
  const entity = world.createEntity();
  entity.addComponent(Name, { value: name });
  entity.addComponent(LocalTransform, createLocalTransform());
  entity.addComponent(
    RigidBody,
    createRigidBody({ type: PhysicsRigidBodyType.Static }),
  );
  entity.addComponent(Collider, createCollider({ shape }));
  return entity;
}

function byName(entities: readonly Entity[]): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const entity of entities) {
    map.set(entity.getValue(Name, "value") as string, entity);
  }
  return map;
}

function componentIds(document: ApertureSceneDocument): string[] {
  return document.entities.flatMap((entity) =>
    entity.components.map((component) => component.id),
  );
}

function jointFields(
  document: ApertureSceneDocument,
): Readonly<Record<string, unknown>> {
  const record = document.entities
    .flatMap((entity) => entity.components)
    .find((component) => component.id === PhysicsJoint.id);
  if (record === undefined) {
    throw new Error("Expected serialized physics joint component.");
  }
  return record.fields;
}
