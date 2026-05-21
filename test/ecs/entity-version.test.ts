import { describe, expect, it } from "vitest";

import {
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createParent,
  createRootTransform,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
} from "@aperture-engine/core";

describe("ECS entity version tracking", () => {
  it("increments a monotonic entity version for component writes", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerMetadataComponents(world);
    const entity = world.createEntity();

    expect(world.entityVersion(entity)).toBe(0);

    entity.addComponent(Name, { value: "Cube" });
    expect(world.entityVersion(entity)).toBe(1);

    entity.setValue(Name, "value", "Renamed Cube");
    expect(world.entityVersion(entity)).toBe(2);

    entity.removeComponent(Name);
    expect(world.entityVersion(entity)).toBe(3);
  });

  it("tracks vector writes and marks resolved transforms only when output changes", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerTransformComponents(world);
    const root = createRootTransform();
    const entity = world.createEntity();

    entity.addComponent(LocalTransform, root.local);
    entity.addComponent(Parent, root.parent);
    entity.addComponent(WorldTransform, root.world);

    const versionAfterAuthoring = world.entityVersion(entity);

    resolveWorldTransforms(world);
    expect(world.entityVersion(entity)).toBe(versionAfterAuthoring);

    entity.getVectorView(LocalTransform, "translation").set([2, 3, 4], 0);
    expect(world.entityVersion(entity)).toBe(versionAfterAuthoring + 1);

    resolveWorldTransforms(world);
    expect(world.entityVersion(entity)).toBe(versionAfterAuthoring + 2);

    resolveWorldTransforms(world);
    expect(world.entityVersion(entity)).toBe(versionAfterAuthoring + 2);
  });

  it("starts a recycled entity generation at version zero", () => {
    const world = createWorld({ entityCapacity: 1 });
    registerTransformComponents(world);
    const first = world.createEntity();
    const firstGeneration = first.generation;

    first.addComponent(Parent, createParent(null));
    expect(world.entityVersion(first)).toBe(1);

    first.destroy();
    const second = world.createEntity();

    expect(second.index).toBe(first.index);
    expect(second.generation).not.toBe(firstGeneration);
    expect(world.entityVersion(second)).toBe(0);
  });
});
