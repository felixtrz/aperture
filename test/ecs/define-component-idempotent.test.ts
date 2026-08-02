import { describe, expect, it } from "vitest";
import {
  EcsType,
  createWorld,
  defineComponent,
  type DataType,
  type TypedSchema,
} from "@aperture-engine/simulation";

let nextComponentId = 0;

// The component registry is process-global (that is the point of the
// feature under test), so ids are namespaced to this file to avoid
// collisions with other test files sharing the process.
function testComponentId(name: string): string {
  nextComponentId += 1;
  return `aperture.test.define-idempotent.${name}.${nextComponentId}`;
}

describe("defineComponent idempotency by id", () => {
  it("returns the existing component for a structurally equal schema", () => {
    const id = testComponentId("Health");
    const schema: TypedSchema<DataType> = {
      current: { type: EcsType.Int32, default: 100 },
      maximum: { type: EcsType.Int32, default: 100 },
      velocity: { type: EcsType.Vec3, default: [0, 0, 0] },
    };
    const Health = defineComponent(id, schema);

    // Same schema object reference (module re-imported from cache).
    expect(defineComponent(id, schema)).toBe(Health);

    // A fresh-but-structurally-equal schema literal (module source re-run):
    // new field objects and a new default array, same layout.
    expect(
      defineComponent(id, {
        current: { type: EcsType.Int32, default: 100 },
        maximum: { type: EcsType.Int32, default: 100 },
        velocity: { type: EcsType.Vec3, default: [0, 0, 0] },
      }),
    ).toBe(Health);

    // Key declaration order is not part of the layout.
    expect(
      defineComponent(id, {
        velocity: { type: EcsType.Vec3, default: [0, 0, 0] },
        maximum: { type: EcsType.Int32, default: 100 },
        current: { type: EcsType.Int32, default: 100 },
      }),
    ).toBe(Health);
  });

  it("throws a restart diagnostic when a field's type changes", () => {
    const id = testComponentId("Charge");
    defineComponent(id, {
      amount: { type: EcsType.Int32, default: 0 },
    });

    expect(() =>
      defineComponent(id, {
        amount: { type: EcsType.Float32, default: 0 },
      }),
    ).toThrow(
      new RegExp(
        `Component with id '${id}' was redefined.*Restart the host`,
        "s",
      ),
    );
  });

  it("throws a restart diagnostic when a field is added or removed", () => {
    const id = testComponentId("Pose");
    defineComponent(id, {
      position: { type: EcsType.Vec3, default: [0, 0, 0] },
      heading: { type: EcsType.Float32, default: 0 },
    });

    expect(() =>
      defineComponent(id, {
        position: { type: EcsType.Vec3, default: [0, 0, 0] },
        heading: { type: EcsType.Float32, default: 0 },
        pitch: { type: EcsType.Float32, default: 0 },
      }),
    ).toThrow(/Restart the host/);

    expect(() =>
      defineComponent(id, {
        position: { type: EcsType.Vec3, default: [0, 0, 0] },
      }),
    ).toThrow(/Restart the host/);
  });

  it("keeps a reused component fully usable in a world", () => {
    const id = testComponentId("Score");
    defineComponent(id, {
      points: { type: EcsType.Int32, default: 0 },
    });
    // The reload path: a second definition hands back the reused descriptor.
    const Score = defineComponent(id, {
      points: { type: EcsType.Int32, default: 0 },
    });

    const world = createWorld({ entityCapacity: 4 });
    world.registerComponent(Score);

    const query = world.queryManager.registerQuery({ required: [Score] });
    const entity = world.createEntity();

    entity.addComponent(Score, { points: 7 });

    expect(entity.hasComponent(Score)).toBe(true);
    expect(entity.getValue(Score, "points")).toBe(7);
    expect(query.entities.has(entity)).toBe(true);

    entity.setValue(Score, "points", 11);

    expect(entity.getValue(Score, "points")).toBe(11);

    entity.removeComponent(Score);

    expect(entity.hasComponent(Score)).toBe(false);
    expect(query.entities.has(entity)).toBe(false);
  });
});
