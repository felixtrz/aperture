import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  Camera,
  Light,
  LightKind,
  MeshRenderer,
  RenderLayer,
  Visibility,
  WorldTransform,
  createBoxMeshAsset,
  createCamera,
  createLight,
  createMaterialHandle,
  createMeshHandle,
  createRenderTargetHandle,
  createRootTransform,
  createUnlitMaterialAsset,
  createWorld,
  extractRenderSnapshot,
  registerMetadataComponents,
  registerRenderAuthoringComponents,
  registerTransformComponents,
  type LightInput,
  type MeshAsset,
} from "../../src/index.js";

describe("render extraction", () => {
  it("extracts sorted views, mesh draws, bounds, and report counts", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const camera = createCameraEntity(world, { priority: 2, layerMask: 0b01 });
    const mesh = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 0b01,
    });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 7 });

    expect(snapshot.frame).toBe(7);
    expect(snapshot.views.map((view) => view.camera.index)).toEqual([
      camera.index,
    ]);
    expect(snapshot.views[0]?.renderTarget).toBeNull();
    expect(snapshot.meshDraws.map((draw) => draw.entity.index)).toEqual([
      mesh.index,
    ]);
    expect(snapshot.bounds).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 1,
      lights: 0,
      bounds: 1,
      diagnostics: 0,
    });
  });

  it("stores distinct view, projection, and view-projection matrices", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, {
      priority: 0,
      layerMask: 1,
      translation: [2, 0, 0],
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());
    const view = matrixAt(
      snapshot.viewMatrices,
      snapshot.views[0]?.viewMatrixOffset,
    );
    const projection = matrixAt(
      snapshot.viewMatrices,
      snapshot.views[0]?.projectionMatrixOffset,
    );
    const viewProjection = matrixAt(
      snapshot.viewMatrices,
      snapshot.views[0]?.viewProjectionMatrixOffset,
    );

    expect(view).not.toEqual(projection);
    expect(viewProjection).not.toEqual(projection);
    expect(viewProjection).not.toEqual(view);
  });

  it("orders camera packets by priority then stable id", () => {
    const world = createRuntimeWorld();

    const lowPriority = createCameraEntity(world, {
      priority: 10,
      layerMask: 1,
    });
    const highPriority = createCameraEntity(world, {
      priority: 1,
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.views.map((view) => view.camera.index)).toEqual([
      highPriority.index,
      lowPriority.index,
    ]);
  });

  it("extracts valid camera render target handles without changing view order", () => {
    const world = createRuntimeWorld();
    const lowPriority = createCameraEntity(world, {
      priority: 10,
      layerMask: 1,
      renderTargetId: "render-target:offscreen",
    });
    const highPriority = createCameraEntity(world, {
      priority: 1,
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.views.map((view) => view.camera.index)).toEqual([
      highPriority.index,
      lowPriority.index,
    ]);
    expect(snapshot.views[0]?.renderTarget).toBeNull();
    expect(snapshot.views[1]?.renderTarget).toEqual(
      createRenderTargetHandle("offscreen"),
    );
  });

  it("diagnoses invalid camera render target ids as canvas targets", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, {
      priority: 0,
      layerMask: 1,
      renderTargetId: "offscreen",
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.views[0]?.renderTarget).toBeNull();
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.camera.invalidRenderTargetHandle",
    ]);
  });

  it("skips renderables whose layers do not match any camera", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, { priority: 0, layerMask: 0b01 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 0b10,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.layerMismatch",
    ]);
  });

  it("skips missing mesh handles with diagnostics", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:missing",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.missingMeshHandle",
    ]);
    expect(snapshot.report.diagnostics).toBe(1);
  });

  it("skips invisible renderables before asset lookup", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const entity = createMeshEntity(world, {
      meshId: "mesh:missing",
      materialId: "material:unlit",
      layerMask: 1,
    });

    entity.setValue(Visibility, "visible", false);

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.invisible",
    ]);
  });

  it("reports loading and failed asset statuses distinctly", () => {
    const loadingWorld = createRuntimeWorld();
    const loadingAssets = createReadyAssets();

    loadingAssets.markLoading(createMeshHandle("cube"));
    createCameraEntity(loadingWorld, { priority: 0, layerMask: 1 });
    createMeshEntity(loadingWorld, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    expect(
      extractRenderSnapshot(loadingWorld, loadingAssets).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["render.mesh.loading"]);

    const failedWorld = createRuntimeWorld();
    const failedAssets = createReadyAssets();

    failedAssets.markFailed(createMaterialHandle("unlit"), [
      { code: "material.failed", message: "test", severity: "error" },
    ]);
    createCameraEntity(failedWorld, { priority: 0, layerMask: 1 });
    createMeshEntity(failedWorld, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    expect(
      extractRenderSnapshot(failedWorld, failedAssets).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["render.material.failed"]);
  });

  it("preserves mesh validation codes in render diagnostics", () => {
    const world = createRuntimeWorld();
    const invalidMesh = createBoxMeshAsset();
    const assets = createReadyAssets({
      meshAsset: {
        ...invalidMesh,
        submeshes: [
          {
            ...required(invalidMesh.submeshes[0]),
            indexStart: 999,
          },
        ],
      },
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    expect(
      extractRenderSnapshot(world, assets).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["render.mesh.invalidSubmeshRange"]);
  });

  it("diagnoses material slots outside the MVP MeshRenderer fields", () => {
    const world = createRuntimeWorld();
    const mesh = createBoxMeshAsset();
    const material = createMaterialHandle("unlit");
    const assets = createReadyAssets({
      meshAsset: {
        ...mesh,
        materialSlots: [
          ...mesh.materialSlots,
          { index: 1, label: "slot1", material },
          { index: 2, label: "slot2", material },
          { index: 3, label: "slot3", material },
          { index: 4, label: "slot4", material },
        ],
        submeshes: [
          {
            ...required(mesh.submeshes[0]),
            materialSlot: 4,
          },
        ],
      },
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    expect(
      extractRenderSnapshot(world, assets).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["render.unsupportedMaterialSlot"]);
  });

  it("skips invalid cameras without blocking mesh extraction", () => {
    const world = createRuntimeWorld();
    const camera = createCameraEntity(world, { priority: 0, layerMask: 1 });
    const mesh = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    camera.setValue(Camera, "fovYRadians", 0);
    camera.setValue(Camera, "near", 5);
    camera.setValue(Camera, "far", 1);
    camera.setValue(Camera, "layerMask", 0);
    camera.getVectorView(Camera, "viewport").set([0, 0, -1, 1]);
    camera.getVectorView(Camera, "scissor").set([0, 0, 1, -1]);

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.views).toEqual([]);
    expect(snapshot.meshDraws.map((draw) => draw.entity.index)).toEqual([
      mesh.index,
    ]);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.camera.invalidProjection",
      "render.camera.invalidClipRange",
      "render.camera.invalidViewport",
      "render.camera.invalidViewport",
      "render.camera.zeroLayerMask",
    ]);
  });

  it("skips invalid lights while preserving valid extraction counts", () => {
    const world = createRuntimeWorld();
    const camera = createCameraEntity(world, { priority: 0, layerMask: 1 });
    const mesh = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });
    const validLight = createLightEntity(world, {
      kind: LightKind.Directional,
      intensity: 2,
      layerMask: 1,
    });

    createLightEntity(world, {
      kind: LightKind.Spot,
      intensity: -1,
      range: 0,
      innerConeAngle: 2,
      outerConeAngle: 1,
      layerMask: 0,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.views.map((view) => view.camera.index)).toEqual([
      camera.index,
    ]);
    expect(snapshot.meshDraws.map((draw) => draw.entity.index)).toEqual([
      mesh.index,
    ]);
    expect(snapshot.lights.map((light) => light.entity.index)).toEqual([
      validLight.index,
    ]);
    expect(snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 1,
      lights: 1,
      diagnostics: 4,
    });
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.light.invalidIntensity",
      "render.light.invalidRange",
      "render.light.invalidSpotCone",
      "render.light.zeroLayerMask",
    ]);
  });
});

function createRuntimeWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function createReadyAssets(
  options: { readonly meshAsset?: MeshAsset } = {},
): AssetRegistry {
  const registry = new AssetRegistry();
  const mesh = createMeshHandle("cube");
  const material = createMaterialHandle("unlit");

  registry.register(mesh);
  registry.register(material);
  registry.markReady(mesh, options.meshAsset ?? createBoxMeshAsset());
  registry.markReady(material, createUnlitMaterialAsset());
  return registry;
}

function createCameraEntity(
  world: ReturnType<typeof createWorld>,
  input: {
    readonly priority: number;
    readonly layerMask: number;
    readonly translation?: readonly [number, number, number];
    readonly renderTargetId?: string;
  },
) {
  const entity = world.createEntity();
  const root =
    input.translation === undefined
      ? createRootTransform()
      : createRootTransform({ translation: input.translation });

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(
    Camera,
    createCamera({
      priority: input.priority,
      layerMask: input.layerMask,
      ...(input.renderTargetId === undefined
        ? {}
        : { renderTargetId: input.renderTargetId }),
    }),
  );
  return entity;
}

function createMeshEntity(
  world: ReturnType<typeof createWorld>,
  input: {
    readonly meshId: string;
    readonly materialId: string;
    readonly layerMask: number;
  },
) {
  const entity = world.createEntity();
  const root = createRootTransform();

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(MeshRenderer, {
    meshId: input.meshId,
    material0Id: input.materialId,
  });
  entity.addComponent(RenderLayer, { mask: input.layerMask });
  entity.addComponent(Visibility);
  return entity;
}

function createLightEntity(
  world: ReturnType<typeof createWorld>,
  input: LightInput = {},
) {
  const entity = world.createEntity();
  const root = createRootTransform();

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(Light, createLight(input));
  return entity;
}

function matrixAt(values: Float32Array, offset: number | undefined): number[] {
  if (offset === undefined) {
    throw new Error("Expected matrix offset.");
  }

  return Array.from(values.slice(offset, offset + 16));
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected fixture value.");
  }

  return value;
}
