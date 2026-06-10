import { describe, expect, it } from "vitest";

import { createExtractionApp } from "@aperture-engine/runtime";
import {
  WorldTransform,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
} from "@aperture-engine/simulation";
import {
  Camera,
  Material,
  Mesh,
  RenderLayer,
  Visibility,
  createBoxMeshAsset,
  createCamera,
  createRenderExtractionCache,
  createUnlitMaterialAsset,
  extractRenderSnapshot,
} from "@aperture-engine/render";

// AI-30 (readiness roadmap R5): persistent extraction scratch. The numeric
// accumulators are reused across frames via the app-owned cache while every
// returned snapshot keeps independently-owned typed arrays.

function buildApp(entityCount: number): ReturnType<typeof createExtractionApp> {
  const app = createExtractionApp({
    worldOptions: { entityCapacity: entityCount + 8 },
  });
  const meshHandle = createMeshHandle("scratch-cube");
  const materialHandle = createMaterialHandle("scratch-unlit");
  app.assets.register(meshHandle);
  app.assets.register(materialHandle);
  app.assets.markReady(
    meshHandle,
    createBoxMeshAsset({ label: "ScratchCube" }),
  );
  app.assets.markReady(
    materialHandle,
    createUnlitMaterialAsset({ label: "ScratchUnlit" }),
  );

  const camera = app.world.createEntity();
  camera.addComponent(
    WorldTransform,
    createRootTransform({ translation: [0, 0, 20] }).world,
  );
  camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

  for (let index = 0; index < entityCount; index += 1) {
    const entity = app.world.createEntity();
    entity.addComponent(
      WorldTransform,
      createRootTransform({
        translation: [index % 8, Math.floor(index / 8), 0],
      }).world,
    );
    entity.addComponent(Mesh, { meshId: "mesh:scratch-cube" });
    entity.addComponent(Material, { materialId: "material:scratch-unlit" });
    entity.addComponent(RenderLayer, { mask: 1 });
    entity.addComponent(Visibility);
  }

  return app;
}

describe("persistent extraction scratch (AI-30)", () => {
  it("returns distinct, identical typed arrays across consecutive cached frames", () => {
    const app = buildApp(16);
    const first = app.extract(1);
    const second = app.extract(2);

    expect(second.transforms).not.toBe(first.transforms);
    expect(Array.from(second.transforms)).toEqual(Array.from(first.transforms));
    expect(second.instanceTints).not.toBe(first.instanceTints);
    expect(second.viewMatrices).not.toBe(first.viewMatrices);
    expect(Array.from(second.viewMatrices)).toEqual(
      Array.from(first.viewMatrices),
    );
  });

  it("keeps returned snapshots immune to scratch reuse and caller mutation", () => {
    const app = buildApp(8);
    const first = app.extract(1);
    const firstCopy = Array.from(first.transforms);

    // Caller mutation of a returned snapshot must not leak into the next
    // frame, and the next frame must not rewrite the first snapshot.
    first.transforms.fill(123);
    const second = app.extract(2);

    expect(Array.from(second.transforms)).toEqual(firstCopy);
    expect(first.transforms[0]).toBe(123);
  });

  it("matches the cache-free extraction byte for byte (golden)", () => {
    const cachedApp = buildApp(24);
    cachedApp.extract(1);
    const warm = cachedApp.extract(2);

    const freshApp = buildApp(24);
    const cold = extractRenderSnapshot(freshApp.world, freshApp.assets, {
      frame: 2,
    });

    expect(Array.from(warm.transforms)).toEqual(Array.from(cold.transforms));
    expect(warm.meshDraws.map((draw) => draw.renderId)).toEqual(
      cold.meshDraws.map((draw) => draw.renderId),
    );
    expect(JSON.parse(JSON.stringify(warm.bounds))).toEqual(
      JSON.parse(JSON.stringify(cold.bounds)),
    );
  });

  it("reuses the same scratch arrays across frames (no per-call accumulators)", () => {
    const cache = createRenderExtractionCache();
    const app = buildApp(8);

    extractRenderSnapshot(app.world, app.assets, { frame: 1, cache });
    const transformsScratch = cache.scratch.transforms;
    const tintScratch = cache.scratch.instanceTints;

    extractRenderSnapshot(app.world, app.assets, { frame: 2, cache });

    expect(cache.scratch.transforms).toBe(transformsScratch);
    expect(cache.scratch.instanceTints).toBe(tintScratch);
    expect(transformsScratch.length).toBeGreaterThan(0);
  });

  it("still extracts correctly without any cache", () => {
    const app = buildApp(4);
    const snapshot = extractRenderSnapshot(app.world, app.assets, {
      frame: 1,
    });

    expect(snapshot.meshDraws).toHaveLength(4);
    expect(snapshot.transforms.length).toBeGreaterThan(0);
  });
});
