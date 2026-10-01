import { describe, expect, it } from "vitest";
import { createHierarchyAccess } from "@aperture-engine/app/systems";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createWorld,
  registerTransformComponents,
  type Entity,
} from "@aperture-engine/simulation";

const ref = (entity: Entity) => ({
  index: entity.index,
  generation: entity.generation,
});

function fixture() {
  const world = createWorld({ entityCapacity: 8 });
  registerTransformComponents(world);
  const child = world.createEntity();
  child.addComponent(LocalTransform);
  child.addComponent(Parent, { entity: null });
  child.addComponent(WorldTransform);
  const parent = world.createEntity();
  parent.addComponent(LocalTransform);
  parent.addComponent(WorldTransform);
  return { world, child, parent, hierarchy: createHierarchyAccess(world) };
}

describe("hierarchy accessor failure diagnostics", () => {
  it("rejects invalid, absent, stale, and destroyed refs without changing the world", () => {
    const { world, child, parent, hierarchy } = fixture();
    const deleted = world.createEntity();
    const deletedRef = ref(deleted);
    deleted.destroy();
    const version = world.worldChangeVersion();
    for (const [entity, code] of [
      [{ index: -1, generation: 0 }, "invalidRef"],
      [{ index: 500, generation: 0 }, "notFound"],
      [
        { index: child.index, generation: child.generation + 1 },
        "generationMismatch",
      ],
      [deletedRef, "notFound"],
    ] as const) {
      expect(hierarchy.children(entity)).toMatchObject({
        ok: false,
        children: [],
        diagnostic: { code: `aperture.entityLookup.${code}` },
      });
      expect(hierarchy.despawnRecursive(entity)).toMatchObject({
        ok: false,
        despawned: 0,
        diagnostic: { code: `aperture.entityLookup.${code}` },
      });
      expect(hierarchy.setParent(ref(child), entity)).toMatchObject({
        ok: false,
        diagnostic: { code: `aperture.entityLookup.${code}` },
      });
    }
    expect(world.worldChangeVersion()).toBe(version);
    expect(child.getValue(Parent, "entity")).toBeNull();
    expect(parent.active).toBe(true);
  });

  it("reports missing child and parent matrices with an actionable resolution hint", () => {
    const { child, parent, hierarchy } = fixture();
    child.removeComponent(WorldTransform);
    expect(hierarchy.setParent(ref(child), ref(parent))).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.hierarchy.missing-world-transform",
        suggestedFix: expect.stringContaining("resolveWorldTransforms"),
        data: { child: ref(child), parent: ref(parent) },
      },
    });
    child.addComponent(WorldTransform);
    parent.removeComponent(WorldTransform);
    expect(hierarchy.setParent(ref(child), ref(parent))).toMatchObject({
      ok: false,
      diagnostic: { code: "aperture.hierarchy.missing-world-transform" },
    });
    expect(child.getValue(Parent, "entity")).toBeNull();
  });

  it("rejects singular matrices without mutating Parent or LocalTransform", () => {
    const { world, child, parent, hierarchy } = fixture();
    parent.getVectorView(WorldTransform, "col0").fill(0);
    const version = world.worldChangeVersion();
    expect(hierarchy.setParent(ref(child), ref(parent))).toMatchObject({
      ok: false,
      diagnostic: {
        code: "aperture.hierarchy.invalid-world-transform",
        suggestedFix: expect.stringContaining("non-singular"),
      },
    });
    expect(child.getValue(Parent, "entity")).toBeNull();
    expect([...child.getVectorView(LocalTransform, "scale")]).toEqual([
      1, 1, 1,
    ]);
    expect(world.worldChangeVersion()).toBe(version);
  });
});
