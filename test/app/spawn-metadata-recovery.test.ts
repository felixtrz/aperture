import { describe, expect, it, vi } from "vitest";
import {
  AppEntityKey,
  createApertureSystemContext,
} from "@aperture-engine/app/systems";
import { createApertureEntityHierarchy } from "@aperture-engine/app/entity-lookup";
import {
  AssetRegistry,
  Name,
  createWorld,
  createEnvironmentMapHandle,
} from "@aperture-engine/simulation";
import { applySpawnMetadata } from "../../packages/app/src/systems/spawn/metadata.js";

function setup() {
  const world = createWorld();
  const context = createApertureSystemContext({
    world,
    assetsRegistry: new AssetRegistry(),
  });
  return { world, context };
}

describe("spawn metadata recovery", () => {
  it.each([
    "group",
    "camera",
    "light",
    "fog",
    "proceduralSky",
    "physics",
  ] as const)(
    "%s rolls back duplicate metadata and malformed transforms so a corrected key can be retried",
    (kind) => {
      const { world, context } = setup();
      context.spawn.group({ key: "keep" });
      for (const input of [
        { key: "keep", physics: {} },
        { key: "retry", physics: {}, transform: { translation: [1] as never } },
      ]) {
        expect(() => context.spawn[kind](input)).toThrow();
        expect(createApertureEntityHierarchy(world).total).toBe(1);
      }
      expect(context.spawn[kind]({ key: "retry", physics: {} }).active).toBe(
        true,
      );
      expect(createApertureEntityHierarchy(world).total).toBe(2);
    },
  );

  it("rolls back every owned light when a later light-rig child fails", () => {
    const { world, context } = setup();
    const keep = context.spawn.group({ key: "rig.rim" });
    expect(() =>
      context.spawn.lightRig({
        key: "rig",
        preset: "studio-neutral",
        environmentMap: createEnvironmentMapHandle("studio"),
      }),
    ).toThrow(/already in use/);
    expect(createApertureEntityHierarchy(world).total).toBe(1);
    expect(keep.active).toBe(true);
    keep.destroy();
    const rig = context.spawn.lightRig({
      key: "rig",
      preset: "studio-neutral",
      environmentMap: createEnvironmentMapHandle("studio"),
    });
    expect(rig.lights).toHaveLength(3);
    expect(createApertureEntityHierarchy(world).total).toBe(4);
  });

  it("keeps the registered key-query count bounded and follows ECS key edits", () => {
    const { world, context } = setup();
    const register = vi.spyOn(world.queryManager, "registerQuery");
    try {
      const first = context.spawn.group({ key: "part.0" });
      for (let index = 1; index < 200; index++)
        context.spawn.group({ key: `part.${index}` });
      expect(
        new Set(register.mock.results.map((result) => result.value)).size,
      ).toBe(1);
      first.setValue(AppEntityKey, "value", "renamed");
      expect(context.spawn.group({ key: "part.0" }).active).toBe(true);
      expect(() => context.spawn.group({ key: "renamed" })).toThrow(
        /already in use/,
      );
    } finally {
      register.mockRestore();
    }
  });

  it("preflights metadata before mutating an existing entity", () => {
    const { world, context } = setup();
    context.spawn.group({ key: "keep" });
    const entity = context.spawn.group({ key: "editable", name: "Original" });
    expect(() =>
      applySpawnMetadata(
        world,
        entity,
        { key: "keep", name: "Changed" },
        "group",
      ),
    ).toThrow(/already in use/);
    expect(entity.getValue(AppEntityKey, "value")).toBe("editable");
    expect(entity.getValue(Name, "value")).toBe("Original");
  });
});
