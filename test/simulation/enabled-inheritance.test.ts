import { describe, expect, it } from "vitest";
import {
  Enabled,
  Parent,
  createParent,
  createWorld,
  isHierarchyEnabled,
  registerMetadataComponents,
  registerTransformComponents,
  type Entity,
} from "@aperture-engine/simulation";

// Enabled inheritance through the authoritative Parent chain
// (transform/hierarchy.ts isHierarchyEnabled): disabling any ancestor
// suppresses the whole subtree even when descendants carry no Enabled
// component of their own (imported glTF nodes never duplicate the metadata
// component), missing Enabled defaults to enabled, and a malformed
// direct-Parent cycle fails closed (false) instead of looping forever or
// exposing only part of the invalid subtree.

describe("enabled inheritance (isHierarchyEnabled)", () => {
  it("a child of a disabled parent reports disabled even when the child itself is enabled", () => {
    const world = createTestWorld();
    const parent = spawn(world, { enabled: false });
    const child = spawn(world, { parent, enabled: true });

    // The child's own Enabled=true does NOT win: the disabled ancestor
    // suppresses the whole subtree.
    expect(isHierarchyEnabled(child)).toBe(false);
    expect(isHierarchyEnabled(parent)).toBe(false);
  });

  it("a deep chain (root → a → b → leaf) inherits disabled from the root", () => {
    const world = createTestWorld();
    const root = spawn(world, { enabled: false });
    const a = spawn(world, { parent: root });
    const b = spawn(world, { parent: a });
    const leaf = spawn(world, { parent: b, enabled: true });

    // Every descendant inherits the root's disabled flag, even the leaf that
    // carries its own Enabled=true and the middle nodes that carry none.
    expect(isHierarchyEnabled(a)).toBe(false);
    expect(isHierarchyEnabled(b)).toBe(false);
    expect(isHierarchyEnabled(leaf)).toBe(false);
  });

  it("re-enabling the ancestor restores its descendants", () => {
    const world = createTestWorld();
    const root = spawn(world, { enabled: true });
    const mid = spawn(world, { parent: root });
    const leaf = spawn(world, { parent: mid, enabled: true });

    root.setValue(Enabled, "value", false);
    expect(isHierarchyEnabled(mid)).toBe(false);
    expect(isHierarchyEnabled(leaf)).toBe(false);

    root.setValue(Enabled, "value", true);
    expect(isHierarchyEnabled(root)).toBe(true);
    expect(isHierarchyEnabled(mid)).toBe(true);
    expect(isHierarchyEnabled(leaf)).toBe(true);
  });

  it("a direct-Parent cycle fails closed (false) instead of hanging", () => {
    const world = createTestWorld();
    // setParent rejects cycles, so a cycle can only arise from direct Parent
    // writes (the glTF-replay path); model that malformed state explicitly.
    const a = spawn(world, {});
    const b = spawn(world, { parent: a });
    a.setValue(Parent, "entity", b); // a ↔ b

    // Fail closed: every entity on the cycle reports disabled, and the call
    // returns (this test completing at all proves the walk terminates).
    expect(isHierarchyEnabled(a)).toBe(false);
    expect(isHierarchyEnabled(b)).toBe(false);

    // An otherwise-valid descendant hanging off the cycle is suppressed too:
    // the invalid subtree must not be partially exposed.
    const leaf = spawn(world, { parent: b, enabled: true });
    expect(isHierarchyEnabled(leaf)).toBe(false);
  });

  it("entities with no Enabled component anywhere default to enabled", () => {
    const world = createTestWorld();
    const root = spawn(world, {});
    const mid = spawn(world, { parent: root });
    const leaf = spawn(world, { parent: mid });
    const orphan = world.createEntity(); // no Parent, no Enabled at all

    // Missing Enabled components mean enabled — no ancestor is disabled, so
    // the whole chain (and a bare entity outside any hierarchy) reports true.
    expect(isHierarchyEnabled(root)).toBe(true);
    expect(isHierarchyEnabled(mid)).toBe(true);
    expect(isHierarchyEnabled(leaf)).toBe(true);
    expect(isHierarchyEnabled(orphan)).toBe(true);
  });
});

interface SpawnOptions {
  readonly parent?: Entity;
  readonly enabled?: boolean;
}

function createTestWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  return world;
}

/**
 * Spawn an entity with an authoritative Parent ref (direct write, matching
 * glTF scene replay) and an optional explicit Enabled flag. Entities without
 * `enabled` carry NO Enabled component, exercising the default-enabled path.
 */
function spawn(
  world: ReturnType<typeof createWorld>,
  options: SpawnOptions = {},
): Entity {
  const entity = world.createEntity();
  entity.addComponent(Parent, createParent(options.parent ?? null));
  if (options.enabled !== undefined) {
    entity.addComponent(Enabled, { value: options.enabled });
  }
  return entity;
}
