import { describe, expect, it } from "vitest";
import {
  Camera,
  CameraProjection,
  AreaLightShape,
  Light,
  LightKind,
  LightShadowSettings,
  Fog,
  FogMode,
  Material,
  Mesh,
  MeshQueryAcceleration,
  MeshQueryAccelerationMode,
  MeshQueryAccelerationStrategy,
  MeshQueryDynamicPolicy,
  Pickable,
  PickablePrecision,
  RenderLayer,
  RenderOrder,
  ShadowCaster,
  ShadowReceiver,
  Skybox,
  Visibility,
  createCamera,
  createFog,
  createLight,
  createLightShadowSettings,
  createMeshQueryAcceleration,
  createPickable,
  createSkybox,
  registerRenderAuthoringComponents,
  validateCameraInput,
  validateFogInput,
  validateLightShadowSettingsInput,
  validateLightInput,
  validateSkyboxInput,
} from "@aperture-engine/render";
import {
  createEnvironmentMapHandle,
  createTextureHandle,
  createWorld,
} from "@aperture-engine/simulation";

describe("render authoring ECS components", () => {
  it("attaches, reads, updates, removes, and queries mesh render authoring data", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerRenderAuthoringComponents(world);
    const query = world.queryManager.registerQuery({
      required: [Mesh, Material, Visibility, RenderLayer],
    });
    const entity = world.createEntity();

    entity.addComponent(Mesh, {
      meshId: "mesh:cube",
    });
    entity.addComponent(Material, {
      materialId: "material:debug",
    });
    entity.addComponent(Visibility);
    entity.addComponent(RenderLayer, { mask: 0b101 });
    entity.addComponent(RenderOrder, { value: 12 });
    entity.addComponent(ShadowCaster);
    entity.addComponent(ShadowReceiver);

    expect(query.entities.has(entity)).toBe(true);
    expect(entity.getValue(Mesh, "meshId")).toBe("mesh:cube");
    expect(entity.getValue(Material, "materialId")).toBe("material:debug");
    expect(entity.getValue(Visibility, "visible")).toBe(true);
    expect(entity.getValue(RenderLayer, "mask")).toBe(0b101);
    expect(entity.getValue(RenderOrder, "value")).toBe(12);
    expect(entity.getValue(ShadowCaster, "enabled")).toBe(true);
    expect(entity.getValue(ShadowReceiver, "enabled")).toBe(true);

    entity.setValue(Visibility, "visible", false);
    entity.removeComponent(RenderLayer);

    expect(entity.getValue(Visibility, "visible")).toBe(false);
    expect(query.entities.has(entity)).toBe(false);
  });

  it("attaches and reads spatial pickability and mesh acceleration policy", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerRenderAuthoringComponents(world);
    const query = world.queryManager.registerQuery({
      required: [Pickable, MeshQueryAcceleration],
    });
    const entity = world.createEntity();

    entity.addComponent(
      Pickable,
      createPickable({
        enabled: true,
        layerMask: 0b0101,
        precision: PickablePrecision.VisualMesh,
        blocksLower: true,
        priority: 7,
      }),
    );
    entity.addComponent(
      MeshQueryAcceleration,
      createMeshQueryAcceleration({
        mode: MeshQueryAccelerationMode.Bvh,
        strategy: MeshQueryAccelerationStrategy.Sah,
        maxLeafSize: 4,
        maxDepth: 32,
        dynamicPolicy: MeshQueryDynamicPolicy.Refit,
        simplifiedMeshId: "mesh:proxy",
      }),
    );

    expect(query.entities.has(entity)).toBe(true);
    expect(entity.getValue(Pickable, "layerMask")).toBe(0b0101);
    expect(entity.getValue(Pickable, "precision")).toBe(
      PickablePrecision.VisualMesh,
    );
    expect(entity.getValue(Pickable, "blocksLower")).toBe(true);
    expect(entity.getValue(Pickable, "priority")).toBe(7);
    expect(entity.getValue(MeshQueryAcceleration, "mode")).toBe(
      MeshQueryAccelerationMode.Bvh,
    );
    expect(entity.getValue(MeshQueryAcceleration, "strategy")).toBe(
      MeshQueryAccelerationStrategy.Sah,
    );
    expect(entity.getValue(MeshQueryAcceleration, "maxLeafSize")).toBe(4);
    expect(entity.getValue(MeshQueryAcceleration, "maxDepth")).toBe(32);
    expect(entity.getValue(MeshQueryAcceleration, "dynamicPolicy")).toBe(
      MeshQueryDynamicPolicy.Refit,
    );
    expect(entity.getValue(MeshQueryAcceleration, "simplifiedMeshId")).toBe(
      "mesh:proxy",
    );
  });

  it("attaches and reads camera and light component data", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerRenderAuthoringComponents(world);
    const camera = world.createEntity();
    const light = world.createEntity();
    const environment = world.createEntity();
    const environmentMap = createEnvironmentMapHandle("studio");

    camera.addComponent(
      Camera,
      createCamera({
        projection: CameraProjection.Orthographic,
        orthographicHeight: 6,
        viewport: [0, 0, 0.5, 1],
        clearColor: [0.1, 0.2, 0.3, 1],
        priority: 3,
      }),
    );
    light.addComponent(
      Light,
      createLight({
        kind: LightKind.RectArea,
        shape: AreaLightShape.Disk,
        color: [1, 0.8, 0.5, 1],
        intensity: 2,
        width: 4,
        height: 2,
      }),
    );
    environment.addComponent(
      Light,
      createLight({
        kind: LightKind.Environment,
        environmentMap,
      }),
    );

    expect(camera.getValue(Camera, "projection")).toBe(
      CameraProjection.Orthographic,
    );
    expect(camera.getValue(Camera, "priority")).toBe(3);
    expect(camera.getValue(Camera, "autoAspect")).toBe(true);
    expectVector(camera.getVectorView(Camera, "viewport"), [0, 0, 0.5, 1]);
    expectVector(
      camera.getVectorView(Camera, "clearColor"),
      [0.1, 0.2, 0.3, 1],
    );
    expect(light.getValue(Light, "kind")).toBe(LightKind.RectArea);
    expect(light.getValue(Light, "shape")).toBe(AreaLightShape.Disk);
    expect(light.getValue(Light, "intensity")).toBe(2);
    expect(light.getValue(Light, "width")).toBe(4);
    expect(light.getValue(Light, "height")).toBe(2);
    expectVector(light.getVectorView(Light, "color"), [1, 0.8, 0.5, 1]);
    expect(environment.getValue(Light, "environmentMapId")).toBe(
      "environment-map:studio",
    );
  });

  it("marks explicitly-aspected cameras as fixed aspect", () => {
    expect(createCamera().autoAspect).toBe(true);
    expect(createCamera({ aspect: 16 / 9 }).autoAspect).toBe(false);
    expect(createCamera({ aspect: 16 / 9, autoAspect: true }).autoAspect).toBe(
      true,
    );
  });

  it("attaches and validates skybox authoring data", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerRenderAuthoringComponents(world);
    const texture = createTextureHandle("studio-cube");
    const skybox = world.createEntity();

    skybox.addComponent(
      Skybox,
      createSkybox({
        texture,
        intensity: 1.5,
      }),
    );

    expect(skybox.getValue(Skybox, "textureId")).toBe("texture:studio-cube");
    expect(skybox.getValue(Skybox, "samplerId")).toBe("");
    expect(skybox.getValue(Skybox, "intensity")).toBeCloseTo(1.5, 6);
    expect(
      validateSkyboxInput({
        texture,
        intensity: -1,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["skybox.invalidIntensity"]);
  });

  it("attaches and validates fog authoring data", () => {
    const world = createWorld({ entityCapacity: 4 });
    registerRenderAuthoringComponents(world);
    const fog = world.createEntity();

    fog.addComponent(
      Fog,
      createFog({
        mode: FogMode.Exp2,
        color: [0.62, 0.72, 0.84, 0.9],
        density: 0.035,
      }),
    );

    expect(fog.getValue(Fog, "mode")).toBe(FogMode.Exp2);
    expectVector(fog.getVectorView(Fog, "color"), [0.62, 0.72, 0.84, 0.9]);
    expect(fog.getValue(Fog, "density")).toBeCloseTo(0.035, 6);
    expect(
      validateFogInput({
        mode: FogMode.Linear,
        color: [0, Number.NaN, 0, 1],
        start: 12,
        end: 4,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["fog.invalidColor", "fog.invalidRange"]);
    expect(
      validateFogInput({
        mode: FogMode.Exp,
        density: -0.1,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["fog.invalidDensity"]);
  });

  it("validates invalid camera fields", () => {
    const report = validateCameraInput({
      fovYRadians: Math.PI,
      aspect: 0,
      near: 10,
      far: 1,
      viewport: [0, 0, -1, 1],
      layerMask: 0,
    });

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "camera.invalidProjection",
      "camera.invalidClipRange",
      "camera.invalidViewport",
      "camera.zeroLayerMask",
    ]);
  });

  it("validates invalid light fields", () => {
    const report = validateLightInput({
      kind: LightKind.RectArea,
      shape: AreaLightShape.Sphere,
      intensity: -1,
      width: 0,
      height: Number.NaN,
      layerMask: 0,
    });

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "light.invalidIntensity",
      "light.invalidAreaSize",
      "light.zeroLayerMask",
    ]);
  });

  it("attaches and reads light shadow settings defaults and explicit values", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerRenderAuthoringComponents(world);
    const defaultLight = world.createEntity();
    const explicitLight = world.createEntity();

    defaultLight.addComponent(LightShadowSettings);
    explicitLight.addComponent(LightShadowSettings, {
      ...createLightShadowSettings({
        enabled: true,
        mapSize: 2048,
        bias: 0.001,
        normalBias: 0.02,
        cascadeCount: 3,
        casterLayerMask: 0b0011,
        receiverLayerMask: 0b0101,
      }),
    });

    expect(defaultLight.getValue(LightShadowSettings, "enabled")).toBe(false);
    expect(defaultLight.getValue(LightShadowSettings, "mapSize")).toBe(1024);
    expect(defaultLight.getValue(LightShadowSettings, "bias")).toBe(0);
    expect(defaultLight.getValue(LightShadowSettings, "normalBias")).toBe(0);
    expect(defaultLight.getValue(LightShadowSettings, "cascadeCount")).toBe(1);
    expect(defaultLight.getValue(LightShadowSettings, "casterLayerMask")).toBe(
      -1,
    );
    expect(
      defaultLight.getValue(LightShadowSettings, "receiverLayerMask"),
    ).toBe(-1);

    expect(explicitLight.getValue(LightShadowSettings, "enabled")).toBe(true);
    expect(explicitLight.getValue(LightShadowSettings, "mapSize")).toBe(2048);
    expect(explicitLight.getValue(LightShadowSettings, "bias")).toBeCloseTo(
      0.001,
      6,
    );
    expect(
      explicitLight.getValue(LightShadowSettings, "normalBias"),
    ).toBeCloseTo(0.02, 6);
    expect(explicitLight.getValue(LightShadowSettings, "cascadeCount")).toBe(3);
    expect(explicitLight.getValue(LightShadowSettings, "casterLayerMask")).toBe(
      0b0011,
    );
    expect(
      explicitLight.getValue(LightShadowSettings, "receiverLayerMask"),
    ).toBe(0b0101);
  });

  it("validates invalid light shadow settings fields", () => {
    const report = validateLightShadowSettingsInput({
      mapSize: 0,
      bias: -0.001,
      normalBias: -0.02,
      cascadeCount: 5,
      casterLayerMask: 0,
      receiverLayerMask: 0,
    });

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadow.invalidMapSize",
      "shadow.invalidBias",
      "shadow.invalidCascadeCount",
      "shadow.zeroLayerMask",
    ]);
  });
});

function expectVector(
  actual: ArrayLike<number>,
  expected: readonly number[],
): void {
  expect(actual.length).toBe(expected.length);

  for (let index = 0; index < expected.length; index += 1) {
    expect(read(actual, index)).toBeCloseTo(read(expected, index), 5);
  }
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
