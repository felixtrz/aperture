import { describe, expect, it } from "vitest";
import {
  Camera,
  Fog,
  FogMode,
  InstanceTint,
  Light,
  Material,
  Mesh,
  RenderLayer,
  ShadowCaster,
  ShadowReceiver,
  Skybox,
  Visibility,
  createBoxMeshAsset,
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  createCamera,
  createRenderAssetCollections,
  createTextureAsset,
  createUnlitMaterialAsset,
  type GltfEcsAuthoringCommandPlan,
} from "@aperture-engine/render";
import {
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  assetHandleKey,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  Spin,
  SpinSystem,
  applyGltfEcsCommandPlanToApp,
  createExtractionApp,
  createSimulationApp,
  withCamera,
  withEnvironmentMap,
  withFog,
  withInstanceTint,
  withMaterial,
  withMesh,
  withRenderLayer,
  withShadowCaster,
  withShadowReceiver,
  withSpin,
  withSkybox,
  withTransform,
  withVisibility,
} from "@aperture-engine/runtime";

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
      withShadowCaster(false),
      withShadowReceiver(true),
      withVisibility(true),
      withInstanceTint([0.9, 0.25, 0.4, 1]),
      withSpin({ radiansPerSecond: Math.PI, axis: [0, 1, 0] }),
    );

    const snapshot = app.stepAndExtract(1 / 60, 1, 7);

    expect(cube.hasComponent(Mesh)).toBe(true);
    expect(cube.hasComponent(Material)).toBe(true);
    expect(cube.hasComponent(ShadowCaster)).toBe(true);
    expect(cube.hasComponent(ShadowReceiver)).toBe(true);
    expect(cube.hasComponent(InstanceTint)).toBe(true);
    expect(cube.hasComponent(Spin)).toBe(true);
    expect(cube.getValue(Mesh, "meshId")).toBe(assetHandleKey(mesh));
    expect(cube.getValue(Material, "materialId")).toBe(
      assetHandleKey(material),
    );
    expect(cube.getValue(ShadowCaster, "enabled")).toBe(false);
    expect(cube.getValue(ShadowReceiver, "enabled")).toBe(true);
    expect(Array.from(cube.getVectorView(InstanceTint, "color"))).toEqual([
      expect.closeTo(0.9, 5),
      0.25,
      expect.closeTo(0.4, 5),
      1,
    ]);
    expect(
      Array.from(cube.getVectorView(LocalTransform, "rotation")),
    ).not.toEqual([0, 0, 0, 1]);
    expect(snapshot.frame).toBe(7);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.meshDraws[0]).toMatchObject({
      castsShadow: false,
      instanceTintOffset: 0,
      receivesShadow: true,
    });
    expect(Array.from(snapshot.instanceTints ?? [])).toEqual([
      expect.closeTo(0.9, 5),
      0.25,
      expect.closeTo(0.4, 5),
      1,
    ]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("spawns an ECS-authored environment map light with a stable handle", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 4 } });
    const environmentMap = createEnvironmentMapHandle("studio");

    app.assets.register(environmentMap);
    app.assets.markReady(environmentMap, { label: "Studio" });
    const environment = app.spawn(
      withEnvironmentMap(environmentMap, {
        intensity: 1.25,
        color: [0.8, 0.9, 1, 1],
        layerMask: 3,
      }),
    );

    const snapshot = app.stepAndExtract(1 / 60, 1, 11);

    expect(environment.hasComponent(Light)).toBe(true);
    expect(environment.getValue(Light, "kind")).toBe("environment");
    expect(environment.getValue(Light, "environmentMapId")).toBe(
      assetHandleKey(environmentMap),
    );
    expect(snapshot.environments).toHaveLength(1);
    expect(snapshot.environments[0]).toMatchObject({
      handle: environmentMap,
      intensity: 1.25,
      layerMask: 3,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("spawns an ECS-authored skybox with a cube texture handle", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 4 } });
    const texture = createTextureHandle("runtime-skybox");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "RuntimeSkybox",
        dimension: "cube",
        width: 1,
        height: 1,
        depthOrLayers: 6,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );

    const skybox = app.spawn(withSkybox({ texture, intensity: 0.75 }));
    const snapshot = app.stepAndExtract(1 / 60, 1, 12);

    expect(skybox.hasComponent(Skybox)).toBe(true);
    expect(skybox.getValue(Skybox, "textureId")).toBe(assetHandleKey(texture));
    expect(snapshot.skyboxes).toHaveLength(1);
    expect(snapshot.skyboxes?.[0]).toMatchObject({
      texture,
      intensity: 0.75,
      layerMask: 1,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("spawns ECS-authored fog parameters", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 4 } });

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const fog = app.spawn(
      withFog({
        mode: FogMode.Exp,
        color: [0.5, 0.62, 0.76, 0.85],
        density: 0.08,
      }),
      withRenderLayer(1),
    );
    const snapshot = app.stepAndExtract(1 / 60, 1, 13);

    expect(fog.hasComponent(Fog)).toBe(true);
    expect(fog.getValue(Fog, "mode")).toBe(FogMode.Exp);
    expect(snapshot.fogs).toHaveLength(1);
    expect(snapshot.fogs?.[0]).toMatchObject({
      mode: FogMode.Exp,
      color: [
        0.5,
        expect.closeTo(0.62, 5),
        expect.closeTo(0.76, 5),
        expect.closeTo(0.85, 5),
      ],
      density: expect.closeTo(0.08, 5),
      layerMask: 1,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("applies a GLTF ECS command plan through an explicit runtime facade", () => {
    const app = createSimulationApp({ worldOptions: { entityCapacity: 8 } });
    const replay = applyGltfEcsCommandPlanToApp({
      app,
      plan: basicCommandPlan(),
    });
    const scene = replay.entitiesByKey.get("gltf:scene:0");
    const node = replay.entitiesByKey.get("gltf:node:0");

    expect(replay.valid).toBe(true);
    expect(replay.created.map((entry) => entry.entityKey)).toEqual([
      "gltf:scene:0",
      "gltf:node:0",
    ]);
    expect(scene?.getValue(Name, "value")).toBe("Scene0");
    expect(node?.getValue(Name, "value")).toBe("Node");
    expect(node?.getValue(Parent, "entity")).toBe(scene);
  });

  it("does not create entities for invalid GLTF ECS command plans", () => {
    const app = createSimulationApp({ worldOptions: { entityCapacity: 8 } });
    const replay = applyGltfEcsCommandPlanToApp({
      app,
      plan: {
        ...basicCommandPlan(),
        valid: false,
      },
    });

    expect(replay.valid).toBe(false);
    expect(replay.created).toEqual([]);
    expect(replay.entitiesByKey.size).toBe(0);
    expect(replay.diagnostics).toMatchObject([
      { code: "gltfEcsReplay.invalidPlan" },
    ]);
  });

  it("extracts render packets from replayed GLTF ECS command plans headlessly", () => {
    const app = createExtractionApp({ worldOptions: { entityCapacity: 12 } });
    const meshHandle = createMeshHandle("gltf:mesh:0:primitive:0");
    const materialHandle = createMaterialHandle("gltf:material:0");
    const camera = app.world.createEntity();
    const cameraTransform = createRootTransform({ translation: [0, 0, 5] });

    app.assets.register(meshHandle);
    app.assets.register(materialHandle);
    app.assets.markReady(meshHandle, createBoxMeshAsset());
    app.assets.markReady(materialHandle, createUnlitMaterialAsset());
    camera.addComponent(WorldTransform, cameraTransform.world);
    camera.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));

    const replay = applyGltfEcsCommandPlanToApp({
      app,
      plan: renderableCommandPlan(),
    });
    const snapshot = app.stepAndExtract(1 / 60, 1, 19);
    const draw = snapshot.meshDraws[0];

    expect(replay.valid).toBe(true);
    expect(snapshot.frame).toBe(19);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(draw).toBeDefined();
    if (draw === undefined) {
      return;
    }
    expect(assetHandleKey(draw.mesh)).toBe(assetHandleKey(meshHandle));
    expect(assetHandleKey(draw.material)).toBe(assetHandleKey(materialHandle));
    expect(snapshot.diagnostics).toEqual([]);
  });
});

