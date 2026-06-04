import { describe, expect, it } from "vitest";
import {
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  DERIVED_COMPONENT_IDS,
  createComponentRegistry,
  createLocalTransform,
  createParent,
  createWorld,
  defineComponent,
  deserializeEntityComponents,
  registerMetadataComponents,
  registerTransformComponents,
  serializeEntityComponents,
  serializeEntityRef,
  type ComponentRegistry,
  type Entity,
} from "@aperture-engine/simulation";

// M7-T3: schema-driven component (de)serialization codec.

// Exercises every serializable field kind (Done-when #4).
const Mode = { Idle: "idle", Active: "active" } as const;
const KitchenSink = defineComponent("test.kitchensink", {
  count: { type: EcsType.Int32, default: 0 },
  ratio: { type: EcsType.Float32, default: 0 },
  flag: { type: EcsType.Boolean, default: false },
  label: { type: EcsType.String, default: "" },
  mode: { type: EcsType.Enum, default: Mode.Idle, enum: Mode },
  position: { type: EcsType.Vec3, default: [0, 0, 0] },
  rotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
  tint: { type: EcsType.Color, default: [1, 1, 1, 1] },
});

function makeWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  world.registerComponent(KitchenSink);
  return world;
}

function registry(): ComponentRegistry {
  return createComponentRegistry([
    LocalTransform,
    Name,
    Parent,
    WorldTransform,
    KitchenSink,
  ]);
}

describe("component (de)serialization codec (M7-T3)", () => {
  it("round-trips LocalTransform + Name + Parent bit-for-bit into a fresh entity", () => {
    const world = makeWorld();
    const parent = world.createEntity();
    parent.addComponent(LocalTransform, createLocalTransform());

    const source = world.createEntity();
    source.addComponent(
      LocalTransform,
      createLocalTransform({
        translation: [1.5, -2.25, 3.0],
        rotation: [0, 0, 0.7071067, 0.7071067],
        scale: [2, 4, 8],
      }),
    );
    source.addComponent(Name, { value: "crate" });
    source.addComponent(Parent, createParent(parent));

    const serialized = serializeEntityComponents(source);

    const target = world.createEntity();
    const result = deserializeEntityComponents(target, serialized, {
      registry: registry(),
      resolveEntity: (token) =>
        token === serializeEntityRef(parent) ? parent : null,
    });

    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    expect(result.applied).toEqual(
      expect.arrayContaining([LocalTransform.id, Name.id, Parent.id]),
    );

    // Every field reproduced into the fresh entity.
    expect(readVec(target, LocalTransform, "translation")).toEqual([
      1.5, -2.25, 3.0,
    ]);
    expect(readVec(target, LocalTransform, "scale")).toEqual([2, 4, 8]);
    expect(target.getValue(Name, "value")).toBe("crate");
    expect(target.getValue(Parent, "entity")).toBe(parent);

    // Re-serializing the reconstructed entity yields an identical record.
    expect(serializeEntityComponents(target)).toEqual(serialized);
  });

  it("serializes Entity-typed fields as index:generation tokens, never raw indices", () => {
    const world = makeWorld();
    const parent = world.createEntity();
    parent.addComponent(LocalTransform, createLocalTransform());
    const child = world.createEntity();
    child.addComponent(LocalTransform, createLocalTransform());
    child.addComponent(Parent, createParent(parent));

    const serialized = serializeEntityComponents(child);
    const parentRecord = serialized.find((entry) => entry.id === Parent.id);
    const token = parentRecord?.fields.entity;

    expect(typeof token).toBe("string");
    expect(token).toBe(serializeEntityRef(parent));
    expect(token).toMatch(/^\d+:\d+$/);
    expect(typeof token).not.toBe("number");

    // Without a resolver the ref deserializes to null + a diagnostic (never a
    // raw numeric index is written into the Entity field).
    const target = world.createEntity();
    const result = deserializeEntityComponents(target, serialized, {
      registry: registry(),
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "aperture.serialization.unresolvedEntityRef",
    );
    expect(target.getValue(Parent, "entity")).toBeNull();
  });

  it("omits derived WorldTransform and reports unregistered ids without throwing", () => {
    const world = makeWorld();
    const entity = world.createEntity();
    entity.addComponent(LocalTransform, createLocalTransform());
    entity.addComponent(WorldTransform);

    const serialized = serializeEntityComponents(entity);
    expect(serialized.some((entry) => entry.id === WorldTransform.id)).toBe(
      false,
    );
    expect(serialized.some((entry) => entry.id === LocalTransform.id)).toBe(
      true,
    );
    expect(DERIVED_COMPONENT_IDS).toContain(WorldTransform.id);

    const target = world.createEntity();
    let result!: ReturnType<typeof deserializeEntityComponents>;
    expect(() => {
      result = deserializeEntityComponents(
        target,
        [{ id: "test.not-registered", fields: {} }],
        { registry: registry() },
      );
    }).not.toThrow();
    expect(result.ok).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe(
      "aperture.serialization.unregisteredComponent",
    );
  });

  it("round-trips enum / boolean / string / Vec3 / Vec4 / Color field kinds", () => {
    const world = makeWorld();
    const source = world.createEntity();
    source.addComponent(KitchenSink, {
      count: 7,
      ratio: 0.5,
      flag: true,
      label: "alpha",
      mode: Mode.Active,
      position: [0.25, 0.5, 0.75],
      rotation: [0, 0, 0.7071067, 0.7071067],
      tint: [0.2, 0.4, 0.6, 1],
    });

    const serialized = serializeEntityComponents(source);
    const sink = serialized.find((entry) => entry.id === KitchenSink.id);
    // The enum serializes its stable string value, not an index.
    expect(sink?.fields.mode).toBe("active");
    expect(sink?.fields.flag).toBe(true);
    expect(sink?.fields.label).toBe("alpha");

    const target = world.createEntity();
    const result = deserializeEntityComponents(target, serialized, {
      registry: registry(),
    });
    expect(result).toMatchObject({ ok: true, diagnostics: [] });

    expect(target.getValue(KitchenSink, "count")).toBe(7);
    expect(target.getValue(KitchenSink, "ratio")).toBe(0.5);
    expect(target.getValue(KitchenSink, "flag")).toBe(true);
    expect(target.getValue(KitchenSink, "label")).toBe("alpha");
    expect(target.getValue(KitchenSink, "mode")).toBe("active");
    expect(readVec(target, KitchenSink, "position")).toEqual([0.25, 0.5, 0.75]);
    expect(readVec(target, KitchenSink, "rotation")).toEqual(
      readVec(source, KitchenSink, "rotation"),
    );
    // Float32 quantization is deterministic, so the round-trip reproduces the
    // source's stored values exactly (0.2/0.4/0.6 are not exact doubles).
    expect(readVec(target, KitchenSink, "tint")).toEqual(
      readVec(source, KitchenSink, "tint"),
    );

    // JSON-safe + a clean re-serialize round-trip.
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    expect(serializeEntityComponents(target)).toEqual(serialized);
  });
});

function readVec(entity: Entity, component: unknown, key: string): number[] {
  return Array.from(
    (
      entity as unknown as {
        getVectorView(component: unknown, key: string): ArrayLike<number>;
      }
    ).getVectorView(component, key),
  );
}
