import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createLocalTransform,
  createParent,
  createWorld,
  despawnRecursive,
  getChildren,
  quatFromAxisAngle,
  registerTransformComponents,
  resolveWorldTransforms,
  setParent,
  type Entity,
} from "@aperture-engine/simulation";

// M7-T1: bidirectional hierarchy — Children index + world-preserving setParent
// + recursive despawn. Parent stays authoritative for the resolver; Children is
// a derived index kept consistent on every setParent; reparenting preserves the
// entity's world-space transform (Bevy set_parent_in_place / reparented_to).

describe("transform hierarchy (M7-T1)", () => {
  it("setParent preserves the child's world transform and repoints Parent", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const parent = createTransformEntity(world, {
      translation: [5, 1, 0],
      rotation: quatFromAxisAngle([0, 0, 1], Math.PI / 2),
    });
    const child = createTransformEntity(world, { translation: [2, 0, 3] });

    resolveWorldTransforms(world);
    const before = readWorldMatrix(child);

    const result = setParent(world, child, parent);
    expect(result.ok).toBe(true);
    expect(sameRef(child.getValue(Parent, "entity"), parent)).toBe(true);

    const report = resolveWorldTransforms(world);
    expect(report.diagnostics).toEqual([]);
    expectMatrixClose(readWorldMatrix(child), before);
  });

  it("setParent(child, null) detaches and bakes the world transform into LocalTransform", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const parent = createTransformEntity(world, {
      translation: [5, 0, 0],
      rotation: quatFromAxisAngle([0, 1, 0], Math.PI / 3),
    });
    const child = createTransformEntity(world, {
      translation: [0, 2, 0],
      parent,
    });

    resolveWorldTransforms(world);
    const before = readWorldMatrix(child);

    const result = setParent(world, child, null);
    expect(result.ok).toBe(true);
    expect(child.getValue(Parent, "entity")).toBe(null);

    // After the next resolve the world transform is unchanged (now a root whose
    // LocalTransform equals the decomposed prior world transform).
    const report = resolveWorldTransforms(world);
    expect(report.diagnostics).toEqual([]);
    expectMatrixClose(readWorldMatrix(child), before);
    // A root's world == its local, so the baked local reproduces the old world.
    expectMatrixClose(readLocalMatrix(child), before);
  });

  it("getChildren returns the ordered list and reflects add/remove on both parents", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const parentA = createTransformEntity(world, { translation: [0, 0, 0] });
    const parentB = createTransformEntity(world, { translation: [10, 0, 0] });
    const childOne = createTransformEntity(world, { translation: [1, 0, 0] });
    const childTwo = createTransformEntity(world, { translation: [2, 0, 0] });
    resolveWorldTransforms(world);

    setParent(world, childOne, parentA);
    setParent(world, childTwo, parentA);
    expect(refs(getChildren(world, parentA))).toEqual([
      refOf(childOne),
      refOf(childTwo),
    ]);
    expect(getChildren(world, parentB)).toEqual([]);

    // Reparenting childOne to B removes it from A and appends to B.
    setParent(world, childOne, parentB);
    expect(refs(getChildren(world, parentA))).toEqual([refOf(childTwo)]);
    expect(refs(getChildren(world, parentB))).toEqual([refOf(childOne)]);
  });

  it("despawnRecursive destroys a 3-deep subtree and leaves no stale parent refs", () => {
    const world = createWorld({ entityCapacity: 16 });
    registerTransformComponents(world);
    const top = createTransformEntity(world, { translation: [0, 0, 0] });
    const a = createTransformEntity(world, { translation: [1, 0, 0] });
    const b = createTransformEntity(world, { translation: [0, 1, 0] });
    const c = createTransformEntity(world, { translation: [0, 0, 1] });
    const sibling = createTransformEntity(world, { translation: [9, 9, 9] });
    resolveWorldTransforms(world);

    setParent(world, a, top);
    setParent(world, b, a);
    setParent(world, c, b);

    const destroyed = despawnRecursive(world, a);
    expect(destroyed).toBe(3); // a, b, c

    expect(a.active).toBe(false);
    expect(b.active).toBe(false);
    expect(c.active).toBe(false);
    expect(top.active).toBe(true);
    expect(sibling.active).toBe(true);

    // top no longer lists the destroyed subtree, and nothing live points at it.
    expect(getChildren(world, top)).toEqual([]);
    const report = resolveWorldTransforms(world);
    expect(report.diagnostics).toEqual([]);
  });

  it("despawnRecursive tears down a subtree parented via direct Parent writes (glTF replay) without leaking orphans", () => {
    const world = createWorld({ entityCapacity: 16 });
    registerTransformComponents(world);
    // Mirror glTF scene replay: children get their `Parent` set directly (the
    // `parent` option = addComponent(Parent, ...)), so the root's derived
    // `Children` index is never populated.
    const root = createTransformEntity(world, { translation: [7, 0, -3] });
    const node = createTransformEntity(world, { translation: [0, 0, 0], parent: root });
    const primitive = createTransformEntity(world, {
      translation: [0, 0, 0],
      parent: node,
    });
    const survivor = createTransformEntity(world, { translation: [1, 0, 0] });
    resolveWorldTransforms(world);

    // The Children index is empty because nothing went through setParent.
    expect(getChildren(world, root)).toEqual([]);

    // Before the fix this returned 1 and node/primitive survived as detached
    // roots at the world origin; now the whole subtree is destroyed.
    const destroyed = despawnRecursive(world, root);
    expect(destroyed).toBe(3); // root, node, primitive

    expect(root.active).toBe(false);
    expect(node.active).toBe(false);
    expect(primitive.active).toBe(false);
    expect(survivor.active).toBe(true);

    const report = resolveWorldTransforms(world);
    expect(report.diagnostics).toEqual([]);
  });

  it("rejects a setParent that would create a cycle without mutating Parent", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerTransformComponents(world);
    const a = createTransformEntity(world, { translation: [1, 0, 0] });
    const b = createTransformEntity(world, { translation: [0, 1, 0] });
    resolveWorldTransforms(world);

    setParent(world, b, a); // b under a
    const result = setParent(world, a, b); // a under b → cycle

    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("cycle");
    // a's Parent was not written (still a root).
    expect(a.getValue(Parent, "entity")).toBe(null);

    // The resolver sees a valid tree (no cycle was committed).
    const report = resolveWorldTransforms(world);
    expect(report.resolved).toBe(2);
    expect(
      report.diagnostics.filter((diagnostic) => diagnostic.code === "cycle"),
    ).toEqual([]);
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
  } else {
    entity.addComponent(Parent, createParent(null));
  }
  entity.addComponent(WorldTransform);
  return entity;
}