function basicCommandPlan(): GltfEcsAuthoringCommandPlan {
  return createGltfEcsAuthoringCommandPlan({
    traversalReport: createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Node", translation: [1, 2, 3] }],
      },
    }),
  });
}

function renderableCommandPlan(): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:scene:0"],
    commands: [
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
      {
        type: "createEntity",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        label: "Primitive0",
      },
      {
        type: "addComponent",
        entityKey: "gltf:scene:0",
        component: "Name",
        value: { value: "Scene0" },
      },
      {
        type: "addComponent",
        entityKey: "gltf:scene:0",
        component: "Parent",
        value: { parentEntityKey: null },
      },
      {
        type: "addComponent",
        entityKey: "gltf:scene:0",
        component: "LocalTransform",
        value: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
      {
        type: "addComponent",
        entityKey: "gltf:scene:0",
        component: "WorldTransform",
        value: identityWorldTransformValue(),
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        component: "Parent",
        value: { parentEntityKey: "gltf:scene:0" },
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        component: "WorldTransform",
        value: identityWorldTransformValue(),
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        component: "Visibility",
        value: { visible: true },
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        component: "Mesh",
        value: {
          meshId: "gltf:mesh:0:primitive:0",
          handleKey: "mesh:gltf:mesh:0:primitive:0",
        },
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        component: "Material",
        value: {
          materialId: "gltf:material:0",
          handleKey: "material:gltf:material:0",
        },
      },
    ],
    dependencies: ["mesh:gltf:mesh:0:primitive:0", "material:gltf:material:0"],
    skipped: [],
    diagnostics: [],
  };
}

function identityWorldTransformValue() {
  return {
    col0: [1, 0, 0, 0],
    col1: [0, 1, 0, 0],
    col2: [0, 0, 1, 0],
    col3: [0, 0, 0, 1],
  } as const;
}
