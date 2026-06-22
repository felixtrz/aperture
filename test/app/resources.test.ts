import { describe, expect, it } from "vitest";
import {
  createResourceStore,
  defineResource,
  resource,
  type Vec3Tuple,
} from "@aperture-engine/app/systems";

describe("Aperture system resources", () => {
  it("initializes typed singleton state and tracks writes in the summary", () => {
    const Vehicle = defineResource("test.vehicle", {
      ready: resource.boolean(false),
      speed: resource.number(0),
      sphere: resource.vec3([1, 2, 3]),
      wheel: resource.nullableVec3(),
    });
    const store = createResourceStore();

    expect(store.has(Vehicle)).toBe(false);
    expect(store.read(Vehicle)).toEqual({
      ready: false,
      speed: 0,
      sphere: [1, 2, 3],
      wheel: null,
    });
    expect(store.has(Vehicle)).toBe(true);

    store.write(Vehicle, (state) => {
      state.ready = true;
      state.speed = 12.5;
      state.sphere[0] = 9;
      state.wheel = [4, 5, 6];
    });

    expect(store.read(Vehicle)).toEqual({
      ready: true,
      speed: 12.5,
      sphere: [9, 2, 3],
      wheel: [4, 5, 6],
    });
    expect(store.summary()).toEqual({
      count: 1,
      entries: [
        {
          id: "test.vehicle",
          version: 1,
          fields: [
            { name: "ready", kind: "boolean" },
            { name: "speed", kind: "number" },
            { name: "sphere", kind: "vec3" },
            { name: "wheel", kind: "nullableVec3" },
          ],
          values: {
            ready: true,
            speed: 12.5,
            sphere: [9, 2, 3],
            wheel: [4, 5, 6],
          },
        },
      ],
    });
  });

  it("clones defaults when resetting mutated state", () => {
    const initial: Vec3Tuple = [1, 2, 3];
    const Vehicle = defineResource("test.vehicle.reset", {
      sphere: resource.vec3(initial),
    });
    const store = createResourceStore();

    store.write(Vehicle, (state) => {
      state.sphere[0] = 99;
    });
    store.reset(Vehicle);

    expect(store.read(Vehicle).sphere).toEqual([1, 2, 3]);
    expect(store.read(Vehicle).sphere).not.toBe(initial);
  });

  it("patches initialized resources by id with typed value validation", () => {
    const Vehicle = defineResource("test.vehicle.patch", {
      ready: resource.boolean(false),
      speed: resource.number(0),
      sphere: resource.vec3([1, 2, 3]),
      facing: resource.quat(),
    });
    const store = createResourceStore();

    store.read(Vehicle);
    const entry = store.patchById("test.vehicle.patch", {
      ready: true,
      speed: 4.5,
      sphere: [9, 8, 7],
      facing: [0, 0.707, 0, 0.707],
    });

    expect(entry).toMatchObject({
      id: "test.vehicle.patch",
      version: 1,
      values: {
        ready: true,
        speed: 4.5,
        sphere: [9, 8, 7],
        facing: [0, 0.707, 0, 0.707],
      },
    });
    expect(store.read(Vehicle)).toEqual({
      ready: true,
      speed: 4.5,
      sphere: [9, 8, 7],
      facing: [0, 0.707, 0, 0.707],
    });
    expect(store.patchById("test.vehicle.missing", { speed: 1 })).toBeNull();
    expect(() =>
      store.patchById("test.vehicle.patch", { sphere: [1, 2] }),
    ).toThrow(/expects a vec3 value/);
    expect(() =>
      store.patchById("test.vehicle.patch", { missing: true }),
    ).toThrow(/has no field 'missing'/);
  });

  it("rejects incompatible descriptors with the same id", () => {
    const First = defineResource("test.conflict", {
      value: resource.number(1),
    });
    const Second = defineResource("test.conflict", {
      value: resource.string("one"),
    });
    const store = createResourceStore();

    store.read(First);

    expect(() => store.read(Second)).toThrow(
      /registered with a different schema/,
    );
  });
});
