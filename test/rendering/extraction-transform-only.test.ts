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

// AI-67 (readiness roadmap R5): transform-only changes refresh the cached
// packet's matrix + bounds without rebuilding the packet template; structural
// changes still rebuild; culling stays correct after moves.

function createScene(): {
  readonly app: ReturnType<typeof createExtractionApp>;
  readonly mover: Entity;
} {
  const app = createExtractionApp({ worldOptions: { entityCapacity: 16 } });
  const meshHandle = createMeshHandle("turn-cube");
  const materialHandle = createMaterialHandle("turn-unlit");
  const altMaterialHandle = createMaterialHandle("turn-unlit-alt");
  app.assets.register(meshHandle);
  app.assets.register(materialHandle);
  app.assets.register(altMaterialHandle);
  app.assets.markReady(meshHandle, createBoxMeshAsset({ label: "TurnCube" }));
  app.assets.markReady(
    materialHandle,
    createUnlitMaterialAsset({ label: "TurnUnlit" }),
  );
  app.assets.markReady(
    altMaterialHandle,
    createUnlitMaterialAsset({ label: "TurnUnlitAlt" }),
  );

  const camera = app.world.createEntity();
  camera.addComponent(
    WorldTransform,
    createRootTransform({ translation: [0, 0, 10] }).world,
  );
  camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

  const mover = app.world.createEntity();
  const root = createRootTransform({ translation: [0, 0, 0] });
  mover.addComponent(LocalTransform, root.local);
  mover.addComponent(WorldTransform, root.world);
  mover.addComponent(Mesh, { meshId: "mesh:turn-cube" });
  mover.addComponent(Material, { materialId: "material:turn-unlit" });
  mover.addComponent(RenderLayer, { mask: 1 });
  mover.addComponent(Visibility);

  return { app, mover };
}

describe("transform-only extraction fast path (AI-67)", () => {
  it("reuses the cached packet template across moves while updating matrix and bounds", () => {
    const { app, mover } = createScene();

    const first = app.extract(1);
    const firstDraw = first.meshDraws[0];
    expect(firstDraw).toBeDefined();

    // Move every frame (transform-only): vector write + resolution.
    mover.getVectorView(LocalTransform, "translation").set([2, 1, 0]);
    app.step(1 / 60, 1 / 60);
    const second = app.extract(2);
    const secondDraw = second.meshDraws[0];
    expect(secondDraw).toBeDefined();

    // The structural template remains stable while per-view sort metadata is
    // refreshed for the moved bounds.
    expect(secondDraw?.sortKey).toStrictEqual(firstDraw?.sortKey);
    expect(secondDraw?.batchKey).toBe(firstDraw?.batchKey);
    expect(secondDraw?.renderId).toBe(firstDraw?.renderId);
    expect(secondDraw?.material.id).toBe(firstDraw?.material.id);
    expect(secondDraw?.submesh).toBe(firstDraw?.submesh);

    // The matrix and bounds reflect the move.
    const offset = secondDraw?.worldTransformOffset ?? 0;
    expect(second.transforms[offset + 12]).toBeCloseTo(2, 5);
    expect(second.transforms[offset + 13]).toBeCloseTo(1, 5);
    const movedBounds = second.bounds[secondDraw?.boundsIndex ?? 0];
    expect(movedBounds?.worldSphere.center[0]).toBeCloseTo(2, 5);
    expect(movedBounds?.worldAabb.min[0]).toBeCloseTo(1.5, 5);
  });

  it("rebuilds the packet when a structural field changes", () => {
    const { app, mover } = createScene();

    const first = app.extract(1);
    const firstDraw = first.meshDraws[0];

    mover.setValue(Material, "materialId", "material:turn-unlit-alt");
    app.step(1 / 60, 1 / 60);
    const second = app.extract(2);
    const secondDraw = second.meshDraws[0];

    expect(secondDraw?.material.id).toBe("turn-unlit-alt");
    // A structural rebuild produces a fresh sort key object.
    expect(secondDraw?.sortKey).not.toBe(firstDraw?.sortKey);
  });

  it("keeps frustum culling correct across transform-only moves", () => {
    const { app, mover } = createScene();

    expect(app.extract(1).meshDraws).toHaveLength(1);

    // Far outside the camera frustum.
    mover.getVectorView(LocalTransform, "translation").set([500, 0, 0]);
    app.step(1 / 60, 1 / 60);
    expect(app.extract(2).meshDraws).toHaveLength(0);

    // And back in.
    mover.getVectorView(LocalTransform, "translation").set([0, 0, 0]);
    app.step(1 / 60, 2 / 60);
    expect(app.extract(3).meshDraws).toHaveLength(1);
  });

  it("extracts transform-only frames materially faster than structural-change frames", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 264 } });
    const meshHandle = createMeshHandle("perf-cube");
    const materialHandle = createMaterialHandle("perf-unlit");
    app.assets.register(meshHandle);
    app.assets.register(materialHandle);
    app.assets.markReady(meshHandle, createBoxMeshAsset({ label: "PerfCube" }));
    app.assets.markReady(
      materialHandle,
      createUnlitMaterialAsset({ label: "PerfUnlit" }),
    );

    const camera = app.world.createEntity();
    camera.addComponent(
      WorldTransform,
      createRootTransform({ translation: [0, 0, 40] }).world,
    );
    camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

    const entities: Entity[] = [];
    for (let index = 0; index < 256; index += 1) {
      const entity = app.world.createEntity();
      const root = createRootTransform({
        translation: [index % 16, Math.floor(index / 16), 0],
      });
      entity.addComponent(LocalTransform, root.local);
      entity.addComponent(WorldTransform, root.world);
      entity.addComponent(Mesh, { meshId: "mesh:perf-cube" });
      entity.addComponent(Material, { materialId: "material:perf-unlit" });
      entity.addComponent(RenderLayer, { mask: 1 });
      entity.addComponent(Visibility);
      entities.push(entity);
    }

    app.extract(0);

    const measure = (prepare: (frame: number) => void): number => {
      let total = 0;
      for (let frame = 1; frame <= 12; frame += 1) {
        prepare(frame);
        app.step(1 / 60, frame / 60);
        const start = performance.now();
        app.extract(frame);
        total += performance.now() - start;
      }
      return total;
    };

    const transformOnly = measure((frame) => {
      for (const entity of entities) {
        entity
          .getVectorView(LocalTransform, "translation")
          .set([
            (entity.index % 16) + frame * 0.01,
            Math.floor(entity.index / 16),
            0,
          ]);
      }
    });

    const structural = measure((frame) => {
      for (const entity of entities) {
        // Re-setting the same layer mask is a structural (non-transform)
        // write, invalidating the whole cached packet.
        entity.setValue(RenderLayer, "mask", 1 + (frame % 1));
      }
    });

    expect(transformOnly).toBeLessThan(structural);
  });
});
