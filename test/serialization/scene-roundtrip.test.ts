import { describe, expect, it } from "vitest";
import {
  APERTURE_SCENE_FORMAT_VERSION,
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createComponentRegistry,
  createLocalTransform,
  createParent,
  createWorld,
  defineComponent,
  getChildren,
  loadScene,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  saveScene,
  setParent,
  type ApertureSceneDocument,
  type Entity,
} from "@aperture-engine/simulation";
import {
  PhysicsBodyState,
  createPhysicsBodyState,
} from "@aperture-engine/physics";

// M7-T4: whole-world scene document save/load round-trip.

const Projection = {
  Perspective: "perspective",
  Orthographic: "orthographic",
} as const;
const CameraLens = defineComponent("test.camera-lens", {
  projection: {
    type: EcsType.Enum,
    default: Projection.Perspective,
    enum: Projection,
  },
  fovY: { type: EcsType.Float32, default: 1 },
  near: { type: EcsType.Float32, default: 0.1 },
  far: { type: EcsType.Float32, default: 100 },
});

interface SourceScene {
  readonly world: ReturnType<typeof createWorld>;
  readonly root: Entity;
  readonly childA: Entity;
  readonly childB: Entity;
  readonly camera: Entity;
}

function buildSourceScene(): SourceScene {
  const world = createWorld({ entityCapacity: 32 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  world.registerComponent(CameraLens);
  world.registerComponent(PhysicsBodyState);

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
  const camera = make("camera");
  camera.addComponent(CameraLens, {
    projection: Projection.Orthographic,
    fovY: 1.25,
    near: 0.5,
    far: 250,
  });

  root.getVectorView(LocalTransform, "translation").set([5, 0, 0]);
  root.addComponent(
    PhysicsBodyState,
    createPhysicsBodyState({
      currentTranslation: [100, 100, 100],
      backendBodyId: "derived-body",
    }),
  );
  camera.getVectorView(LocalTransform, "translation").set([0, 1, 10]);
  resolveWorldTransforms(world);

  // Establish the hierarchy (also creates the derived Children index on root),
  // then set the children's local offsets relative to the parent.
  setParent(world, childA, root);
  setParent(world, childB, root);
  childA.getVectorView(LocalTransform, "translation").set([1, 0, 0]);
  childB.getVectorView(LocalTransform, "translation").set([0, 2, 0]);
  resolveWorldTransforms(world);

  return { world, root, childA, childB, camera };
}

function registry() {
  return createComponentRegistry([LocalTransform, Parent, Name, CameraLens]);
}

function worldTranslation(entity: Entity): [number, number, number] {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

function localTranslation(entity: Entity): number[] {
  return Array.from(entity.getVectorView(LocalTransform, "translation"));
}

function byName(entities: readonly Entity[]): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const entity of entities) {
    map.set(entity.getValue(Name, "value") as string, entity);
  }
  return map;
}

function expectClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i] ?? 0).toBeCloseTo(expected[i] ?? 0, 5);
  }
}

describe("scene document save/load round-trip (M7-T4)", () => {
  it("round-trips a parent + 2 children + camera into a fresh world, preserving fields and hierarchy", () => {
    const source = buildSourceScene();
    const aRootIndex = source.root.index;

    const document = saveScene(source.world);
    expect(document.formatVersion).toBe(APERTURE_SCENE_FORMAT_VERSION);

    // Derived components are not serialized.
    for (const entity of document.entities) {
      const ids = entity.components.map((component) => component.id);
      expect(ids).not.toContain(WorldTransform.id);
      expect(ids).not.toContain("aperture.transform.children");
      expect(ids).not.toContain(PhysicsBodyState.id);
    }

    const json = JSON.parse(JSON.stringify(document)) as ApertureSceneDocument;

    // Fresh target world, with offset entities so reloaded indices differ from
    // the originals (proves the parent remap is not just index reuse).
    const target = createWorld({ entityCapacity: 32 });
    target.createEntity();
    target.createEntity();
    target.createEntity();

    const result = loadScene(target, json, { registry: registry() });
    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    expect(result.entities).toHaveLength(4);

    const loaded = byName(result.entities);
    const root = loaded.get("root")!;
    const childA = loaded.get("childA")!;
    const childB = loaded.get("childB")!;
    const camera = loaded.get("camera")!;

    // Done-when #1: every field reproduced + world transforms within 1e-5.
    expect(localTranslation(root)).toEqual([5, 0, 0]);
    expect(localTranslation(childA)).toEqual([1, 0, 0]);
    expect(localTranslation(childB)).toEqual([0, 2, 0]);
    expect(localTranslation(camera)).toEqual([0, 1, 10]);
    expectClose(worldTranslation(root), [5, 0, 0]);
    expectClose(worldTranslation(childA), [6, 0, 0]);
    expectClose(worldTranslation(childB), [5, 2, 0]);
    expectClose(worldTranslation(camera), [0, 1, 10]);
    expect(camera.getValue(CameraLens, "projection")).toBe("orthographic");
    expect(camera.getValue(CameraLens, "fovY")).toBe(1.25);
    expect(camera.getValue(CameraLens, "near")).toBe(0.5);
    expect(camera.getValue(CameraLens, "far")).toBe(250);

    // Done-when #2: parent refs point at the reloaded parents (remapped),
    // never at the original indices.
    expect(childA.getValue(Parent, "entity")).toBe(root);
    expect(childB.getValue(Parent, "entity")).toBe(root);
    expect(root.getValue(Parent, "entity")).toBeNull();
    expect(root.index).not.toBe(aRootIndex);
    expect(childA.getValue(Parent, "entity")?.index).toBe(root.index);

    // The derived Children index is rebuilt from the remapped Parent links.
    expect(getChildren(target, root).map((child) => child.index)).toEqual([
      childA.index,
      childB.index,
    ]);
  });

  it("produces a JSON-safe document that carries a formatVersion", () => {
    const source = buildSourceScene();
    const document = saveScene(source.world);

    expect(document.formatVersion).toBe(APERTURE_SCENE_FORMAT_VERSION);
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it("rejects an unknown formatVersion with a diagnostic and instantiates nothing", () => {
    const target = createWorld({ entityCapacity: 8 });
    const before = activeCount(target);

    const result = loadScene(
      target,
      {
        formatVersion: 999,
        entities: [
          { id: "0:0", components: [{ id: Name.id, fields: { value: "x" } }] },
        ],
      },
      { registry: registry() },
    );

    expect(result.ok).toBe(false);
    expect(result.entities).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe(
      "aperture.scene.unknownFormatVersion",
    );
    expect(activeCount(target)).toBe(before);
  });
});

function activeCount(world: ReturnType<typeof createWorld>): number {
  return [
    ...world.queryManager.registerQuery({ required: [] }).entities,
  ].filter((entity) => entity.active).length;
}
