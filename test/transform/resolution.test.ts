import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  Parent,
  TransformResolutionSystem,
  WorldTransform,
  createLocalTransform,
  createParent,
  createWorld,
  getLastTransformResolutionReport,
  quatFromAxisAngle,
  registerTransformComponents,
  resolveWorldTransforms,
  type Entity,
  type TransformResolutionReport,
} from "@aperture-engine/simulation";

describe("transform resolution", () => {
  it("resolves root world transforms from local transforms on system update", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    world.registerSystem(TransformResolutionSystem);

    const root = createTransformEntity(world, { translation: [1, 2, 3] });

    world.update(1 / 60, 1);

    const report = getLastTransformResolutionReport(world);

    expect(report).toMatchObject({ resolved: 1, skipped: 0 });
    expect(report?.diagnostics).toEqual([]);
    expectWorldTranslation(root, [1, 2, 3]);
  });

  it("composes one-level and multi-level child world transforms", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const parent = createTransformEntity(world, {
      translation: [1, 0, 0],
      rotation: quatFromAxisAngle([0, 0, 1], Math.PI / 2),
    });
    const child = createTransformEntity(world, {
      translation: [2, 0, 0],
      parent,
    });
    const grandchild = createTransformEntity(world, {
      translation: [0, 0, 3],
      parent: child,
    });

    const report = resolveWorldTransforms(world);

    expect(report).toMatchObject({ resolved: 3, skipped: 0 });
    expect(report.diagnostics).toEqual([]);
    expectWorldTranslation(parent, [1, 0, 0]);
    expectWorldTranslation(child, [1, 2, 0]);
    expectWorldTranslation(grandchild, [1, 2, 3]);
  });

  it("updates child world transforms after keep-local reparenting", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const firstParent = createTransformEntity(world, {
      translation: [1, 0, 0],
    });
    const secondParent = createTransformEntity(world, {
      translation: [0, 0, 5],
    });
    const child = createTransformEntity(world, {
      translation: [0, 1, 0],
      parent: firstParent,
    });

    resolveWorldTransforms(world);

    expectWorldTranslation(child, [1, 1, 0]);

    child.setValue(Parent, "entity", secondParent);

    const report = resolveWorldTransforms(world);

    expect(report).toMatchObject({ resolved: 3, skipped: 0 });
    expectWorldTranslation(child, [0, 1, 5]);
    expectVector(child.getVectorView(LocalTransform, "translation"), [0, 1, 0]);
  });

  it("diagnoses active parents missing transform components and resolves children as roots", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const missingTransformParent = world.createEntity();
    const child = createTransformEntity(world, {
      translation: [0, 2, 0],
      parent: missingTransformParent,
    });

    const report = resolveWorldTransforms(world);

    expect(report).toMatchObject({ resolved: 1, skipped: 0 });
    expectDiagnosticCodes(report, ["missing-parent-transform"]);
    expectWorldTranslation(child, [0, 2, 0]);
  });

  it("diagnoses destroyed parent references and resolves children as roots", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const parent = createTransformEntity(world, { translation: [10, 0, 0] });
    const child = createTransformEntity(world, {
      translation: [0, 2, 0],
      parent,
    });

    parent.destroy();

    const report = resolveWorldTransforms(world);

    expect(report).toMatchObject({ resolved: 1, skipped: 0 });
    expectDiagnosticCodes(report, ["stale-parent"]);
    expectWorldTranslation(child, [0, 2, 0]);
  });

  it("diagnoses cycles and skips cyclic entities without recursing forever", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const first = createTransformEntity(world, { translation: [1, 0, 0] });
    const second = createTransformEntity(world, { translation: [0, 1, 0] });

    first.addComponent(Parent, createParent(second));
    second.addComponent(Parent, createParent(first));

    const report = resolveWorldTransforms(world);

    expect(report.resolved).toBe(0);
    expect(report.skipped).toBe(2);
    expect(
      report.diagnostics.filter((diagnostic) => diagnostic.code === "cycle"),
    ).toHaveLength(2);
    expectWorldTranslation(first, [0, 0, 0]);
    expectWorldTranslation(second, [0, 0, 0]);
  });
});

interface TransformEntityOptions {
  readonly translation: readonly [number, number, number];
  readonly rotation?: Float32Array;
  readonly parent?: Entity;
}

function createTransformEntity(
  world: ReturnType<typeof createWorld>,
  options: TransformEntityOptions,
): Entity {
  const entity = world.createEntity();
  const local =
    options.rotation === undefined
      ? createLocalTransform({ translation: options.translation })
      : createLocalTransform({
          translation: options.translation,
          rotation: options.rotation,
        });

  entity.addComponent(LocalTransform, local);

  if (options.parent !== undefined) {
    entity.addComponent(Parent, createParent(options.parent));
  }

  entity.addComponent(WorldTransform);
  return entity;
}

function expectWorldTranslation(
  entity: Entity,
  expected: readonly [number, number, number],
): void {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  expectVector([read(col3, 0), read(col3, 1), read(col3, 2)], expected);
}

function expectVector(
  actual: ArrayLike<number>,
  expected: readonly number[],
): void {
  expect(actual.length).toBe(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    expect(read(actual, index)).toBeCloseTo(read(expected, index), 5);
  }
}

function expectDiagnosticCodes(
  report: TransformResolutionReport,
  codes: readonly string[],
): void {
  expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
    codes,
  );
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
