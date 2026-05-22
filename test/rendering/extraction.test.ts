import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  AreaLightShape,
  Camera,
  InstanceData,
  InstanceTint,
  Light,
  LightKind,
  LightShadowSettings,
  Material,
  Mesh,
  RenderLayer,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Sprite,
  Skybox,
  Visibility,
  WorldTransform,
  createBoxMeshAsset,
  createCamera,
  createEnvironmentMapHandle,
  createInstanceData,
  createLight,
  createLightShadowSettings,
  createMaterialHandle,
  createMeshHandle,
  createRenderTargetHandle,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureAsset,
  createTextureHandle,
  createRootTransform,
  createRenderExtractionCache,
  createSkin,
  createStableRenderId,
  createSprite,
  createSkybox,
  createUnlitMaterialAsset,
  createWorld,
  extractRenderSnapshot,
  packSnapshotInstanceTints,
  registerMetadataComponents,
  registerRenderAuthoringComponents,
  registerTransformComponents,
  type LightInput,
  type MaterialAsset,
  type MeshAsset,
} from "@aperture-engine/core";

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

  it("extracts sprite draws as snapshot-safe billboard packets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const texture = createTextureHandle("marker");

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "Marker",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    createCameraEntity(world, { priority: 0, layerMask: 0b01 });

    const entity = world.createEntity();
    const root = createRootTransform({ translation: [0, 0, -3] });

    entity.addComponent(WorldTransform, root.world);
    entity.addComponent(
      Sprite,
      createSprite({
        texture,
        size: [2, 3],
        color: [0.25, 0.5, 0.75, 1],
      }),
    );
    entity.addComponent(RenderLayer, { mask: 0b01 });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 3 });

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.spriteDraws).toHaveLength(1);
    expect(snapshot.spriteDraws?.[0]).toMatchObject({
      renderId: createStableRenderId({
        index: entity.index,
        generation: entity.generation,
      }),
      texture,
      width: 2,
      height: 3,
      layerMask: 0b01,
      worldTransformOffset: 0,
      boundsIndex: 0,
    });
    expect(snapshot.spriteDraws?.[0]?.color).toEqual([0.25, 0.5, 0.75, 1]);
    expect(snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 0,
      spriteDraws: 1,
      bounds: 1,
      diagnostics: 0,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("extracts skyboxes as cube-texture background packets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const texture = createTextureHandle("studio-cube");
    const sampler = createSamplerHandle("linear-clamp");

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "StudioCube",
        dimension: "cube",
        width: 2,
        height: 2,
        depthOrLayers: 6,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset({ label: "LinearClamp" }));
    createCameraEntity(world, { priority: 0, layerMask: 0b01 });

    const entity = world.createEntity();

    entity.addComponent(
      Skybox,
      createSkybox({
        texture,
        sampler,
        intensity: 1.25,
      }),
    );
    entity.addComponent(RenderLayer, { mask: 0b01 });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 4 });

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.skyboxes).toHaveLength(1);
    expect(snapshot.skyboxes?.[0]).toMatchObject({
      skyboxId: createStableRenderId({
        index: entity.index,
        generation: entity.generation,
      }),
      texture,
      sampler,
      intensity: 1.25,
      layerMask: 0b01,
    });
    expect(snapshot.report).toMatchObject({
      views: 1,
      meshDraws: 0,
      skyboxes: 1,
      diagnostics: 0,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("diagnoses skybox textures that are not cube assets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const texture = createTextureHandle("flat-background");

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "FlatBackground",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    createCameraEntity(world, { priority: 0, layerMask: 0b01 });

    const entity = world.createEntity();

    entity.addComponent(Skybox, createSkybox({ texture }));

    const snapshot = extractRenderSnapshot(world, assets, { frame: 5 });

    expect(snapshot.skyboxes).toEqual([]);
    expect(snapshot.report).toMatchObject({
      views: 1,
      skyboxes: 0,
      diagnostics: 1,
    });
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.skybox.textureNotCube",
        entity: { index: entity.index, generation: entity.generation },
        assetKey: "texture:flat-background",
      },
    ]);
  });

  it("reuses unchanged entity versions during cached mesh extraction", () => {
    const entityCount = 1000;
    const world = createRuntimeWorld(entityCount + 2);
    const assets = createReadyAssets();
    const entities: Array<ReturnType<typeof createMeshEntity>> = [];

    createCameraEntity(world, { priority: 0, layerMask: 1 });

    for (let index = 0; index < entityCount; index += 1) {
      entities.push(
        createMeshEntity(world, {
          meshId: "mesh:cube",
          materialId: "material:unlit",
          layerMask: 1,
        }),
      );
    }

    const cache = createRenderExtractionCache();
    const full = extractRenderSnapshot(world, assets, { frame: 11 });

    extractRenderSnapshot(world, assets, { frame: 11, cache });
    const cached = extractRenderSnapshot(world, assets, { frame: 11, cache });

    expect(stableSnapshotValue(cached)).toEqual(stableSnapshotValue(full));
    expect(cache.meshDrawEntities.size).toBe(entityCount);

    const staticMs = measureCachedExtraction(() => {
      extractRenderSnapshot(world, assets, { frame: 12, cache });
    });
    const dirtyMs = measureCachedExtraction(
      () => {
        extractRenderSnapshot(world, assets, { frame: 12, cache });
      },
      () => {
        for (const entity of entities) {
          entity.setValue(Visibility, "visible", true);
        }
      },
    );

    expect(
      staticMs,
      `cached static extraction ${staticMs.toFixed(3)}ms should be <50% of dirty extraction ${dirtyMs.toFixed(3)}ms`,
    ).toBeLessThan(dirtyMs * 0.5);
  });

  it("packs per-entity instance tint alongside extracted StandardMaterial draws", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset(),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const warm = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });
    const cool = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    warm.addComponent(InstanceTint, { color: [1, 0.35, 0.2, 1] });
    cool.addComponent(InstanceTint, { color: [0.2, 0.65, 1, 1] });

    const snapshot = extractRenderSnapshot(world, assets, { frame: 13 });
    const packedTints = packSnapshotInstanceTints(snapshot);

    expect(snapshot.meshDraws).toHaveLength(2);
    expect(Array.from(snapshot.instanceTints ?? [])).toEqual([
      1,
      expect.closeTo(0.35, 5),
      expect.closeTo(0.2, 5),
      1,
      expect.closeTo(0.2, 5),
      expect.closeTo(0.65, 5),
      1,
      1,
    ]);
    expect(snapshot.meshDraws.map((draw) => draw.instanceTintOffset)).toEqual([
      0, 4,
    ]);
    expect(
      snapshot.meshDraws.every((draw) =>
        draw.batchKey.pipelineKey.includes("instance-tint"),
      ),
    ).toBe(true);
    expect(
      new Set(snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey)).size,
    ).toBe(1);
    expect(packedTints).toMatchObject({
      floatCount: 8,
      diagnostics: [],
      offsets: [
        { renderId: snapshot.meshDraws[0]?.renderId, packedOffset: 0 },
        { renderId: snapshot.meshDraws[1]?.renderId, packedOffset: 4 },
      ],
    });
    expect(Array.from(packedTints.data)).toEqual([
      1,
      expect.closeTo(0.35, 5),
      expect.closeTo(0.2, 5),
      1,
      expect.closeTo(0.2, 5),
      expect.closeTo(0.65, 5),
      1,
      1,
    ]);
  });

  it("extracts StandardMaterial skin palettes into snapshot bone matrices", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      meshAsset: withSkinningAttributes(createBoxMeshAsset()),
      materialAsset: createStandardMaterialAsset(),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const entity = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    entity.addComponent(
      Skin,
      createSkin({
        jointMatrices: [...identityMatrix(), ...translationMatrix(2, 0, 0)],
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets, { frame: 14 });
    const draw = required(snapshot.meshDraws[0]);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.bones).toBeInstanceOf(Float32Array);
    expect(Array.from(snapshot.bones ?? [])).toEqual([
      ...identityMatrix(),
      ...translationMatrix(2, 0, 0),
    ]);
    expect(draw).toMatchObject({
      boneMatrixOffset: 0,
      boneMatrixCount: 2,
      batchKey: {
        skinned: true,
        pipelineKey: "standard|skinned|opaque|back|less|none",
      },
    });
  });

  it("includes compact skinning formats in mesh layout keys", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      meshAsset: withCompactSkinningAttributes(createBoxMeshAsset()),
      materialAsset: createStandardMaterialAsset(),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const entity = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    entity.addComponent(
      Skin,
      createSkin({
        jointMatrices: identityMatrix(),
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws[0]?.batchKey).toMatchObject({
      skinned: true,
      pipelineKey: "standard|skinned|opaque|back|less|none",
      meshLayoutKey:
        "POSITION,NORMAL,TEXCOORD_0,JOINTS_0:uint8x4,WEIGHTS_0:unorm8x4",
    });
  });

  it("preserves vertex stream boundaries in mesh layout keys", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      meshAsset: withSplitVertexStreams(createBoxMeshAsset()),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws[0]?.batchKey.meshLayoutKey).toBe(
      "POSITION,NORMAL|TEXCOORD_0,COLOR_0:unorm8x4",
    );
  });

  it("includes explicit stream stride and attribute offsets for padded layouts", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      meshAsset: withPaddedVertexStream(createBoxMeshAsset()),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws[0]?.batchKey.meshLayoutKey).toBe(
      "stride=40,POSITION@4,NORMAL@20,TEXCOORD_0@32",
    );
  });

  it("extracts named custom instance data into snapshot attribute packets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const first = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });
    const second = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    first.addComponent(
      InstanceData,
      createInstanceData({
        materialKind: "custom-wind",
        values: { wind: [1, 2, 3], phase: 0.25 },
      }),
    );
    second.addComponent(
      InstanceData,
      createInstanceData({
        materialKind: "custom-wind",
        values: { wind: [4, 5, 6], phase: 0.75 },
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toHaveLength(2);
    expect(
      new Set(snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey)).size,
    ).toBe(1);
    expect(
      snapshot.meshDraws.map((draw) => draw.instanceAttributePacketIndex),
    ).toEqual([0, 1]);
    expect(Array.from(snapshot.instanceAttributes ?? [])).toEqual([
      0.25, 1, 2, 3, 0.75, 4, 5, 6,
    ]);
    expect(snapshot.instanceAttributePackets).toMatchObject([
      {
        materialKind: "custom-wind",
        fields: [
          { name: "phase", offset: 0, components: 1 },
          { name: "wind", offset: 1, components: 3 },
        ],
      },
      {
        materialKind: "custom-wind",
        fields: [
          { name: "phase", offset: 4, components: 1 },
          { name: "wind", offset: 5, components: 3 },
        ],
      },
    ]);
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

  it("extracts ECS-authored shadow caster and receiver flags on mesh draws", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    const mesh = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    mesh.addComponent(ShadowCaster, { enabled: false });
    mesh.addComponent(ShadowReceiver, { enabled: true });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.meshDraws[0]).toMatchObject({
      castsShadow: false,
      receivesShadow: true,
    });
    expect(JSON.parse(JSON.stringify(snapshot.meshDraws[0]))).toMatchObject({
      castsShadow: false,
      receivesShadow: true,
    });
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

  it("culls renderables outside all matching camera frustums and reports per-view stats", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, {
      priority: 0,
      layerMask: 1,
      translation: [0, 0, 5],
    });
    const visible = createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
      translation: [0, 0, 0],
    });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
      translation: [120, 0, 0],
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws.map((draw) => draw.entity.index)).toEqual([
      visible.index,
    ]);
    expect(snapshot.bounds).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.report.cullStats).toMatchObject([
      {
        tested: 2,
        culled: 1,
        included: 1,
      },
    ]);
  });

  it("allows cameras to opt out of frustum culling", () => {
    const world = createRuntimeWorld();

    createCameraEntity(world, {
      priority: 0,
      layerMask: 1,
      translation: [0, 0, 5],
      frustumCulling: false,
    });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
      translation: [0, 0, 0],
    });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
      translation: [120, 0, 0],
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws).toHaveLength(2);
    expect(snapshot.report.cullStats).toMatchObject([
      {
        tested: 0,
        culled: 0,
        included: 2,
      },
    ]);
  });

  it("microbenchmarks frustum culling against an opt-out baseline", () => {
    const totalEntities = 1000;
    const visibleEntities = 200;
    const culled = createFrustumCullingFixture({
      totalEntities,
      visibleEntities,
      frustumCulling: true,
    });

    expect(
      extractRenderSnapshot(culled.world, culled.assets).report,
    ).toMatchObject({
      meshDraws: visibleEntities,
      cullStats: [{ tested: totalEntities, culled: 800, included: 200 }],
    });
    const culledMs = measureCachedExtraction(
      () => {
        extractRenderSnapshot(culled.world, culled.assets);
      },
      undefined,
      8,
    );

    const baseline = createFrustumCullingFixture({
      totalEntities,
      visibleEntities,
      frustumCulling: false,
    });

    expect(
      extractRenderSnapshot(baseline.world, baseline.assets).report,
    ).toMatchObject({
      meshDraws: totalEntities,
      cullStats: [{ tested: 0, culled: 0, included: totalEntities }],
    });
    const baselineMs = measureCachedExtraction(
      () => {
        extractRenderSnapshot(baseline.world, baseline.assets);
      },
      undefined,
      8,
    );

    expect(
      culledMs,
      `culled extraction ${culledMs.toFixed(
        3,
      )}ms should be at least 30% faster than opt-out baseline ${baselineMs.toFixed(
        3,
      )}ms`,
    ).toBeLessThan(baselineMs * 0.7);
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

  it("extracts ready unlit texture dependencies into a textured batch key", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");
    const assets = createReadyAssets({
      materialAsset: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    assets.register(texture);
    assets.register(sampler);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "Albedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    );
    assets.markReady(sampler, createSamplerAsset({ label: "Linear" }));
    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "unlit|baseColorTexture|opaque|back|less|none",
    );
  });

  it("diagnoses missing unlit texture and sampler handles", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      materialAsset: createUnlitMaterialAsset({
        baseColorTexture: { texture: null, sampler: null },
      }),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.material.missingTextureHandle",
        assetKey: "material:unlit",
      },
      {
        code: "render.material.missingSamplerHandle",
        assetKey: "material:unlit",
      },
    ]);
  });

  it("diagnoses unregistered unlit texture and sampler assets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      materialAsset: createUnlitMaterialAsset({
        baseColorTexture: {
          texture: createTextureHandle("missing-albedo"),
          sampler: createSamplerHandle("missing-linear"),
        },
      }),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      { code: "render.texture.missing", assetKey: "texture:missing-albedo" },
      { code: "render.sampler.missing", assetKey: "sampler:missing-linear" },
    ]);
  });

  it("diagnoses a shared missing texture asset once per renderable", () => {
    const texture = createTextureHandle("shared-missing-albedo");
    const sampler = createSamplerHandle("shared-ready-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset({ label: "SharedReady" }));

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-missing-albedo",
      },
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-missing-albedo",
      },
    ]);
  });

  it("diagnoses a shared missing sampler asset once per renderable", () => {
    const texture = createTextureHandle("shared-ready-albedo");
    const sampler = createSamplerHandle("shared-missing-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "SharedReadyAlbedo",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-missing-linear",
      },
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-missing-linear",
      },
    ]);
  });

  it("diagnoses shared missing texture and sampler assets once per renderable", () => {
    const texture = createTextureHandle("shared-missing-albedo");
    const sampler = createSamplerHandle("shared-missing-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-missing-albedo",
      },
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-missing-linear",
      },
      {
        code: "render.texture.missing",
        assetKey: "texture:shared-missing-albedo",
      },
      {
        code: "render.sampler.missing",
        assetKey: "sampler:shared-missing-linear",
      },
    ]);
  });

  it("diagnoses a shared loading texture asset once per renderable", () => {
    const texture = createTextureHandle("shared-loading-albedo");
    const sampler = createSamplerHandle("shared-ready-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markLoading(texture);
    assets.markReady(sampler, createSamplerAsset({ label: "SharedReady" }));

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.loading",
        assetKey: "texture:shared-loading-albedo",
      },
      {
        code: "render.texture.loading",
        assetKey: "texture:shared-loading-albedo",
      },
    ]);
  });

  it("diagnoses a shared failed texture asset once per renderable", () => {
    const texture = createTextureHandle("shared-failed-albedo");
    const sampler = createSamplerHandle("shared-ready-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markFailed(texture, [
      {
        code: "shared.texture.failed",
        message: "Shared texture intentionally failed.",
        severity: "error",
      },
    ]);
    assets.markReady(sampler, createSamplerAsset({ label: "SharedReady" }));

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.failed",
        assetKey: "texture:shared-failed-albedo",
      },
      {
        code: "render.texture.failed",
        assetKey: "texture:shared-failed-albedo",
      },
    ]);
  });

  it("diagnoses a shared failed sampler asset once per renderable", () => {
    const texture = createTextureHandle("shared-ready-albedo");
    const sampler = createSamplerHandle("shared-failed-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "SharedReadyAlbedo",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.markFailed(sampler, [
      {
        code: "shared.sampler.failed",
        message: "Shared sampler intentionally failed.",
        severity: "error",
      },
    ]);

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.sampler.failed",
        assetKey: "sampler:shared-failed-linear",
      },
      {
        code: "render.sampler.failed",
        assetKey: "sampler:shared-failed-linear",
      },
    ]);
  });

  it("diagnoses a shared loading sampler asset once per renderable", () => {
    const texture = createTextureHandle("shared-ready-albedo");
    const sampler = createSamplerHandle("shared-loading-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "SharedReadyAlbedo",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.markLoading(sampler);

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.sampler.loading",
        assetKey: "sampler:shared-loading-linear",
      },
      {
        code: "render.sampler.loading",
        assetKey: "sampler:shared-loading-linear",
      },
    ]);
  });

  it("diagnoses shared loading texture and failed sampler assets once per renderable", () => {
    const texture = createTextureHandle("shared-loading-albedo");
    const sampler = createSamplerHandle("shared-failed-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markLoading(texture);
    assets.markFailed(sampler, [
      {
        code: "shared.sampler.failed",
        message: "Shared sampler intentionally failed.",
        severity: "error",
      },
    ]);

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.loading",
        assetKey: "texture:shared-loading-albedo",
      },
      {
        code: "render.sampler.failed",
        assetKey: "sampler:shared-failed-linear",
      },
      {
        code: "render.texture.loading",
        assetKey: "texture:shared-loading-albedo",
      },
      {
        code: "render.sampler.failed",
        assetKey: "sampler:shared-failed-linear",
      },
    ]);
  });

  it("diagnoses shared failed texture and loading sampler assets once per renderable", () => {
    const texture = createTextureHandle("shared-failed-albedo");
    const sampler = createSamplerHandle("shared-loading-linear");
    const { assets, world } = createTwoRenderableTextureDependencyFixture(
      texture,
      sampler,
    );

    assets.register(texture);
    assets.register(sampler);
    assets.markFailed(texture, [
      {
        code: "shared.texture.failed",
        message: "Shared texture intentionally failed.",
        severity: "error",
      },
    ]);
    assets.markLoading(sampler);

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      {
        code: "render.texture.failed",
        assetKey: "texture:shared-failed-albedo",
      },
      {
        code: "render.sampler.loading",
        assetKey: "sampler:shared-loading-linear",
      },
      {
        code: "render.texture.failed",
        assetKey: "texture:shared-failed-albedo",
      },
      {
        code: "render.sampler.loading",
        assetKey: "sampler:shared-loading-linear",
      },
    ]);
  });

  it("diagnoses loading and failed unlit texture dependency assets", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("loading-albedo");
    const sampler = createSamplerHandle("failed-linear");
    const assets = createReadyAssets({
      materialAsset: createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    assets.register(texture);
    assets.register(sampler);
    assets.markLoading(texture);
    assets.markFailed(sampler, [
      { code: "sampler.failed", message: "test", severity: "error" },
    ]);
    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expectBlockedTextureDependencySnapshot(snapshot, [
      { code: "render.texture.loading", assetKey: "texture:loading-albedo" },
      { code: "render.sampler.failed", assetKey: "sampler:failed-linear" },
    ]);
  });

  it("blocks StandardMaterial normal maps when mesh tangents are missing", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("ready-normal");
    const sampler = createSamplerHandle("ready-normal-linear");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        normalTexture: { texture, sampler },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "ReadyNormal",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "normal",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardNormalMap.missingTangents",
        assetKey: "material:unlit",
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("diagnoses StandardMaterial texture metadata before extraction queues a draw", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("wrong-standard-base");
    const sampler = createSamplerHandle("standard-base-linear");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "WrongStandardBase",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "normal",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardMaterialTexture.invalidSemantic",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:wrong-standard-base",
        field: "baseColorTexture",
        expectedSemantic: "base-color",
        actualSemantic: "normal",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "linear",
      },
      {
        code: "render.standardMaterialTexture.invalidColorSpace",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:wrong-standard-base",
        field: "baseColorTexture",
        expectedSemantic: "base-color",
        actualSemantic: "normal",
        expectedColorSpaces: ["srgb"],
        actualColorSpace: "linear",
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("diagnoses StandardMaterial failed textures and missing samplers before extraction queues a draw", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("failed-standard-base");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler: null },
      }),
    });

    assets.register(texture);
    assets.markFailed(texture, [
      {
        code: "texture.failed",
        message: "standard base texture failed",
        severity: "error",
      },
    ]);

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardMaterialTexture.textureNotReady",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:failed-standard-base",
        field: "baseColorTexture",
        dependencyKind: "texture",
        status: "failed",
      },
      {
        code: "render.standardMaterialTexture.missingSamplerHandle",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:failed-standard-base",
        field: "baseColorTexture",
        dependencyKind: "sampler",
        status: "missing",
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("diagnoses unsupported StandardMaterial texture UV sets before extraction queues a draw", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("standard-base-uv2");
    const sampler = createSamplerHandle("standard-base-linear");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler, texCoord: 2 },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseUv2",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardMaterialTexture.unsupportedTexCoord",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:standard-base-uv2",
        field: "baseColorTexture",
        texCoord: 2,
        supportedTexCoords: [0, 1],
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("diagnoses unsupported StandardMaterial texture transforms before extraction queues a draw", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("standard-base-transform");
    const sampler = createSamplerHandle("standard-base-linear");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: {
          texture,
          sampler,
          texCoord: 2,
          transform: {
            offset: [0.1, 0.2],
            scale: [0.75, 0.5],
            rotation: 0.25,
          },
        },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseTransform",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardMaterialTexture.unsupportedTextureTransform",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:standard-base-transform",
        samplerKey: "sampler:standard-base-linear",
        field: "baseColorTexture",
        textureTransform: {
          offset: [0.1, 0.2],
          scale: [0.75, 0.5],
          rotation: 0.25,
        },
      },
      {
        code: "render.standardMaterialTexture.unsupportedTexCoord",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        textureKey: "texture:standard-base-transform",
        field: "baseColorTexture",
        texCoord: 2,
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("diagnoses missing TEXCOORD_1 mesh attributes for StandardMaterial UV1 textures", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("standard-base-uv1");
    const sampler = createSamplerHandle("standard-base-linear");
    const assets = createReadyAssets({
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler, texCoord: 1 },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseUv1",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toEqual([]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.standardMaterialTexture.missingTexCoord1",
        assetKey: "material:unlit",
        materialKey: "material:unlit",
        meshKey: "mesh:cube",
        textureKey: "texture:standard-base-uv1",
        field: "baseColorTexture",
        texCoord: 1,
      },
    ]);
    expect(() => JSON.stringify(snapshot.diagnostics)).not.toThrow();
  });

  it("extracts StandardMaterial TEXCOORD_1 textures when mesh metadata provides UV1", () => {
    const world = createRuntimeWorld();
    const texture = createTextureHandle("standard-base-uv1");
    const sampler = createSamplerHandle("standard-base-linear");
    const assets = createReadyAssets({
      meshAsset: withTexCoord1Attribute(createBoxMeshAsset()),
      materialAsset: createStandardMaterialAsset({
        baseColorTexture: { texture, sampler, texCoord: 1 },
      }),
    });

    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseUv1",
        dimension: "2d",
        width: 1,
        height: 1,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    assets.register(sampler);
    assets.markReady(sampler, createSamplerAsset());

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.meshDraws[0]?.batchKey).toMatchObject({
      pipelineKey: "standard|baseColorTexture|uv1|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1",
    });
  });

  it("includes normalized COLOR_0 formats in mesh layout keys", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets({
      meshAsset: withNormalizedColor0Attribute(createBoxMeshAsset()),
    });

    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws[0]?.batchKey.meshLayoutKey).toBe(
      "POSITION,NORMAL,TEXCOORD_0,COLOR_0:unorm8x4",
    );
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

  it("uses the primary Material component for any mesh material slot", () => {
    const world = createRuntimeWorld();
    const mesh = createBoxMeshAsset();
    const assets = createReadyAssets({
      meshAsset: {
        ...mesh,
        materialSlots: [
          ...mesh.materialSlots,
          { index: 1, label: "slot1" },
          { index: 2, label: "slot2" },
          { index: 3, label: "slot3" },
          { index: 4, label: "slot4" },
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

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.meshDraws).toMatchObject([
      { materialSlot: 4, material: createMaterialHandle("unlit") },
    ]);
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
    createLightEntity(world, {
      kind: LightKind.RectArea,
      width: 0,
      height: 1,
      layerMask: 1,
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
      diagnostics: 5,
    });
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.light.invalidIntensity",
      "render.light.invalidRange",
      "render.light.invalidSpotCone",
      "render.light.zeroLayerMask",
      "render.light.invalidAreaSize",
    ]);
  });

  it("extracts transformless ambient lights and diagnoses transformless local lights", () => {
    const world = createRuntimeWorld();
    const ambientLight = createTransformlessLightEntity(world, {
      kind: LightKind.Ambient,
      intensity: 0.25,
      layerMask: 1,
    });
    const environmentLight = createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
      intensity: 0.5,
      layerMask: 1,
    });

    createTransformlessLightEntity(world, {
      kind: LightKind.Directional,
      intensity: 1,
      layerMask: 1,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.Point,
      intensity: 1,
      range: 3,
      layerMask: 1,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.Spot,
      intensity: 1,
      range: 3,
      innerConeAngle: 0.1,
      outerConeAngle: 0.2,
      layerMask: 1,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.RectArea,
      intensity: 1,
      width: 2,
      height: 1,
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.lights.map((light) => light.entity.index)).toEqual([
      ambientLight.index,
    ]);
    expect(snapshot.lights.map((light) => light.kind)).toEqual([
      LightKind.Ambient,
    ]);
    expect(snapshot.environments.map((environment) => environment)).toEqual([
      expect.objectContaining({
        environmentId: createStableRenderId({
          index: environmentLight.index,
          generation: environmentLight.generation,
        }),
        handle: null,
        intensity: 0.5,
        layerMask: 1,
      }),
    ]);
    expect(snapshot.transforms).toHaveLength(16);
    expect(snapshot.report).toMatchObject({
      lights: 1,
      environments: 1,
      diagnostics: 4,
    });
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.lightMissingTransform",
      "render.lightMissingTransform",
      "render.lightMissingTransform",
      "render.lightMissingTransform",
    ]);
  });

  it("propagates authored environment map handles into environment packets", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const environmentMap = createEnvironmentMapHandle("studio");
    const environmentLight = createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
      intensity: 0.75,
      layerMask: 0b0101,
      environmentMap,
    });

    assets.register(environmentMap);
    assets.markReady(environmentMap, { label: "Studio environment map" });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.environments).toEqual([
      expect.objectContaining({
        environmentId: createStableRenderId({
          index: environmentLight.index,
          generation: environmentLight.generation,
        }),
        handle: environmentMap,
        intensity: 0.75,
        layerMask: 0b0101,
      }),
    ]);
    expect(snapshot.report).toMatchObject({
      environments: 1,
      diagnostics: 0,
    });
  });

  it("diagnoses invalid environment map dependencies without blocking mesh extraction", () => {
    const world = createRuntimeWorld();
    const assets = createReadyAssets();
    const missing = createEnvironmentMapHandle("missing-studio");
    const loading = createEnvironmentMapHandle("loading-studio");
    const failed = createEnvironmentMapHandle("failed-studio");

    assets.register(loading);
    assets.register(failed);
    assets.markLoading(loading);
    assets.markFailed(failed, [
      {
        code: "environment.failed",
        message: "test environment map failure",
        severity: "error",
      },
    ]);
    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
      environmentMap: missing,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
      environmentMap: loading,
    });
    createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
      environmentMap: failed,
    });

    const snapshot = extractRenderSnapshot(world, assets);

    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.environments).toEqual([]);
    expect(snapshot.report).toMatchObject({
      meshDraws: 1,
      environments: 0,
      diagnostics: 3,
    });
    expect(diagnosticAssetPairs(snapshot)).toEqual([
      {
        code: "render.environment.missing",
        assetKey: "environment-map:missing-studio",
      },
      {
        code: "render.environment.loading",
        assetKey: "environment-map:loading-studio",
      },
      {
        code: "render.environment.failed",
        assetKey: "environment-map:failed-studio",
      },
    ]);
  });

  it("diagnoses malformed environment map handle ids without blocking mesh extraction", () => {
    const world = createRuntimeWorld();
    const environmentLight = createTransformlessLightEntity(world, {
      kind: LightKind.Environment,
    });

    environmentLight.setValue(Light, "environmentMapId", "texture:studio");
    createCameraEntity(world, { priority: 0, layerMask: 1 });
    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.meshDraws).toHaveLength(1);
    expect(snapshot.environments).toEqual([]);
    expect(snapshot.report).toMatchObject({
      meshDraws: 1,
      environments: 0,
      diagnostics: 1,
    });
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.environment.invalidHandle",
    ]);
  });

  it("extracts point, spot, and rect area light packet fields in entity order", () => {
    const world = createRuntimeWorld();
    const pointLight = createLightEntity(world, {
      kind: LightKind.Point,
      intensity: 3,
      range: 12,
      innerConeAngle: 0.125,
      outerConeAngle: 0.25,
      layerMask: 0b0010,
    });
    const spotLight = createLightEntity(world, {
      kind: LightKind.Spot,
      intensity: 4,
      range: 9,
      innerConeAngle: 0.25,
      outerConeAngle: 0.5,
      layerMask: 0b0100,
    });
    const rectAreaLight = createLightEntity(world, {
      kind: LightKind.RectArea,
      shape: AreaLightShape.Sphere,
      intensity: 5,
      width: 3,
      height: 1.5,
      layerMask: 0b1000,
    });

    const snapshot = extractRenderSnapshot(world, createReadyAssets());

    expect(snapshot.lights.map((light) => light.entity.index)).toEqual([
      pointLight.index,
      spotLight.index,
      rectAreaLight.index,
    ]);
    expect(
      snapshot.lights.map((light) => ({
        kind: light.kind,
        shape: light.shape,
        intensity: light.intensity,
        range: light.range,
        innerConeAngle: light.innerConeAngle,
        outerConeAngle: light.outerConeAngle,
        width: light.width,
        height: light.height,
        layerMask: light.layerMask,
      })),
    ).toEqual([
      {
        kind: LightKind.Point,
        shape: AreaLightShape.Rect,
        intensity: 3,
        range: 12,
        innerConeAngle: 0.125,
        outerConeAngle: 0.25,
        width: 2,
        height: 2,
        layerMask: 0b0010,
      },
      {
        kind: LightKind.Spot,
        shape: AreaLightShape.Rect,
        intensity: 4,
        range: 9,
        innerConeAngle: 0.25,
        outerConeAngle: 0.5,
        width: 2,
        height: 2,
        layerMask: 0b0100,
      },
      {
        kind: LightKind.RectArea,
        shape: AreaLightShape.Sphere,
        intensity: 5,
        range: 10,
        innerConeAngle: 0.39269909262657166,
        outerConeAngle: 0.5235987901687622,
        width: 3,
        height: 1.5,
        layerMask: 0b1000,
      },
    ]);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.report).toMatchObject({ lights: 3, diagnostics: 0 });
  });

  it("extracts directional and spot shadow requests and diagnoses unsupported shadow light kinds", () => {
    const world = createRuntimeWorld();
    const directionalLight = createLightEntity(world, {
      kind: LightKind.Directional,
      intensity: 1,
      layerMask: 1,
    });
    const ambientLight = createTransformlessLightEntity(world, {
      kind: LightKind.Ambient,
      intensity: 0.2,
      layerMask: 1,
    });
    const pointLight = createLightEntity(world, {
      kind: LightKind.Point,
      intensity: 1,
      range: 2,
      layerMask: 1,
    });
    const spotLight = createLightEntity(world, {
      kind: LightKind.Spot,
      intensity: 1,
      range: 8,
      innerConeAngle: 0.25,
      outerConeAngle: 0.5,
      layerMask: 1,
    });
    const rectAreaLight = createLightEntity(world, {
      kind: LightKind.RectArea,
      intensity: 1,
      width: 2,
      height: 1,
      layerMask: 1,
    });

    directionalLight.addComponent(
      LightShadowSettings,
      createLightShadowSettings({
        enabled: true,
        cascadeCount: 3,
        casterLayerMask: 0b0011,
        receiverLayerMask: 0b0101,
      }),
    );
    ambientLight.addComponent(
      LightShadowSettings,
      createLightShadowSettings({ enabled: true }),
    );
    pointLight.addComponent(
      LightShadowSettings,
      createLightShadowSettings({ enabled: false }),
    );
    spotLight.addComponent(
      LightShadowSettings,
      createLightShadowSettings({
        enabled: true,
        casterLayerMask: 0b0110,
        receiverLayerMask: 0b1001,
      }),
    );
    rectAreaLight.addComponent(
      LightShadowSettings,
      createLightShadowSettings({ enabled: true }),
    );

    const snapshot = extractRenderSnapshot(world, createReadyAssets());
    const directionalLightId = createStableRenderId({
      index: directionalLight.index,
      generation: directionalLight.generation,
    });
    const spotLightId = createStableRenderId({
      index: spotLight.index,
      generation: spotLight.generation,
    });

    expect(snapshot.shadowRequests).toEqual([
      {
        shadowId: directionalLightId,
        lightId: directionalLightId,
        lightKind: "directional",
        cascadeCount: 3,
        casterLayerMask: 0b0011,
        receiverLayerMask: 0b0101,
      },
      {
        shadowId: spotLightId,
        lightId: spotLightId,
        lightKind: "spot",
        casterLayerMask: 0b0110,
        receiverLayerMask: 0b1001,
      },
    ]);
    expect(snapshot.report).toMatchObject({
      lights: 5,
      shadowRequests: 2,
      diagnostics: 2,
    });
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "render.shadowUnsupportedLightKind.ambient",
      "render.shadowUnsupportedLightKind.rect-area",
    ]);
  });
});

