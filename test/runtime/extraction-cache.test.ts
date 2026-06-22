import { describe, expect, it } from "vitest";

import { createExtractionApp } from "@aperture-engine/runtime";
import {
  LocalTransform,
  WorldTransform,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Camera,
  Material,
  Mesh,
  RenderLayer,
  Visibility,
  createBoxMeshAsset,
  createCamera,
  createUnlitMaterialAsset,
} from "@aperture-engine/render";

// AI-13 (readiness roadmap R5): the per-app persistent RenderExtractionCache.
// Caching must be correctness-transparent (byte-identical snapshots), serve
// unchanged entities from cache, refresh mutated ones, and evict destroyed
// entities.

const ENTITY_COUNT = 64;

function setupScene(app: ReturnType<typeof createExtractionApp>): Entity[] {
  const meshHandle = createMeshHandle("cache-cube");
  const materialHandle = createMaterialHandle("cache-unlit");
  app.assets.register(meshHandle);
  app.assets.register(materialHandle);
  app.assets.markReady(meshHandle, createBoxMeshAsset({ label: "CacheCube" }));
  app.assets.markReady(
    materialHandle,
    createUnlitMaterialAsset({ label: "CacheUnlit" }),
  );

  const camera = app.world.createEntity();
  camera.addComponent(
    WorldTransform,
    createRootTransform({ translation: [0, 0, 20] }).world,
  );
  camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

  const entities: Entity[] = [];
  for (let index = 0; index < ENTITY_COUNT; index += 1) {
    const entity = app.world.createEntity();
    const root = createRootTransform({
      translation: [index % 8, Math.floor(index / 8), 0],
    });
    entity.addComponent(LocalTransform, root.local);
    entity.addComponent(WorldTransform, root.world);
    entity.addComponent(Mesh, { meshId: "mesh:cache-cube" });
    entity.addComponent(Material, { materialId: "material:cache-unlit" });
    entity.addComponent(RenderLayer, { mask: 1 });
    entity.addComponent(Visibility);
    entities.push(entity);
  }

  return entities;
}

function snapshotProjection(snapshot: {
  readonly meshDraws: readonly {
    readonly renderId: number;
    readonly worldTransformOffset: number;
    readonly mesh: { readonly id: string };
    readonly material: { readonly id: string };
  }[];
  readonly transforms: Float32Array;
  readonly bounds: readonly unknown[];
}): unknown {
  return {
    draws: snapshot.meshDraws.map((draw) => [
      draw.renderId,
      draw.mesh.id,
      draw.material.id,
      draw.worldTransformOffset,
    ]),
    transforms: Array.from(snapshot.transforms),
    bounds: JSON.parse(JSON.stringify(snapshot.bounds)),
  };
}

describe("persistent render extraction cache (AI-13)", () => {
  it("produces byte-identical snapshots to a cold extraction on a static scene", () => {
    const cachedApp = createExtractionApp({
      worldOptions: { entityCapacity: ENTITY_COUNT + 8 },
    });
    setupScene(cachedApp);
    cachedApp.extract(1);
    const warm = cachedApp.extract(2);

    const coldApp = createExtractionApp({
      worldOptions: { entityCapacity: ENTITY_COUNT + 8 },
    });
    setupScene(coldApp);
    const cold = coldApp.extract(2);

    expect(snapshotProjection(warm)).toEqual(snapshotProjection(cold));
    expect(warm.meshDraws).toHaveLength(ENTITY_COUNT);
  });

  it("re-extracts a mutated entity while preserving the rest from cache", () => {
    const app = createExtractionApp({
      worldOptions: { entityCapacity: ENTITY_COUNT + 8 },
    });
    const entities = setupScene(app);
    app.extract(1);

    // Stay inside the camera frustum — extraction culls out-of-view draws.
    const mutated = entities[3] as Entity;
    mutated.getVectorView(LocalTransform, "translation").set([4.5, 2.5, -3]);
    // Transform resolution runs inside step; re-resolve before extracting.
    app.step(1 / 60, 1 / 60);
    const snapshot = app.extract(2);

    const draw = snapshot.meshDraws.find(
      (candidate) => candidate.entity.index === mutated.index,
    );
    expect(draw).toBeDefined();

    const offset = draw?.worldTransformOffset ?? 0;
    const slice = Array.from(snapshot.transforms.subarray(offset, offset + 16));
    expect(slice[12]).toBeCloseTo(4.5, 5);
    expect(slice[13]).toBeCloseTo(2.5, 5);
    expect(slice[14]).toBeCloseTo(-3, 5);

    // Unchanged neighbours still draw at their original positions.
    const untouched = snapshot.meshDraws.find(
      (candidate) => candidate.entity.index === (entities[5] as Entity).index,
    );
    const untouchedSlice = Array.from(
      snapshot.transforms.subarray(
        untouched?.worldTransformOffset ?? 0,
        (untouched?.worldTransformOffset ?? 0) + 16,
      ),
    );
    expect(untouchedSlice[12]).toBeCloseTo(5, 5);
  });

  it("evicts destroyed entities so their draws and cache entries disappear", () => {
    const app = createExtractionApp({
      worldOptions: { entityCapacity: ENTITY_COUNT + 8 },
    });
    const entities = setupScene(app);
    app.extract(1);

    const doomed = entities[10] as Entity;
    const doomedIndex = doomed.index;
    doomed.destroy();
    app.step(1 / 60, 1 / 60);
    const snapshot = app.extract(2);

    expect(snapshot.meshDraws).toHaveLength(ENTITY_COUNT - 1);
    expect(
      snapshot.meshDraws.some((draw) => draw.entity.index === doomedIndex),
    ).toBe(false);
  });

  it("does materially less work for a static frame than a fully mutated one", () => {
    const app = createExtractionApp({
      worldOptions: { entityCapacity: ENTITY_COUNT + 8 },
    });
    const entities = setupScene(app);
    app.extract(1);

    const measure = (prepare: () => void): number => {
      let total = 0;
      for (let iteration = 0; iteration < 15; iteration += 1) {
        prepare();
        const start = performance.now();
        app.extract(iteration + 2);
        total += performance.now() - start;
      }
      return total;
    };

    const staticTime = measure(() => {});
    const mutatedTime = measure(() => {
      for (const entity of entities) {
        const translation = entity.getVectorView(LocalTransform, "translation");
        translation[2] = Number(translation[2] ?? 0) + 0.01;
        entity
          .getVectorView(WorldTransform, "col3")
          .set([
            Number(translation[0] ?? 0),
            Number(translation[1] ?? 0),
            Number(translation[2] ?? 0),
            1,
          ]);
      }
    });

    // Generous margin: the cached static path must beat full re-extraction.
    expect(staticTime).toBeLessThan(mutatedTime);
  });
});
