import { describe, expect, it } from "vitest";

import {
  Camera,
  LocalTransform,
  Material,
  Mesh,
  RenderLayer,
  Spin,
  SpinSystem,
  Visibility,
  WorldTransform,
  assetHandleKey,
  createBoxMeshAsset,
  createCamera,
  createExtractionApp,
  createMaterialHandle,
  createMeshHandle,
  createRenderAssetCollections,
  createRootTransform,
  createSimulationApp,
  createUnlitMaterialAsset,
  withCamera,
  withMaterial,
  withMesh,
  withRenderLayer,
  withSpin,
  withTransform,
  withVisibility,
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

  it("spawns authored entities with typed helpers, spin system data, and extraction", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 8 } });
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(createUnlitMaterialAsset());

    app.registerSystem(SpinSystem);

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const cube = app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
      withSpin({ radiansPerSecond: Math.PI, axis: [0, 1, 0] }),
    );

    const snapshot = app.stepAndExtract(1 / 60, 1, 7);

    expect(cube.hasComponent(Mesh)).toBe(true);
    expect(cube.hasComponent(Material)).toBe(true);
    expect(cube.hasComponent(Spin)).toBe(true);
    expect(cube.getValue(Mesh, "meshId")).toBe(assetHandleKey(mesh));
    expect(cube.getValue(Material, "materialId")).toBe(
      assetHandleKey(material),
    );
    expect(
      Array.from(cube.getVectorView(LocalTransform, "rotation")),
    ).not.toEqual([0, 0, 0, 1]);
    expect(snapshot.frame).toBe(7);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
