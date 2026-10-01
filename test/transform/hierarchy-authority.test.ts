import { describe, expect, it, vi } from "vitest";
import {
  Children,
  LocalTransform,
  Parent,
  WorldTransform,
  createWorld,
  despawnRecursive,
  getChildren,
  registerTransformComponents,
  resolveWorldTransforms,
  setParent,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

function worldWithTransforms(): EcsWorld {
  const world = createWorld({ entityCapacity: 32 });
  registerTransformComponents(world);
  return world;
}

function node(world: EcsWorld, parent: Entity | null = null): Entity {
  const entity = world.createEntity();
  entity.addComponent(LocalTransform);
  entity.addComponent(WorldTransform);
  entity.addComponent(Parent, { entity: parent });
  return entity;
}

function key(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

describe("authoritative hierarchy children", () => {
  it("combines direct Parent writes with indexed insertion order without duplicate children", () => {
    const world = worldWithTransforms();
    const parent = node(world);
    const direct = node(world, parent);
    const first = node(world);
    const second = node(world);
    resolveWorldTransforms(world);
    expect(setParent(world, second, parent).ok).toBe(true);
    expect(setParent(world, first, parent).ok).toBe(true);

    expect(getChildren(world, parent)).toEqual([second, first, direct]);
    const version = world.worldChangeVersion();
    expect(getChildren(world, parent)).toEqual([second, first, direct]);
    expect(world.worldChangeVersion()).toBe(version);
  });

  it("reflects direct reparenting, detachment, component removal, and destruction", () => {
    const world = worldWithTransforms();
    const oldParent = node(world);
    const newParent = node(world);
    const child = node(world);
    resolveWorldTransforms(world);
    expect(setParent(world, child, oldParent).ok).toBe(true);
    expect(getChildren(world, oldParent)).toEqual([child]);

    child.setValue(Parent, "entity", newParent);
    expect(getChildren(world, oldParent)).toEqual([]);
    expect(getChildren(world, newParent)).toEqual([child]);
    child.setValue(Parent, "entity", null);
    expect(getChildren(world, newParent)).toEqual([]);
    child.setValue(Parent, "entity", newParent);
    expect(getChildren(world, newParent)).toEqual([child]);
    child.removeComponent(Parent);
    expect(getChildren(world, newParent)).toEqual([]);
    child.addComponent(Parent, { entity: newParent });
    expect(getChildren(world, newParent)).toEqual([child]);
    child.destroy();
    expect(getChildren(world, newParent)).toEqual([]);
    newParent.destroy();
    expect(getChildren(world, newParent)).toEqual([]);
  });

  it("does not destroy an entity whose stale Children entry points into another subtree", () => {
    const world = worldWithTransforms();
    const oldParent = node(world);
    const survivorParent = node(world);
    const survivor = node(world);
    const survivorLeaf = node(world, survivor);
    const doomed = node(world, oldParent);
    resolveWorldTransforms(world);
    expect(setParent(world, survivor, oldParent).ok).toBe(true);
    survivor.setValue(Parent, "entity", survivorParent);

    expect(despawnRecursive(world, oldParent)).toBe(2);
    expect(oldParent.active).toBe(false);
    expect(doomed.active).toBe(false);
    expect(survivorParent.active).toBe(true);
    expect(survivor.active).toBe(true);
    expect(survivorLeaf.active).toBe(true);
    expect(getChildren(world, survivorParent)).toEqual([survivor]);
    expect(getChildren(world, survivor)).toEqual([survivorLeaf]);
  });

  it("repairs a missing derived entry when setParent targets the current parent", () => {
    const world = worldWithTransforms();
    const parent = node(world);
    const child = node(world, parent);
    resolveWorldTransforms(world);
    expect(parent.hasComponent(Children)).toBe(false);

    expect(setParent(world, child, parent).ok).toBe(true);
    expect(parent.getValue(Children, "refs")).toBe(
      JSON.stringify([key(child)]),
    );
    expect(setParent(world, child, parent).ok).toBe(true);
    expect(parent.getValue(Children, "refs")).toBe(
      JSON.stringify([key(child)]),
    );
    expect(getChildren(world, parent)).toEqual([child]);
  });

  it.each(["descendant", "sibling"] as const)(
    "keeps a %s moved out of the subtree by a destruction callback alive",
    (target) => {
      const world = worldWithTransforms();
      const root = node(world);
      const first = node(world, root);
      const branch = node(world, root);
      const leaf = node(world, branch);
      const survivorParent = node(world);
      const moved = target === "descendant" ? leaf : branch;
      const query = world.queryManager.registerQuery({ required: [Parent] });
      const unsubscribe = query.subscribe("disqualify", (entity) => {
        if (entity === first) moved.setValue(Parent, "entity", survivorParent);
      });
      try {
        expect(despawnRecursive(world, root)).toBe(
          target === "descendant" ? 3 : 2,
        );
        expect(moved.active).toBe(true);
        expect(leaf.active).toBe(true);
        expect(survivorParent.active).toBe(true);
        expect(getChildren(world, survivorParent)).toEqual([moved]);
      } finally {
        unsubscribe();
      }
    },
  );

  it("ignores malformed, duplicate, stale, and foreign Children entries", () => {
    const world = worldWithTransforms();
    const parent = node(world);
    const child = node(world, parent);
    const unrelated = node(world);
    parent.addComponent(Children, {
      refs: JSON.stringify([
        null,
        "invalid",
        "invalid:0",
        "1000:0",
        `${child.index}:${child.generation + 1}`,
        key(unrelated),
        key(child),
        key(child),
        `0${child.index}:${child.generation}`,
      ]),
    });
    expect(getChildren(world, parent)).toEqual([child]);
    for (const malformed of ["", "not-json", "{}", "null"]) {
      parent.setValue(Children, "refs", malformed);
      expect(getChildren(world, parent)).toEqual([child]);
    }
  });

  it("shares one Parent query per unchanged world and invalidates after new children", () => {
    const world = worldWithTransforms();
    const root = node(world);
    const child = node(world, root);
    const leaf = node(world, child);
    const query = vi.spyOn(world.queryManager, "registerQuery");
    try {
      expect(getChildren(world, root)).toEqual([child]);
      expect(getChildren(world, child)).toEqual([leaf]);
      expect(getChildren(world, leaf)).toEqual([]);
      expect(getChildren(world, root)).toEqual([child]);
      expect(query).toHaveBeenCalledTimes(1);
      const second = node(world, root);
      expect(getChildren(world, root)).toEqual([child, second]);
      expect(query).toHaveBeenCalledTimes(2);
    } finally {
      query.mockRestore();
    }
  });

  it("does not reuse cached children after a world reset with identical refs", () => {
    const first = worldWithTransforms();
    const rootA = node(first);
    const childA = node(first, rootA);
    expect(getChildren(first, rootA)).toEqual([childA]);
    const firstVersion = first.worldChangeVersion();
    // Component storage is process-global in elics; app worlds are sequential.
    // Tear down the first world before registering components in its successor.
    childA.destroy();
    rootA.destroy();

    const second = worldWithTransforms();
    const rootB = node(second);
    const childB = node(second, rootB);
    expect(second.worldChangeVersion()).toBe(firstVersion);
    expect(rootB.index).toBe(rootA.index);
    expect(childB.index).toBe(childA.index);
    expect(getChildren(second, rootB)).toEqual([childB]);
    expect(childB).not.toBe(childA);
  });
});
