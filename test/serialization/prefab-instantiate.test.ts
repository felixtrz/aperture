import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createComponentRegistry,
  createLocalTransform,
  createParent,
  createWorld,
  instantiatePrefab,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  saveScene,
  setParent,
  type ApertureSceneDocument,
  type Entity,
} from "@aperture-engine/simulation";

// M7-T5: prefab instantiate with per-instance overrides.

function buildPrefabDocument(): ApertureSceneDocument {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);

  const make = (name: string): Entity => {
    const entity = world.createEntity();
    entity.addComponent(LocalTransform, createLocalTransform());
    entity.addComponent(Parent, createParent(null));
    entity.addComponent(WorldTransform);
    entity.addComponent(Name, { value: name });
    return entity;
  };

  const root = make("root");
  const childA = make("childA");
  const childB = make("childB");
  resolveWorldTransforms(world);
  setParent(world, childA, root);
  setParent(world, childB, root);
  childA.getVectorView(LocalTransform, "translation").set([1, 0, 0]);
  childB.getVectorView(LocalTransform, "translation").set([0, 1, 0]);
  resolveWorldTransforms(world);

  return saveScene(world);
}

function registry() {
  return createComponentRegistry([LocalTransform, Parent, Name]);
}

function findByName(
  entities: readonly Entity[],
  name: string,
): Entity | undefined {
  return entities.find((entity) => entity.getValue(Name, "value") === name);
}

function idByName(document: ApertureSceneDocument, name: string): string {
  const record = document.entities.find(
    (entity) =>
      entity.components.find((component) => component.id === Name.id)?.fields
        .value === name,
  );
  if (record === undefined) {
    throw new Error(`No prefab record named ${name}`);
  }
  return record.id;
}

function localTranslation(entity: Entity): number[] {
  return Array.from(entity.getVectorView(LocalTransform, "translation"));
}

function worldTranslation(entity: Entity): number[] {
  return Array.from(entity.getVectorView(WorldTransform, "col3")).slice(0, 3);
}

function expectClose(actual: number[], expected: number[]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i] ?? 0).toBeCloseTo(expected[i] ?? 0, 5);
  }
}

describe("prefab instantiate (M7-T5)", () => {
  it("instantiates a 3-entity prefab twice into independent subtrees", () => {
    const document = buildPrefabDocument();
    const world = createWorld({ entityCapacity: 32 });
    const reg = registry();

    const first = instantiatePrefab(world, document, { registry: reg });
    const second = instantiatePrefab(world, document, { registry: reg });

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(first.entities).toHaveLength(3);
    expect(second.entities).toHaveLength(3);

    // 6 distinct new entities.
    const indices = [...first.entities, ...second.entities].map((e) => e.index);
    expect(new Set(indices).size).toBe(6);

    // Mutating one instance does not affect the other.
    findByName(first.entities, "childA")!.setValue(Name, "value", "mutated");
    expect(findByName(second.entities, "childA")!.getValue(Name, "value")).toBe(
      "childA",
    );
  });

  it("applies a root transform override while child locals match the prefab", () => {
    const document = buildPrefabDocument();
    const world = createWorld({ entityCapacity: 16 });

    const instance = instantiatePrefab(world, document, {
      registry: registry(),
      transform: { translation: [7, 8, 9] },
    });
    expect(instance.root).not.toBeNull();

    expect(localTranslation(instance.root!)).toEqual([7, 8, 9]);
    expect(localTranslation(findByName(instance.entities, "childA")!)).toEqual([
      1, 0, 0,
    ]);
    expectClose(worldTranslation(instance.root!), [7, 8, 9]);
    expectClose(
      worldTranslation(findByName(instance.entities, "childA")!),
      [8, 8, 9],
    );
  });

  it("applies a per-id field override to only that instance and rejects unknown ids", () => {
    const document = buildPrefabDocument();
    const world = createWorld({ entityCapacity: 32 });
    const reg = registry();
    const childAId = idByName(document, "childA");

    const overridden = instantiatePrefab(world, document, {
      registry: reg,
      overrides: [
        { id: childAId, component: Name.id, field: "value", value: "renamed" },
      ],
    });
    const plain = instantiatePrefab(world, document, { registry: reg });

    expect(overridden).toMatchObject({ ok: true });
    expect(overridden.entities.map((e) => e.getValue(Name, "value"))).toEqual(
      expect.arrayContaining(["root", "renamed", "childB"]),
    );
    // The other instance is untouched.
    expect(plain.entities.map((e) => e.getValue(Name, "value"))).toEqual(
      expect.arrayContaining(["root", "childA", "childB"]),
    );

    // An unknown prefab-local id fails loudly with a diagnostic.
    const bad = instantiatePrefab(world, document, {
      registry: reg,
      overrides: [
        { id: "9999:9999", component: Name.id, field: "value", value: "x" },
      ],
    });
    expect(bad.ok).toBe(false);
    expect(
      bad.diagnostics.some(
        (d) => d.code === "aperture.prefab.unknownOverrideId",
      ),
    ).toBe(true);
  });
});
