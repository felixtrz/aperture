import { describe, expect, it } from "vitest";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createRootTransform,
  createWorld,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

import { applyRenderSnapshotInterpolation } from "../../packages/app/src/render-interpolation.js";
import {
  RenderInterpolation,
  registerApertureAppComponents,
} from "../../packages/app/src/systems/components.js";

describe("render snapshot interpolation", () => {
  it("avoids per-draw Set allocation when no entity is interpolated", () => {
    const world = createTestWorld();
    const entity = world.createEntity();
    addTransform(entity, [0, 0, 0]);
    const transforms = new Float32Array(16 * 20);
    const snapshot = createSnapshot({
      transforms,
      meshDraws: Array.from({ length: 20 }, (_, index) => ({
        entity: entityRef(entity),
        worldTransformOffset: index * 16,
        boundsIndex: -1,
      })),
    });

    const NativeSet = globalThis.Set;
    let setConstructions = 0;
    class CountingSet<T> extends NativeSet<T> {
      constructor(values?: Iterable<T> | null) {
        setConstructions += 1;
        super(values ?? undefined);
      }
    }

    (globalThis as { Set: SetConstructor }).Set = CountingSet as SetConstructor;
    try {
      const report = applyRenderSnapshotInterpolation({
        snapshot,
        world,
        alpha: 0.5,
      });

      expect(report.transformWrites).toBe(0);
      expect(report.boundsWrites).toBe(0);
    } finally {
      (globalThis as { Set: SetConstructor }).Set = NativeSet;
    }

    expect(setConstructions).toBeLessThanOrEqual(4);
  });

  it("interpolates child packets through an interpolated parent chain", () => {
    const world = createTestWorld();
    const rig = world.createEntity();
    const child = world.createEntity();
    addTransform(rig, [10, 0, 0]);
    addInterpolation(rig, [0, 0, 0], [10, 0, 0]);
    addTransform(child, [1, 0, 0]);
    child.addComponent(Parent, { entity: rig });
    const transforms = new Float32Array(16);
    writeTranslationMatrix(transforms, 0, [11, 0, 0]);
    const snapshot = createSnapshot({
      transforms,
      meshDraws: [
        {
          entity: entityRef(child),
          worldTransformOffset: 0,
          boundsIndex: -1,
        },
      ],
    });

    const report = applyRenderSnapshotInterpolation({
      snapshot,
      world,
      alpha: 0.25,
    });

    expect(report.transformWrites).toBe(1);
    expect(snapshot.transforms[12]).toBeCloseTo(3.5, 5);
  });

  it("guards cyclic parent chains without rewriting packet transforms", () => {
    const world = createTestWorld();
    const first = world.createEntity();
    const second = world.createEntity();
    addTransform(first, [10, 0, 0]);
    addTransform(second, [20, 0, 0]);
    addInterpolation(first, [0, 0, 0], [10, 0, 0]);
    addInterpolation(second, [0, 0, 0], [20, 0, 0]);
    first.addComponent(Parent, { entity: second });
    second.addComponent(Parent, { entity: first });
    const transforms = new Float32Array(16);
    writeTranslationMatrix(transforms, 0, [10, 0, 0]);
    const snapshot = createSnapshot({
      transforms,
      meshDraws: [
        {
          entity: entityRef(first),
          worldTransformOffset: 0,
          boundsIndex: -1,
        },
      ],
    });

    const report = applyRenderSnapshotInterpolation({
      snapshot,
      world,
      alpha: 0.5,
    });

    expect(report.transformWrites).toBe(0);
    expect(snapshot.transforms[12]).toBeCloseTo(10, 5);
  });

  it("rewrites camera view and view-projection matrices from the interpolated pose", () => {
    const world = createTestWorld();
    const camera = world.createEntity();
    addTransform(camera, [10, 0, 5]);
    addInterpolation(camera, [0, 0, 5], [10, 0, 5]);
    const viewMatrices = new Float32Array(48);
    writeTranslationMatrix(viewMatrices, 0, [0, 0, -5]);
    writeIdentityMatrix(viewMatrices, 16);
    writeIdentityMatrix(viewMatrices, 32);
    const snapshot = createSnapshot({
      viewMatrices,
      views: [
        {
          camera: entityRef(camera),
          viewMatrixOffset: 0,
          projectionMatrixOffset: 16,
          viewProjectionMatrixOffset: 32,
        },
      ],
    });

    const report = applyRenderSnapshotInterpolation({
      snapshot,
      world,
      alpha: 0.25,
    });

    expect(report.viewWrites).toBe(1);
    expect(snapshot.viewMatrices[12]).toBeCloseTo(-2.5, 5);
    expect(snapshot.viewMatrices[14]).toBeCloseTo(-5, 5);
    expect(snapshot.viewMatrices[44]).toBeCloseTo(-2.5, 5);
    expect(snapshot.viewMatrices[46]).toBeCloseTo(-5, 5);
  });
});

function createTestWorld(): EcsWorld {
  return registerApertureAppComponents(createWorld({ entityCapacity: 16 }));
}

function addTransform(
  entity: Entity,
  translation: readonly [number, number, number],
): void {
  const transform = createRootTransform({ translation });
  entity.addComponent(LocalTransform, transform.local);
  entity.addComponent(WorldTransform, transform.world);
}

function addInterpolation(
  entity: Entity,
  previousTranslation: readonly [number, number, number],
  currentTranslation: readonly [number, number, number],
): void {
  entity.addComponent(RenderInterpolation, {
    initialized: true,
    previousTranslation,
    currentTranslation,
  });
}

function createSnapshot(options: {
  readonly transforms?: Float32Array;
  readonly viewMatrices?: Float32Array;
  readonly meshDraws?: readonly {
    readonly entity: { readonly index: number; readonly generation: number };
    readonly worldTransformOffset: number;
    readonly boundsIndex: number;
  }[];
  readonly views?: readonly {
    readonly camera: { readonly index: number; readonly generation: number };
    readonly viewMatrixOffset: number;
    readonly projectionMatrixOffset: number;
    readonly viewProjectionMatrixOffset: number;
  }[];
}): RenderSnapshot {
  return {
    transforms: options.transforms ?? new Float32Array(0),
    viewMatrices: options.viewMatrices ?? new Float32Array(0),
    meshDraws: options.meshDraws ?? [],
    shadowCasterDraws: [],
    spriteDraws: [],
    particleEmitters: [],
    views: options.views ?? [],
    bounds: [],
  } as unknown as RenderSnapshot;
}

function entityRef(entity: Entity): {
  readonly index: number;
  readonly generation: number;
} {
  return { index: entity.index, generation: entity.generation };
}

function writeIdentityMatrix(buffer: Float32Array, offset: number): void {
  buffer.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
}

function writeTranslationMatrix(
  buffer: Float32Array,
  offset: number,
  translation: readonly [number, number, number],
): void {
  buffer.set(
    [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      translation[0],
      translation[1],
      translation[2],
      1,
    ],
    offset,
  );
}