function createRuntimeWorld(
  entityCapacity = 16,
): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function stableSnapshotValue(
  snapshot: ReturnType<typeof extractRenderSnapshot>,
): unknown {
  return {
    ...snapshot,
    transforms: Array.from(snapshot.transforms),
    viewMatrices: Array.from(snapshot.viewMatrices),
  };
}

function measureCachedExtraction(
  run: () => void,
  prepare: () => void = () => {},
  iterations = 5,
): number {
  let total = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    prepare();

    const start = performance.now();

    run();
    total += performance.now() - start;
  }

  return total / iterations;
}

function createReadyAssets(
  options: {
    readonly meshAsset?: MeshAsset;
    readonly materialAsset?: MaterialAsset;
  } = {},
): AssetRegistry {
  const registry = new AssetRegistry();
  const mesh = createMeshHandle("cube");
  const material = createMaterialHandle("unlit");

  registry.register(mesh);
  registry.register(material);
  registry.markReady(mesh, options.meshAsset ?? createBoxMeshAsset());
  registry.markReady(
    material,
    options.materialAsset ?? createUnlitMaterialAsset(),
  );
  return registry;
}

function withTexCoord1Attribute(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);
  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const targetStrideFloats = sourceStrideFloats + 2;
  const data = new Float32Array(stream.vertexCount * targetStrideFloats);
  const uvOffset = 6;

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * sourceStrideFloats;
    const targetOffset = vertex * targetStrideFloats;

    data.set(
      source.subarray(sourceOffset, sourceOffset + sourceStrideFloats),
      targetOffset,
    );
    data.set(
      source.subarray(sourceOffset + uvOffset, sourceOffset + uvOffset + 2),
      targetOffset + sourceStrideFloats,
    );
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: `${stream.id}-uv1`,
        arrayStride: targetStrideFloats * 4,
        attributes: [
          ...stream.attributes,
          {
            semantic: "TEXCOORD_1",
            format: "float32x2",
            offset: stream.arrayStride,
          },
        ],
        data,
      },
    ],
  };
}