function readWorldMatrix(entity: Entity): number[] {
  return [
    ...entity.getVectorView(WorldTransform, "col0"),
    ...entity.getVectorView(WorldTransform, "col1"),
    ...entity.getVectorView(WorldTransform, "col2"),
    ...entity.getVectorView(WorldTransform, "col3"),
  ];
}

function readLocalMatrix(entity: Entity): number[] {
  const t = [...entity.getVectorView(LocalTransform, "translation")];
  const r = [...entity.getVectorView(LocalTransform, "rotation")];
  const s = [...entity.getVectorView(LocalTransform, "scale")];
  // Compose TRS → column-major matrix (matches WorldTransform layout for a root).
  return composeColumnMajor(t, r, s);
}

function composeColumnMajor(t: number[], r: number[], s: number[]): number[] {
  const [x, y, z, w] = r as [number, number, number, number];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const [sx, sy, sz] = s as [number, number, number];
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    t[0] ?? 0,
    t[1] ?? 0,
    t[2] ?? 0,
    1,
  ];
}

function expectMatrixClose(actual: number[], expected: number[]): void {
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    expect(actual[index] ?? 0).toBeCloseTo(expected[index] ?? 0, 5);
  }
}

function refOf(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function refs(entities: readonly Entity[]): string[] {
  return entities.map(refOf);
}

function sameRef(a: Entity | null, b: Entity | null): boolean {
  return a !== null && b !== null && refOf(a) === refOf(b);
}
