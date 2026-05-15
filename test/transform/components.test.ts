import { describe, expect, it } from "vitest";

import {
  DebugMetadata,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createLocalTransform,
  createParent,
  createRootTransform,
  createWorld,
  quatFromAxisAngle,
  registerMetadataComponents,
  registerTransformComponents,
} from "../../src/index.js";

describe("transform and metadata ECS components", () => {
  it("attaches, reads, updates, removes, and queries transform components", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);

    const query = world.queryManager.registerQuery({
      required: [LocalTransform, WorldTransform],
    });
    const entity = world.createEntity();

    entity.addComponent(
      LocalTransform,
      createLocalTransform({
        translation: [1, 2, 3],
        rotation: quatFromAxisAngle([0, 1, 0], Math.PI / 2),
        scale: [2, 2, 2],
      }),
    );
    entity.addComponent(WorldTransform);

    expect(query.entities.has(entity)).toBe(true);
    expectVector(
      entity.getVectorView(LocalTransform, "translation"),
      [1, 2, 3],
    );
    expectVector(entity.getVectorView(LocalTransform, "scale"), [2, 2, 2]);
    expectVector(entity.getVectorView(WorldTransform, "col0"), [1, 0, 0, 0]);
    expectVector(entity.getVectorView(WorldTransform, "col3"), [0, 0, 0, 1]);

    entity.getVectorView(LocalTransform, "translation").set([4, 5, 6]);

    expectVector(
      entity.getVectorView(LocalTransform, "translation"),
      [4, 5, 6],
    );

    entity.removeComponent(WorldTransform);

    expect(query.entities.has(entity)).toBe(false);
    expect(entity.hasComponent(WorldTransform)).toBe(false);
  });

  it("stores parent references as generation-checked EliCS entity fields", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);

    const parent = world.createEntity();
    const child = world.createEntity();

    child.addComponent(Parent, createParent(parent));

    expect(child.getValue(Parent, "entity")).toBe(parent);

    parent.destroy();

    expect(child.getValue(Parent, "entity")).toBeNull();
  });

  it("creates root transform defaults with world columns matching local TRS", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerTransformComponents(world);

    const rootData = createRootTransform({ translation: [3, 4, 5] });
    const entity = world.createEntity();

    entity.addComponent(LocalTransform, rootData.local);
    entity.addComponent(Parent, rootData.parent);
    entity.addComponent(WorldTransform, rootData.world);

    expect(entity.getValue(Parent, "entity")).toBeNull();
    expectVector(
      entity.getVectorView(LocalTransform, "translation"),
      [3, 4, 5],
    );
    expectVector(
      entity.getVectorView(LocalTransform, "rotation"),
      [0, 0, 0, 1],
    );
    expectVector(entity.getVectorView(LocalTransform, "scale"), [1, 1, 1]);
    expectVector(entity.getVectorView(WorldTransform, "col0"), [1, 0, 0, 0]);
    expectVector(entity.getVectorView(WorldTransform, "col1"), [0, 1, 0, 0]);
    expectVector(entity.getVectorView(WorldTransform, "col2"), [0, 0, 1, 0]);
    expectVector(entity.getVectorView(WorldTransform, "col3"), [3, 4, 5, 1]);
  });

  it("attaches, reads, updates, removes, and queries metadata components", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerMetadataComponents(world);

    const query = world.queryManager.registerQuery({
      required: [Enabled, Name],
    });
    const entity = world.createEntity();

    entity.addComponent(Enabled);
    entity.addComponent(Name, { value: "Debug Cube" });
    entity.addComponent(DebugMetadata, {
      tag: "fixture",
      note: "used by component tests",
    });

    expect(query.entities.has(entity)).toBe(true);
    expect(entity.getValue(Enabled, "value")).toBe(true);
    expect(entity.getValue(Name, "value")).toBe("Debug Cube");
    expect(entity.getValue(DebugMetadata, "tag")).toBe("fixture");
    expect(entity.getValue(DebugMetadata, "note")).toBe(
      "used by component tests",
    );

    entity.setValue(Enabled, "value", false);
    entity.setValue(Name, "value", "Renamed Cube");
    entity.setValue(DebugMetadata, "note", "updated note");

    expect(entity.getValue(Enabled, "value")).toBe(false);
    expect(entity.getValue(Name, "value")).toBe("Renamed Cube");
    expect(entity.getValue(DebugMetadata, "note")).toBe("updated note");

    entity.removeComponent(Name);

    expect(query.entities.has(entity)).toBe(false);
    expect(entity.hasComponent(Name)).toBe(false);
  });
});

function expectVector(
  actual: ArrayLike<number>,
  expected: readonly number[],
): void {
  expect(Array.from(actual)).toEqual(expected);
}
