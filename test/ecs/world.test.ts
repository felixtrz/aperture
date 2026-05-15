import { describe, expect, it, vi } from "vitest";

import {
  EcsType,
  createWorld,
  defineComponent,
  type Entity,
} from "../../src/index.js";

let nextComponentId = 0;

function testComponentId(name: string): string {
  nextComponentId += 1;
  return `aperture.test.${name}.${nextComponentId}`;
}

describe("EliCS-backed ECS foundation", () => {
  it("creates worlds and generation-tracked entities", () => {
    const released: Entity[] = [];
    const world = createWorld({
      entityCapacity: 8,
      entityReleaseCallback: (entity) => released.push(entity),
    });

    const first = world.createEntity();
    const second = world.createEntity();

    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(first.generation).toBe(0);
    expect(second.generation).toBe(0);
    expect(first.active).toBe(true);
    expect(second.active).toBe(true);

    first.destroy();

    expect(first.active).toBe(false);
    expect(released).toEqual([first]);

    const reused = world.createEntity();

    expect(reused.index).toBe(0);
    expect(reused.generation).toBe(1);
    expect(reused.active).toBe(true);
    expect(second.active).toBe(true);
  });

  it("registers components and supports add, get, remove, and has", () => {
    const Health = defineComponent(testComponentId("Health"), {
      current: { type: EcsType.Int32, default: 100 },
      maximum: { type: EcsType.Int32, default: 100 },
    });
    const world = createWorld({ entityCapacity: 4 });

    expect(world.hasComponent(Health)).toBe(false);

    world.registerComponent(Health);

    expect(world.hasComponent(Health)).toBe(true);

    const entity = world.createEntity();

    entity.addComponent(Health, { current: 40 });

    expect(entity.hasComponent(Health)).toBe(true);
    expect(entity.getValue(Health, "current")).toBe(40);
    expect(entity.getValue(Health, "maximum")).toBe(100);

    entity.setValue(Health, "current", 25);

    expect(entity.getValue(Health, "current")).toBe(25);

    entity.removeComponent(Health);

    expect(entity.hasComponent(Health)).toBe(false);
  });

  it("resolves stale entity component references to null after destroy", () => {
    const TargetRef = defineComponent(testComponentId("TargetRef"), {
      target: { type: EcsType.Entity, default: null },
    });
    const world = createWorld({ entityCapacity: 4 });
    world.registerComponent(TargetRef);

    const target = world.createEntity();
    const holder = world.createEntity();

    holder.addComponent(TargetRef, { target });

    expect(holder.getValue(TargetRef, "target")).toBe(target);

    target.destroy();

    expect(target.active).toBe(false);
    expect(holder.getValue(TargetRef, "target")).toBeNull();
  });

  it("does not attach components to destroyed entities", () => {
    const Flag = defineComponent(testComponentId("Flag"), {
      enabled: { type: EcsType.Boolean, default: true },
    });
    const world = createWorld({ entityCapacity: 4 });
    world.registerComponent(Flag);

    const entity = world.createEntity();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    entity.destroy();
    entity.addComponent(Flag);

    expect(entity.active).toBe(false);
    expect(entity.hasComponent(Flag)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });
});