function withNormalizedColor0Attribute(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);
  const source = new Uint8Array(
    stream.data.buffer,
    stream.data.byteOffset,
    stream.data.byteLength,
  );
  const arrayStride = stream.arrayStride + 4;
  const data = new Uint8Array(stream.vertexCount * arrayStride);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * stream.arrayStride;
    const targetOffset = vertex * arrayStride;

    data.set(
      source.subarray(sourceOffset, sourceOffset + stream.arrayStride),
      targetOffset,
    );
    data.set([255, 255, 255, 255], targetOffset + stream.arrayStride);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: `${stream.id}-color0-unorm8`,
        arrayStride,
        attributes: [
          ...stream.attributes,
          {
            semantic: "COLOR_0",
            format: "unorm8x4",
            offset: stream.arrayStride,
          },
        ],
        data,
      },
    ],
  };
}

function withSkinningAttributes(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        attributes: [
          ...stream.attributes,
          {
            semantic: "JOINTS_0",
            format: "uint16x4",
            offset: stream.arrayStride,
          },
          {
            semantic: "WEIGHTS_0",
            format: "float32x4",
            offset: stream.arrayStride + 8,
          },
        ],
        arrayStride: stream.arrayStride + 24,
      },
    ],
    skinning: {
      joints0: "JOINTS_0",
      weights0: "WEIGHTS_0",
    },
  };
}

