import { describe, expect, it } from "vitest";

import {
  Camera,
  LocalTransform,
  Material,
  Mesh,
  RenderLayer,
  Visibility,
  WorldTransform,
  assetHandleKey,
  createBoxMeshAsset,
  createCamera,
  createExtractionApp,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  createSimulationApp,
  createUnlitMaterialAsset,
} from "@aperture-engine/core";

describe("runtime facade", () => {
  it("steps a headless simulation app and resolves transforms", () => {
    const app = createSimulationApp({ worldOptions: { entityCapacity: 4 } });
    const entity = app.world.createEntity();
    const root = createRootTransform({ translation: [1, 2, 3] });

    entity.addComponent(LocalTransform, root.local);
    entity.addComponent(WorldTransform, root.world);

    const result = app.step(1 / 60, 1);

    expect(result.transform.resolved).toBe(1);
    expect(result.transform.diagnostics).toEqual([]);
  });

  it("steps and extracts a render snapshot without importing WebGPU", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 8 } });
    const meshHandle = createMeshHandle("cube");
    const materialHandle = createMaterialHandle("white");
    const camera = app.world.createEntity();
    const cube = app.world.createEntity();
    const cameraTransform = createRootTransform({ translation: [0, 0, 5] });
    const cubeTransform = createRootTransform();

    app.assets.register(meshHandle);
    app.assets.register(materialHandle);
    app.assets.markReady(meshHandle, createBoxMeshAsset());
    app.assets.markReady(materialHandle, createUnlitMaterialAsset());

    camera.addComponent(WorldTransform, cameraTransform.world);
    camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

    cube.addComponent(WorldTransform, cubeTransform.world);
    cube.addComponent(Mesh, { meshId: assetHandleKey(meshHandle) });
    cube.addComponent(Material, { materialId: assetHandleKey(materialHandle) });
    cube.addComponent(RenderLayer, { mask: 1 });
    cube.addComponent(Visibility);

    const snapshot = app.stepAndExtract(1 / 60, 1, 42);

    expect(snapshot.frame).toBe(42);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