function withCompactSkinningAttributes(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        attributes: [
          ...stream.attributes,
          {
            semantic: "JOINTS_0",
            format: "uint8x4",
            offset: stream.arrayStride,
          },
          {
            semantic: "WEIGHTS_0",
            format: "unorm8x4",
            offset: stream.arrayStride + 4,
          },
        ],
        arrayStride: stream.arrayStride + 8,
      },
    ],
    skinning: {
      joints0: "JOINTS_0",
      weights0: "WEIGHTS_0",
    },
  };
}

function withSplitVertexStreams(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: `${stream.id}-position-normal`,
        arrayStride: 24,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
        ],
      },
      {
        ...stream,
        id: `${stream.id}-uv-color`,
        arrayStride: 12,
        attributes: [
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 0 },
          { semantic: "COLOR_0", format: "unorm8x4", offset: 8 },
        ],
        data: new Uint8Array(stream.vertexCount * 12),
      },
    ],
  };
}

function withPaddedVertexStream(mesh: MeshAsset): MeshAsset {
  const stream = required(mesh.vertexStreams[0]);

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        arrayStride: 40,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 4 },
          { semantic: "NORMAL", format: "float32x3", offset: 20 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 32 },
        ],
        data: new Uint8Array(stream.vertexCount * 40),
      },
    ],
  };
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function translationMatrix(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function createTwoRenderableTextureDependencyFixture(
  texture: ReturnType<typeof createTextureHandle>,
  sampler: ReturnType<typeof createSamplerHandle>,
): {
  readonly assets: AssetRegistry;
  readonly world: ReturnType<typeof createWorld>;
} {
  const world = createRuntimeWorld();
  const assets = createReadyAssets({
    materialAsset: createUnlitMaterialAsset({
      baseColorTexture: { texture, sampler },
    }),
  });

  createCameraEntity(world, { priority: 0, layerMask: 1 });
  createMeshEntity(world, {
    meshId: "mesh:cube",
    materialId: "material:unlit",
    layerMask: 1,
  });
  createMeshEntity(world, {
    meshId: "mesh:cube",
    materialId: "material:unlit",
    layerMask: 1,
  });

  return { assets, world };
}

function createFrustumCullingFixture(input: {
  readonly totalEntities: number;
  readonly visibleEntities: number;
  readonly frustumCulling: boolean;
}): {
  readonly assets: AssetRegistry;
  readonly camera: ReturnType<typeof createCameraEntity>;
  readonly world: ReturnType<typeof createWorld>;
} {
  const world = createRuntimeWorld(input.totalEntities + 8);
  const assets = createReadyAssets();

  const camera = createCameraEntity(world, {
    priority: 0,
    layerMask: 1,
    translation: [0, 0, 5],
    ...(input.frustumCulling ? {} : { frustumCulling: false }),
  });

  for (let index = 0; index < input.totalEntities; index += 1) {
    const visible = index < input.visibleEntities;
    const column = index % 20;
    const row = Math.floor(index / 20);

    createMeshEntity(world, {
      meshId: "mesh:cube",
      materialId: "material:unlit",
      layerMask: 1,
      translation: visible
        ? [(column - 10) * 0.18, (row % 10) * 0.18 - 0.9, 0]
        : [120 + index, 0, 0],
    });
  }

  return { assets, camera, world };
}

function createCameraEntity(
  world: ReturnType<typeof createWorld>,
  input: {
    readonly priority: number;
    readonly layerMask: number;
    readonly translation?: readonly [number, number, number];
    readonly renderTargetId?: string;
    readonly frustumCulling?: boolean;
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
      ...(input.frustumCulling === undefined
        ? {}
        : { frustumCulling: input.frustumCulling }),
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
    readonly translation?: readonly [number, number, number];
  },
) {
  const entity = world.createEntity();
  const root =
    input.translation === undefined
      ? createRootTransform()
      : createRootTransform({ translation: input.translation });

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(Mesh, {
    meshId: input.meshId,
  });
  entity.addComponent(Material, {
    materialId: input.materialId,
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

function createTransformlessLightEntity(
  world: ReturnType<typeof createWorld>,
  input: LightInput = {},
) {
  const entity = world.createEntity();

  entity.addComponent(Light, createLight(input));
  return entity;
}

function matrixAt(values: Float32Array, offset: number | undefined): number[] {
  if (offset === undefined) {
    throw new Error("Expected matrix offset.");
  }

  return Array.from(values.slice(offset, offset + 16));
}

function diagnosticAssetPairs(
  snapshot: ReturnType<typeof extractRenderSnapshot>,
): {
  readonly code: string;
  readonly assetKey?: string;
}[] {
  return snapshot.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    ...(diagnostic.assetKey === undefined
      ? {}
      : { assetKey: diagnostic.assetKey }),
  }));
}

function expectBlockedTextureDependencySnapshot(
  snapshot: ReturnType<typeof extractRenderSnapshot>,
  expectedDiagnostics: readonly {
    readonly code: string;
    readonly assetKey: string;
  }[],
): void {
  expect(snapshot.meshDraws).toEqual([]);
  expect(snapshot.report.diagnostics).toBe(expectedDiagnostics.length);
  expect(diagnosticAssetPairs(snapshot)).toEqual(expectedDiagnostics);
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected fixture value.");
  }

  return value;
}
