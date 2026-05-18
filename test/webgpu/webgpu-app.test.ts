import { describe, expect, it } from "vitest";

import {
  assetHandleKey,
  createBoxMeshAsset,
  createDebugNormalMaterialAsset,
  createMatcapMaterialAsset,
  createRenderAssetCollections,
  createSamplerHandle,
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  createTextureHandle,
  createUnlitMaterialAsset,
  Light,
  LightKind,
  LocalTransform,
  Material,
  Visibility,
  withCamera,
  withLight,
  withMaterial,
  withMesh,
  withRenderLayer,
  withTransform,
  withVisibility,
  type MeshAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";
import {
  createQueuedMaterialAdapterRegistry,
  createWebGpuApp,
  createWebGpuAppDiagnosticsSummary,
  createWebGpuAppDrawResourceSetPlan,
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue,
  validateQueuedBuiltInAppResourceAdapterRegistry,
  webGpuAppRenderReportToJson,
  webGpuAppRenderReportToJsonValue,
} from "@aperture-engine/webgpu";

describe("WebGPU app facade", () => {
  it("initializes WebGPU and renders the unlit queue path from ECS-authored entities", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 11);

    expect(frame.ok).toBe(true);
    expect(frame.frame).toBe(11);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 1 },
          matcap: { entries: 0 },
          standard: { entries: 0 },
        },
      },
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMeshFacadeSummary(frame, { totalEntries: 1 });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      1,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(0);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(0);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(events).toContain("context:configure:bgra8unorm");
    expect(events).toContain("queue:submit:1");
    expect(events.some((event) => event.startsWith("pass:draw"))).toBe(true);

    const firstResourceEvents = resourceEventCounts(events);
    const firstEventCount = events.length;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 12);
    const secondEvents = events.slice(firstEventCount);
    const firstResources = frame.resources?.resources;
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 1 },
          matcap: { entries: 0 },
          standard: { entries: 0 },
        },
      },
      bindGroupsReused: 3,
      dynamicBufferWrites: 2,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.viewUniform.buffer).toBe(
      firstResources?.viewUniform.buffer,
    );
    expect(secondResources?.worldTransforms.buffer).toBe(
      firstResources?.worldTransforms.buffer,
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(secondEvents).toContain("queue:submit:1");
    expect(secondEvents.some((event) => event.startsWith("pass:draw"))).toBe(
      true,
    );
    expect(secondEvents).toContain("queue:writeBuffer:WorldTransforms/storage");
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.assets.markReady(
      material,
      createUnlitMaterialAsset({
        label: "White Updated",
        baseColorFactor: [0.8, 0.85, 1, 1],
      }),
    );

    const sourceVersionFrame = await app.stepAndRender(1 / 60, 3, 13);

    expect(sourceVersionFrame.ok).toBe(true);
    expect(sourceVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectPreparedMaterialCacheSummary(sourceVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(sourceVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMeshFacadeSummary(sourceVersionFrame, { totalEntries: 1 });
  });

  it("reuses prepared scalar unlit mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedMeshCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Mesh White" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Mesh Blue" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const cube = app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 60);
    const firstResources = firstFrame.resources?.resources;
    const firstMeshResource = firstResources?.mesh;
    const firstMaterialResource = singleMaterialResource(firstResources);
    const firstEventCounts = resourceEventCounts(events);

    cube.removeComponent(Material);
    cube.addComponent(Material, { materialId: assetHandleKey(secondMaterial) });

    const secondFrame = await app.stepAndRender(1 / 60, 2, 61);
    const secondResources = secondFrame.resources?.resources;

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      materialBuffersReused: 0,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expect(secondResources?.mesh).toBe(firstMeshResource);
    expect(singleMaterialResource(secondResources)).not.toBe(
      firstMaterialResource,
    );
    expect(resourceEventCounts(events).buffers).toBe(
      firstEventCounts.buffers + 3,
    );
  });

  it("reports scalar unlit prepared mesh and material source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedMeshA" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "VersionedMaterialA" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 62);

    assets.meshes.markReady(
      mesh,
      createBoxMeshAsset({ label: "VersionedMeshB" }),
    );

    const meshVersionFrame = await app.stepAndRender(1 / 60, 2, 63);

    assets.materials.unlit.markReady(
      material,
      createUnlitMaterialAsset({ label: "VersionedMaterialB" }),
    );

    const materialVersionFrame = await app.stepAndRender(1 / 60, 3, 64);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(meshVersionFrame.ok).toBe(true);
    expect(meshVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsReused: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(meshVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(materialVersionFrame.ok).toBe(true);
    expect(materialVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(materialVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(materialVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(materialVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders same-resource multi-draw frames through the material queue resource set", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SharedWhite" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 21);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(material),
          drawIndices: [0, 1],
        },
      ],
    });
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      2,
    );
    expect(
      queuedMaterialResources(frame.resources?.resources, "unlit").map(
        (resource) => resource.material,
      ),
    ).toEqual([
      queuedMaterialResources(frame.resources?.resources, "unlit")[0]?.material,
      queuedMaterialResources(frame.resources?.resources, "unlit")[0]?.material,
    ]);
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
  });

  it("reuses scalar unlit prepared material resources across frame-resource cache misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const firstMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedUnlitFirst" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedUnlitSecond" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Prepared Unlit White" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(firstMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 14);
    const firstUnlitResource = queuedMaterialResources(
      frame.resources?.resources,
      "unlit",
    )[0];
    const firstMaterialResource = firstUnlitResource?.material;
    const firstMaterialBindGroup = firstUnlitResource?.bindGroups?.find(
      (bindGroup) => bindGroup.group === 2,
    );

    expect(frame.ok).toBe(true);
    expect(frame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      materialBuffersCreated: 1,
      bindGroupsCreated: 3,
    });
    expect(firstMaterialResource).toBeDefined();
    expect(firstMaterialBindGroup).toBeDefined();

    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 15);
    const secondUnlitResources = queuedMaterialResources(
      secondFrame.resources?.resources,
      "unlit",
    );

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      bindGroupsCreated: 4,
      bindGroupsReused: 2,
      dynamicBufferWrites: 0,
    });
    expect(secondUnlitResources).toHaveLength(2);
    expect(secondUnlitResources[0]?.material).toBe(firstMaterialResource);
    expect(secondUnlitResources[1]?.material).toBe(firstMaterialResource);
    expect(
      secondUnlitResources[0]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(
      secondUnlitResources[1]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
  });

  it("renders multiple unlit app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "FirstWhite" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "SecondBlue" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 22);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      materialBuffersCreated: 2,
      bindGroupsCreated: 4,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(firstMaterial),
          drawIndices: [0],
        },
        {
          index: 1,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(secondMaterial),
          drawIndices: [1],
        },
      ],
    });
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");
  });

  it("prunes stale prepared material facade entries without evicting backend caches", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const firstMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "FacadeRetainedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "FacadePrunedCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Facade Retained White" }),
    );
    const secondMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Facade Pruned Standard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.45, 0, 0] }),
      withMesh(firstMesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    const prunedEntity = app.spawn(
      withTransform({ translation: [0.45, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 76);

    prunedEntity.setValue(Visibility, "visible", false);

    const secondFrame = await app.stepAndRender(1 / 60, 2, 77);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.counts.drawCalls).toBe(2);
    expect(firstFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 2,
      preparedMeshBuffersReused: 0,
    });
    expectPreparedMeshCacheSummary(firstFrame, {
      totalEntries: 2,
      layoutEntryCounts: [2],
    });
    expectPreparedMeshFacadeSummary(firstFrame, {
      totalEntries: 2,
      meshResourceKeys: [
        `prepared-mesh:${assetHandleKey(firstMesh)}`,
        `prepared-mesh:${assetHandleKey(secondMesh)}`,
      ],
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
    });
    expectPreparedMeshCacheSummary(secondFrame, {
      totalEntries: 2,
      layoutEntryCounts: [2],
    });
    expectPreparedMeshFacadeSummary(secondFrame, {
      totalEntries: 1,
      meshResourceKeys: [`prepared-mesh:${assetHandleKey(firstMesh)}`],
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeResourceKeys(secondFrame, [
      assetHandleKey(firstMaterial),
    ]);
    expect(JSON.stringify(secondFrame.resourceReuse)).not.toContain(
      "Facade Pruned Standard",
    );
  });

  it("renders mixed unlit and standard app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "SharedCube" }));
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "FirstWhite" }),
    );
    const secondMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "SecondStandard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 22);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: expect.arrayContaining([
        expect.objectContaining({
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(firstMaterial),
          drawIndices: [expect.any(Number)],
        }),
        expect.objectContaining({
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(secondMaterial),
          drawIndices: [expect.any(Number)],
        }),
      ]),
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 2,
      bindGroupsCreated: 7,
      lightBuffersCreated: 1,
    });
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 23);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersReused: 2,
      materialBuffersReused: 2,
      bindGroupsReused: 7,
      lightBuffersReused: 1,
      dynamicBufferWrites: 6,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("surfaces material source dependency readiness before app rendering", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const texture = createTextureHandle("not-registered");
    const sampler = createSamplerHandle("loading-sampler");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "BlockedTexture",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 23);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
        diagnostics: [
          {
            code: "materialDependency.dependencyMissing",
            field: "baseColorTexture",
            dependencyKey: assetHandleKey(texture),
          },
          {
            code: "materialDependency.dependencyLoading",
            field: "baseColorTexture",
            dependencyKey: assetHandleKey(sampler),
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    const value = webGpuAppRenderReportToJsonValue(frame);
    const json = webGpuAppRenderReportToJson(frame);

    expect(value).toMatchObject({
      ok: false,
      frame: 23,
      counts: {
        meshDraws: 0,
        drawCalls: 0,
      },
      materialDependencyReadiness: [
        {
          ready: false,
          materialKey: assetHandleKey(material),
          slots: [
            { handleKey: assetHandleKey(texture), status: "missing" },
            { handleKey: assetHandleKey(sampler), status: "loading" },
          ],
        },
      ],
    });
    expect(json).toBe(JSON.stringify(value));
    expect(json).not.toContain("snapshot");
    expect(json).not.toContain("commandBuffer");
    expect(events).not.toContain("queue:submit:1");
  });

  it("prepares and reuses textured unlit app material resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedCubeSecond" }),
    );
    const texture = createTextureHandle("app-albedo");
    const sampler = createSamplerHandle("app-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "AppAlbedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(sampler, createSamplerAsset({ label: "AppLinear" }));

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "TexturedApp",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 24);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
      bindGroupsCreated: 3,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectTextureSamplerCacheSummary(frame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expect(events).toContain("device:texture:AppAlbedo");
    expect(events).toContain("textureResource:view:AppAlbedo");
    expect(events).toContain("device:sampler:AppLinear");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstUnlitResource = queuedMaterialResources(
      frame.resources?.resources,
      "unlit",
    )[0];
    const firstMaterialResource = firstUnlitResource?.material;
    const firstMaterialBindGroup = firstUnlitResource?.bindGroups?.find(
      (bindGroup) => bindGroup.group === 2,
    );
    app.spawn(
      withTransform({ translation: [0.7, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    const secondFrame = await app.stepAndRender(1 / 60, 2, 25);
    const secondUnlitResources = queuedMaterialResources(
      secondFrame.resources?.resources,
      "unlit",
    );

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 2,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 4,
      bindGroupsReused: 2,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(secondFrame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expect(secondUnlitResources).toHaveLength(2);
    expect(secondUnlitResources[0]?.material).toBe(firstMaterialResource);
    expect(secondUnlitResources[1]?.material).toBe(firstMaterialResource);
    expect(
      secondUnlitResources[0]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(
      secondUnlitResources[1]?.bindGroups?.find(
        (bindGroup) => bindGroup.group === 2,
      ),
    ).toBe(firstMaterialBindGroup);
    expect(resourceEventCounts(events)).toMatchObject({
      textures: firstResourceEvents.textures,
      textureViews: firstResourceEvents.textureViews,
      samplers: firstResourceEvents.samplers,
      buffers: firstResourceEvents.buffers + 8,
      bindGroups: firstResourceEvents.bindGroups + 4,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      materialBuffersReused: 2,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });
  });

  it("reports textured unlit texture and sampler source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedTextureCube" }),
    );
    const texture = createTextureHandle("versioned-unlit-albedo");
    const sampler = createSamplerHandle("versioned-unlit-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "VersionedUnlitAlbedoA",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "VersionedUnlitSamplerA" }),
    );

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "VersionedTexturedUnlit",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 65);

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "VersionedUnlitAlbedoB",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled"],
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 2, 66);

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "VersionedUnlitSamplerB" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 3, 67);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expectTextureSamplerCacheSummary(firstFrame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(textureVersionFrame, {
      textureEntries: 2,
      samplerEntries: 1,
    });
    expectPreparedMaterialCacheSummary(textureVersionFrame, {
      unlit: 2,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(textureVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      dynamicBufferWrites: 0,
    });
    expectTextureSamplerCacheSummary(samplerVersionFrame, {
      textureEntries: 2,
      samplerEntries: 2,
    });
    expectPreparedMaterialCacheSummary(samplerVersionFrame, {
      unlit: 3,
      matcap: 0,
      standard: 0,
    });
    expectPreparedMaterialFacadeSummary(samplerVersionFrame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("surfaces app texture upload layout diagnostics without submitting", async () => {
    const cases = [
      {
        id: "bad-row",
        expectedCode: "textureResource.invalidBytesPerRow",
        sourceData: {
          bytes: new Uint8Array(16),
          bytesPerRow: 4,
          rowsPerImage: 2,
        },
      },
      {
        id: "too-small",
        expectedCode: "textureResource.uploadDataTooSmall",
        sourceData: {
          bytes: new Uint8Array(4),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const events: string[] = [];
      const { canvas, environment } = webGpuHarness(events);
      const created = await createWebGpuApp({
        canvas,
        environment,
        worldOptions: { entityCapacity: 8 },
      });

      expect(created.ok).toBe(true);

      if (!created.ok) {
        return;
      }

      const app = created.app;
      const assets = createRenderAssetCollections({ registry: app.assets });
      const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
      const texture = createTextureHandle(`upload-${testCase.id}`);
      const sampler = createSamplerHandle(`upload-${testCase.id}-sampler`);

      app.assets.register(texture);
      app.assets.markReady(
        texture,
        createTextureAsset({
          label: `Upload ${testCase.id}`,
          dimension: "2d",
          width: 2,
          height: 2,
          format: "rgba8unorm",
          colorSpace: "linear",
          semantic: "data",
          usage: ["sampled", "copy-dst"],
          sourceData: testCase.sourceData,
        }),
      );
      app.assets.register(sampler);
      app.assets.markReady(sampler, createSamplerAsset());

      const material = assets.materials.unlit.add(
        createUnlitMaterialAsset({
          label: `Upload ${testCase.id}`,
          baseColorTexture: { texture, sampler },
        }),
      );

      app.spawn(
        withTransform({ translation: [0, 0, 5] }),
        withCamera({ priority: 0, layerMask: 1 }),
      );
      app.spawn(
        withTransform(),
        withMesh(mesh),
        withMaterial(material),
        withRenderLayer(1),
        withVisibility(true),
      );

      const frame = await app.stepAndRender(1 / 60, 1, 29);
      const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic
          ? diagnostic.code
          : null,
      );
      const json = webGpuAppRenderReportToJson(frame);

      expect(frame.ok).toBe(false);
      expect(diagnosticCodes).toContain(testCase.expectedCode);
      expect(json).toContain(testCase.expectedCode);
      expect(json).not.toContain("commandBuffer");
      expect(events).not.toContain("queue:submit:1");
    }
  });

  it("renders and reuses the single-material matcap queue path", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MatcapCube" }));
    const texture = createTextureHandle("studio-matcap");
    const sampler = createSamplerHandle("matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "MatcapLinear" }),
    );

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Studio Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 26);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "matcap|matcapTexture|opaque|back|less|none",
    );
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 1 },
          standard: { entries: 0 },
        },
      },
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      0,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(1);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(0);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(events).toContain("device:texture:StudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:MatcapLinear");
    expect(events).toContain("pass:bind:2");
    expect(events).toContain("queue:submit:1");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 27);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      preparedMaterialCache: {
        totalEntries: 1,
        families: {
          unlit: { entries: 0 },
          matcap: { entries: 1 },
          standard: { entries: 0 },
        },
      },
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 3,
      dynamicBufferWrites: 2,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("reuses prepared matcap mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedMatcapCube" }),
    );
    const texture = createTextureHandle("prepared-matcap");
    const sampler = createSamplerHandle("prepared-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "PreparedMatcapA",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled"],
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "PreparedMatcapSampler" }),
    );

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Prepared Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 68);

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "PreparedMatcapB",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled"],
      }),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 69);

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "PreparedMatcapSamplerB" }),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 70);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 0,
      matcap: 1,
      standard: 0,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 0,
      matcap: 2,
      standard: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(thirdFrame, {
      unlit: 0,
      matcap: 3,
      standard: 0,
    });
  });

  it("surfaces matcap material dependency readiness before app rendering", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "MatcapCube" }));
    const texture = createTextureHandle("missing-matcap");
    const sampler = createSamplerHandle("loading-matcap-sampler");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Blocked Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 28);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "matcap",
        slots: [
          {
            field: "matcapTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "matcapTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders mixed unlit and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedMaterialCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Mixed Unlit" }),
    );
    const texture = createTextureHandle("mixed-studio-matcap");
    const sampler = createSamplerHandle("mixed-matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "MixedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "MixedMatcapLinear" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 30);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey),
    ).toEqual([
      "matcap|matcapTexture|opaque|back|less|none",
      "unlit|opaque|back|less|none",
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(createWebGpuAppDrawResourceSetPlan(frame.snapshot)).toMatchObject({
      drawCount: 2,
      sets: [
        {
          index: 0,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(matcapMaterial),
          drawIndices: [0],
        },
        {
          index: 1,
          meshKey: assetHandleKey(mesh),
          materialKey: assetHandleKey(unlitMaterial),
          drawIndices: [1],
        },
      ],
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      sectionCount: 3,
      materialQueue: {
        itemCount: 2,
        byPhase: [{ phase: "opaque", itemCount: 2 }],
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPhaseAndFamily: [
          { phase: "opaque", family: "matcap", itemCount: 1 },
          { phase: "opaque", family: "unlit", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 2,
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPipeline: [
          {
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          { pipelineKey: "unlit|opaque|back|less|none", itemCount: 1 },
        ],
        byFamilyAndPipeline: [
          {
            family: "matcap",
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "unlit",
            pipelineKey: "unlit|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      builtInAppResourceAdapters: {
        valid: true,
        expectedFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        registeredFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        diagnostics: [],
      },
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toMatch(/GPU|Mixed Unlit|Mixed Matcap|MixedMaterialCube/);
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
    });
    expect(events).toContain("device:texture:MixedStudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:MixedMatcapLinear");
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 31);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersReused: 2,
      materialBuffersReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      dynamicBufferWrites: 4,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("renders mixed textured unlit and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedTexturedCube" }),
    );
    const unlitTexture = createTextureHandle("mixed-unlit-albedo");
    const unlitSampler = createSamplerHandle("mixed-unlit-nearest");
    const matcapTexture = createTextureHandle("mixed-textured-studio-matcap");
    const matcapSampler = createSamplerHandle("mixed-textured-matcap-linear");

    app.assets.register(unlitTexture);
    app.assets.markReady(
      unlitTexture,
      createTextureAsset({
        label: "MixedUnlitAlbedo",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 32, 255, 255, 128, 32, 255, 128, 32, 255, 255, 32, 255,
            128, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(unlitSampler);
    app.assets.markReady(
      unlitSampler,
      createSamplerAsset({ label: "MixedUnlitNearest" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "MixedTexturedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "MixedTexturedMatcapLinear" }),
    );

    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Mixed Textured Unlit",
        baseColorTexture: { texture: unlitTexture, sampler: unlitSampler },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Textured Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 35);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      materialBuffersCreated: 2,
    });
    expect(events).toContain("device:texture:MixedUnlitAlbedo");
    expect(events).toContain("device:texture:MixedTexturedStudioMatcap");
    expect(
      events.filter((event) => event === "queue:writeTexture:16"),
    ).toHaveLength(2);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 36);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      dynamicBufferWrites: 4,
    });
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("blocks mixed unlit and matcap rendering when the matcap texture dependency is missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedBlockedCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Mixed Ready Unlit" }),
    );
    const texture = createTextureHandle("missing-mixed-matcap");
    const sampler = createSamplerHandle("ready-mixed-matcap-sampler");

    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "ReadyMixedMatcapSampler" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Blocked Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 32);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts.drawCalls).toBe(0);
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(matcapMaterial),
        materialKind: "matcap",
        slots: [
          {
            field: "matcapTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "matcapTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "ready",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks mixed textured unlit and matcap rendering when the unlit texture dependency is missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MixedBlockedTexturedCube" }),
    );
    const unlitTexture = createTextureHandle("missing-mixed-unlit-albedo");
    const unlitSampler = createSamplerHandle("ready-mixed-unlit-sampler");
    const matcapTexture = createTextureHandle("ready-mixed-matcap");
    const matcapSampler = createSamplerHandle("ready-mixed-matcap-sampler");

    app.assets.register(unlitSampler);
    app.assets.markReady(
      unlitSampler,
      createSamplerAsset({ label: "ReadyMixedUnlitSampler" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "ReadyMixedMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "ReadyMixedMatcapSampler" }),
    );

    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Mixed Blocked Textured Unlit",
        baseColorTexture: { texture: unlitTexture, sampler: unlitSampler },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Mixed Ready Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 37);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts.drawCalls).toBe(0);
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(unlitMaterial),
        materialKind: "unlit",
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(unlitTexture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(unlitSampler),
            status: "ready",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders mixed standard and matcap app resource sets for a shared mesh", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "StandardMatcapCube" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Mixed Standard",
        metallicFactor: 0.35,
        roughnessFactor: 0.45,
      }),
    );
    const texture = createTextureHandle("standard-mixed-studio-matcap");
    const sampler = createSamplerHandle("standard-mixed-matcap-linear");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMixedStudioMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMixedMatcapLinear" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Standard Mixed Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 33);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(
      new Set(frame.snapshot.meshDraws.map((draw) => draw.material)),
    ).toEqual(new Set([standardMaterial, matcapMaterial]));
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 2,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
      lightBuffersCreated: 1,
    });
    expect(events).toContain("device:texture:StandardMixedStudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("pass:bind:3");
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(2);
    expect(events).toContain("queue:submit:1");
  });

  it("blocks mixed standard rendering when extracted lights are missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "BlockedLit" }));
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Ready Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "No Lights Standard" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 34);
    const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      "code" in diagnostic
        ? diagnostic.code
        : null,
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(diagnosticCodes).toContain("standardFrameResources.missingLights");
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks mixed standard rendering when StandardMaterial texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedStandardTexture" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Ready Standard Peer Unlit" }),
    );
    const texture = createTextureHandle("missing-standard-base-color");
    const sampler = createSamplerHandle("loading-standard-base-color");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Texture Standard",
        baseColorTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.6, 0, 0] }),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 41);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(standardMaterial),
        materialKind: "standard",
        slots: [
          {
            field: "baseColorTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "baseColorTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("reuses unlit, standard, and matcap app resource cache slots without successful route diagnostics", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "ThreeFamilyCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Three Family Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Three Family Standard" }),
    );
    const texture = createTextureHandle("three-family-matcap");
    const sampler = createSamplerHandle("three-family-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "ThreeFamilyMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "ThreeFamilyMatcapSampler" }),
    );

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Three Family Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const unlitEntity = app.spawn(
      withTransform({ translation: [-0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    const ambientLight = app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 38);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 3,
      drawPackages: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      sectionCount: 4,
      materialQueue: {
        itemCount: 3,
        byPhase: [{ phase: "opaque", itemCount: 3 }],
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "standard", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPhaseAndFamily: [
          { phase: "opaque", family: "matcap", itemCount: 1 },
          { phase: "opaque", family: "standard", itemCount: 1 },
          { phase: "opaque", family: "unlit", itemCount: 1 },
        ],
      },
      routedResourceSet: {
        itemCount: 3,
        byFamily: [
          { family: "matcap", itemCount: 1 },
          { family: "standard", itemCount: 1 },
          { family: "unlit", itemCount: 1 },
        ],
        byPipeline: [
          {
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          { pipelineKey: "standard|opaque|back|less|none", itemCount: 1 },
          { pipelineKey: "unlit|opaque|back|less|none", itemCount: 1 },
        ],
        byFamilyAndPipeline: [
          {
            family: "matcap",
            pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "standard",
            pipelineKey: "standard|opaque|back|less|none",
            itemCount: 1,
          },
          {
            family: "unlit",
            pipelineKey: "unlit|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      directLighting: {
        ready: true,
        resources: {
          lightGpuBufferResourceKey: "light-buffer:main",
          lightBindGroupLayoutKey: "webgpu-app/standard/group-3",
          lightBindGroupResourceKey:
            "bind-group:lights/group-3/light-buffer:main",
        },
      },
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toMatch(
      /GPUBuffer|GPUTexture|Three Family Unlit|Three Family Standard|Three Family Matcap|ThreeFamilyCube/,
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 3,
      meshBuffersCreated: 1,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 3,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 10,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeResourceKeys(frame, [
      assetHandleKey(unlitMaterial),
      assetHandleKey(matcapMaterial),
      assetHandleKey(standardMaterial),
    ]);
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(3);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(3);
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResources = frame.resources?.resources;
    const firstUnlitResource = queuedMaterialResources(
      firstResources,
      "unlit",
    )[0];
    const firstMatcapResource = queuedMaterialResources(
      firstResources,
      "matcap",
    )[0];
    const firstStandardResource = queuedMaterialResources(
      firstResources,
      "standard",
    )[0];

    expect(queuedFamilyResourceCount(firstResources, "unlit")).toBe(1);
    expect(queuedFamilyResourceCount(firstResources, "matcap")).toBe(1);
    expect(queuedFamilyResourceCount(firstResources, "standard")).toBe(1);
    expect(firstUnlitResource?.material).toBeDefined();
    expect(firstMatcapResource?.material).toBeDefined();
    expect(firstStandardResource?.material).toBeDefined();
    expect(hasStandardLightResources(firstStandardResource)).toBe(true);

    const firstUnlitMaterialResource = firstUnlitResource?.material;
    const firstMatcapMaterialResource = firstMatcapResource?.material;
    const firstStandardMaterialResource = firstStandardResource?.material;
    const firstStandardLightResource = hasStandardLightResources(
      firstStandardResource,
    )
      ? firstStandardResource.lightGpuBuffers.resource
      : null;
    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 39);
    const secondResources = secondFrame.resources?.resources;
    const secondUnlitResource = queuedMaterialResources(
      secondResources,
      "unlit",
    )[0];
    const secondMatcapResource = queuedMaterialResources(
      secondResources,
      "matcap",
    )[0];
    const secondStandardResource = queuedMaterialResources(
      secondResources,
      "standard",
    )[0];

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(secondFrame);
    expectNoFrameResourceRouteDiagnostic(secondFrame);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 3,
      pipelineMisses: 0,
      meshBuffersReused: 3,
      materialBuffersReused: 3,
      textureResourcesReused: 1,
      samplerResourcesReused: 1,
      bindGroupsReused: 10,
      lightBuffersReused: 1,
      dynamicBufferWrites: 8,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expect(queuedFamilyResourceCount(secondResources, "unlit")).toBe(1);
    expect(queuedFamilyResourceCount(secondResources, "matcap")).toBe(1);
    expect(queuedFamilyResourceCount(secondResources, "standard")).toBe(1);
    expect(secondUnlitResource).toBe(firstUnlitResource);
    expect(secondMatcapResource).toBe(firstMatcapResource);
    expect(secondStandardResource).toBe(firstStandardResource);
    expect(secondUnlitResource?.material).toBe(firstUnlitMaterialResource);
    expect(secondMatcapResource?.material).toBe(firstMatcapMaterialResource);
    expect(secondStandardResource?.material).toBe(
      firstStandardMaterialResource,
    );
    expect(hasStandardLightResources(secondStandardResource)).toBe(true);

    if (hasStandardLightResources(secondStandardResource)) {
      expect(secondStandardResource.lightGpuBuffers.resource).toBe(
        firstStandardLightResource,
      );
    }

    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    unlitEntity.getVectorView(LocalTransform, "translation").set([-1, 0, 0]);
    ambientLight.setValue(Light, "intensity", 0.35);

    const transformLightFrame = await app.stepAndRender(1 / 60, 3, 40);

    expect(transformLightFrame.ok).toBe(true);
    expect(transformLightFrame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(transformLightFrame);
    expectNoFrameResourceRouteDiagnostic(transformLightFrame);
    expect(transformLightFrame.resourceReuse).toMatchObject({
      pipelineHits: 3,
      pipelineMisses: 0,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBindGroupsCreated: 0,
      lightBuffersReused: 1,
    });
    expectPreparedMaterialCacheSummary(transformLightFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(transformLightFrame, {
      unlit: 1,
      matcap: 1,
      standard: 1,
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(transformLightFrame).resourceReuse
          .preparedMaterialCache,
      ),
    ).not.toContain("prepared-material");
  });

  it("routes scalar and textured StandardMaterial queue items with unlit and matcap draws", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "QueuedBuiltInCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queued Unlit" }),
    );
    const scalarStandardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Queued Scalar Standard" }),
    );
    const standardTexture = createTextureHandle("queued-standard-base-color");
    const standardSampler = createSamplerHandle(
      "queued-standard-base-color-sampler",
    );
    const matcapTexture = createTextureHandle("queued-matcap");
    const matcapSampler = createSamplerHandle("queued-matcap-sampler");

    app.assets.register(standardTexture);
    app.assets.markReady(
      standardTexture,
      createTextureAsset({
        label: "QueuedStandardBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 64, 255, 64, 255, 64, 255, 64, 64, 255, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(standardSampler);
    app.assets.markReady(
      standardSampler,
      createSamplerAsset({ label: "QueuedStandardBaseColorSampler" }),
    );
    app.assets.register(matcapTexture);
    app.assets.markReady(
      matcapTexture,
      createTextureAsset({
        label: "QueuedMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(matcapSampler);
    app.assets.markReady(
      matcapSampler,
      createSamplerAsset({ label: "QueuedMatcapSampler" }),
    );

    const texturedStandardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Queued Textured Standard",
        baseColorTexture: {
          texture: standardTexture,
          sampler: standardSampler,
        },
      }),
    );
    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Queued Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-1.2, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [-0.4, 0, 0] }),
      withMesh(mesh),
      withMaterial(scalarStandardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.4, 0, 0] }),
      withMesh(mesh),
      withMaterial(texturedStandardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [1.2, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 42);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 4,
      drawPackages: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(frame);
    expectNoFrameResourceRouteDiagnostic(frame);
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 4,
      meshBuffersCreated: 1,
      meshBuffersReused: 3,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 3,
      materialBuffersCreated: 4,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      bindGroupsCreated: 14,
      lightBuffersCreated: 2,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeResourceKeys(frame, [
      assetHandleKey(unlitMaterial),
      assetHandleKey(scalarStandardMaterial),
      assetHandleKey(texturedStandardMaterial),
      assetHandleKey(matcapMaterial),
    ]);
    expect(
      new Set(
        frame.snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey),
      ),
    ).toEqual(
      new Set([
        "unlit|opaque|back|less|none",
        "matcap|matcapTexture|opaque|back|less|none",
        "standard|opaque|back|less|none",
        "standard|baseColorTexture|opaque|back|less|none",
      ]),
    );
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(4);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(4);
    expect(events.filter((event) => event === "pass:bind:3")).toHaveLength(2);
    expect(events).toContain("device:texture:QueuedStandardBaseColor");
    expect(events).toContain("device:texture:QueuedMatcap");
    expect(events).toContain("queue:submit:1");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 45);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts).toMatchObject({
      meshDraws: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expectNoMaterialQueueRouteReport(secondFrame);
    expectNoFrameResourceRouteDiagnostic(secondFrame);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 4,
      pipelineMisses: 0,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 1,
      matcap: 1,
      standard: 2,
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse
          .preparedMaterialCache,
      ),
    ).not.toContain("GPU");
  });

  it("routes DebugNormalMaterial app resources with JSON-safe summaries", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedQueueFamilyCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queue Supported Unlit" }),
    );
    const debugNormalMaterial = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({ label: "Queue Debug Normal" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(debugNormalMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 43);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 2,
    });
    expect(frame.diagnostics).toEqual([]);
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 1,
      matcap: 0,
      standard: 0,
      debugNormal: 1,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      1,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "debug-normal"),
    ).toBe(1);
    expect(webGpuAppRenderReportToJsonValue(frame)).toMatchObject({
      diagnosticsSummary: {
        sectionCount: 3,
        materialQueue: {
          itemCount: 2,
          byFamily: expect.arrayContaining([
            expect.objectContaining({ family: "unlit", itemCount: 1 }),
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
        },
        routedResourceSet: {
          itemCount: 2,
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              family: "unlit",
              itemCount: 1,
            }),
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
          byFamilyAndPipeline: expect.arrayContaining([
            expect.objectContaining({
              family: "debug-normal",
              pipelineKey: "debug-normal|opaque|back|less|none",
              itemCount: 1,
            }),
          ]),
        },
      },
    });
    expect(JSON.parse(webGpuAppRenderReportToJson(frame))).toMatchObject({
      diagnosticsSummary: {
        routedResourceSet: {
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              family: "debug-normal",
              itemCount: 1,
            }),
          ]),
        },
      },
    });
    expect(
      JSON.stringify(webGpuAppRenderReportToJsonValue(frame)),
    ).not.toContain("GPUBuffer");
    expect(events).toContain("queue:submit:1");
  });

  it("diagnoses unregistered route family keys without built-in fallback", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnregisteredRouteKeyCube" }),
    );
    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Unregistered Route Source" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [0, 0, 0] }),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(44);
    const [draw] = snapshot.meshDraws;

    expect(draw).toBeDefined();

    if (draw === undefined) {
      return;
    }

    const pipelineKey = "toon-shaded|opaque|back|less|none";
    const frame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 44, [
        {
          ...draw,
          sortKey: {
            ...draw.sortKey,
            pipelineKey,
          },
          batchKey: {
            ...draw.batchKey,
            pipelineKey,
          },
        },
      ]),
    });

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 1,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueFamily",
          materialFamily: "toon-shaded",
        }),
      ]),
    );

    const routeReport = materialQueueRouteReport(frame);

    expect(routeReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "toon-shaded",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
      }),
    });

    const jsonReport = webGpuAppRenderReportToJsonValue(frame);

    expect(jsonReport.diagnosticsSummary).toMatchObject({
      sectionCount: 2,
      materialQueueRoute: {
        valid: false,
        queueItemCount: 1,
        routedItemCount: 0,
        skippedItemCount: 1,
        byFamily: [
          {
            key: "toon-shaded",
            queuedCount: 1,
            routedCount: 0,
            skippedCount: 1,
          },
        ],
        byPhase: [
          {
            key: "opaque",
            queuedCount: 1,
            routedCount: 0,
            skippedCount: 1,
          },
        ],
        diagnosticSummary: {
          total: 1,
          bySeverity: { info: 0, warning: 0, error: 1 },
          byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
        },
        diagnostics: [
          expect.objectContaining({
            code: "webGpuApp.unsupportedMaterialQueueFamily",
            materialFamily: "toon-shaded",
            renderId: expect.any(Number),
            drawIndex: 0,
            entity: expect.objectContaining({
              index: expect.any(Number),
              generation: expect.any(Number),
            }),
          }),
        ],
      },
      builtInAppResourceAdapters: {
        valid: true,
        diagnostics: [],
      },
    });
    expect(events).not.toContain("queue:submit:1");
    expect(JSON.stringify(jsonReport)).not.toContain("GPUBuffer");
  });

  it("surfaces JSON-safe built-in app adapter registry validation diagnostics", () => {
    const invalidRegistry = createQueuedMaterialAdapterRegistry([
      { kind: "unlit" },
      { kind: "unlit" },
      { kind: "matcap" },
      { kind: "debug-normal" },
    ]);
    const diagnosticsSummary = createWebGpuAppDiagnosticsSummary({
      builtInAppResourceAdapters:
        queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
          validateQueuedBuiltInAppResourceAdapterRegistry(invalidRegistry),
        ),
    });

    expect(diagnosticsSummary).toMatchObject({
      sectionCount: 1,
      builtInAppResourceAdapters: {
        valid: false,
        expectedFamilies: ["unlit", "matcap", "standard", "debug-normal"],
        registeredFamilies: ["unlit", "unlit", "matcap", "debug-normal"],
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "queuedMaterialAdapter.duplicateFamily",
            severity: "warning",
            family: "unlit",
          }),
          expect.objectContaining({
            code: "queuedBuiltInAppResourceAdapter.missingFamily",
            severity: "error",
            family: "standard",
          }),
        ]),
      },
    });
    expect(JSON.stringify(diagnosticsSummary)).not.toMatch(
      /prepareTextureSamplerResources|createFrameResources|GPU|descriptor/,
    );
  });

  it("diagnoses unsupported alpha-test material queue families without submitting", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedQueuePhaseCube" }),
    );
    const opaqueMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Queue Opaque Unlit" }),
    );
    const alphaTestMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Queue Alpha Test Unlit",
        renderState: { alphaMode: "mask" },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 44);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
          renderPhase: "alpha-test",
          materialFamily: "unlit",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual([
      expect.objectContaining({
        code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
        renderId: expect.any(Number),
        drawIndex: expect.any(Number),
        renderPhase: "alpha-test",
        materialFamily: "unlit",
        entity: expect.objectContaining({
          index: expect.any(Number),
          generation: expect.any(Number),
        }),
      }),
      expect.objectContaining({
        code: "webGpuApp.materialQueueRouteReport",
        report: expect.objectContaining({
          valid: false,
          queueItemCount: 2,
          routedItemCount: 1,
          skippedItemCount: 1,
          byFamily: expect.arrayContaining([
            expect.objectContaining({
              key: "unlit",
              queuedCount: 2,
              routedCount: 1,
              skippedCount: 1,
            }),
          ]),
          byPhase: expect.arrayContaining([
            expect.objectContaining({
              key: "opaque",
              queuedCount: 1,
              routedCount: 1,
              skippedCount: 0,
            }),
            expect.objectContaining({
              key: "alpha-test",
              queuedCount: 1,
              routedCount: 0,
              skippedCount: 1,
            }),
          ]),
          diagnosticSummary: expect.objectContaining({
            total: 1,
            bySeverity: expect.objectContaining({ error: 1 }),
          }),
          diagnostics: [
            expect.objectContaining({
              code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
              materialFamily: "unlit",
              renderPhase: "alpha-test",
            }),
          ],
        }),
      }),
    ]);
    expect(events).not.toContain("queue:submit:1");
  });

  it("diagnoses unsupported transparent material queue families and blend presets without submitting", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "UnsupportedTransparentQueueCube" }),
    );
    const transparentUnlit = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Transparent Unlit",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );
    const additiveStandard = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Additive Transparent Standard",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "additive" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentUnlit),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(additiveStandard),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 45);

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
    });
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
          renderPhase: "transparent",
          materialFamily: "unlit",
        }),
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          renderPhase: "transparent",
          materialFamily: "standard",
          blendPreset: "additive",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
          renderId: expect.any(Number),
          drawIndex: expect.any(Number),
          renderPhase: "transparent",
          materialFamily: "unlit",
          entity: expect.objectContaining({
            index: expect.any(Number),
            generation: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          renderId: expect.any(Number),
          drawIndex: expect.any(Number),
          renderPhase: "transparent",
          materialFamily: "standard",
          blendPreset: "additive",
          entity: expect.objectContaining({
            index: expect.any(Number),
            generation: expect.any(Number),
          }),
        }),
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
          report: expect.objectContaining({
            valid: false,
            queueItemCount: 2,
            routedItemCount: 0,
            skippedItemCount: 2,
            byFamily: expect.arrayContaining([
              expect.objectContaining({
                key: "unlit",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              }),
              expect.objectContaining({
                key: "standard",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              }),
            ]),
            byPhase: expect.arrayContaining([
              expect.objectContaining({
                key: "transparent",
                queuedCount: 2,
                routedCount: 0,
                skippedCount: 2,
              }),
            ]),
            diagnosticSummary: expect.objectContaining({
              total: 2,
              bySeverity: expect.objectContaining({ error: 2 }),
            }),
            diagnostics: expect.arrayContaining([
              expect.objectContaining({
                code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
                materialFamily: "unlit",
                renderPhase: "transparent",
              }),
              expect.objectContaining({
                code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
                materialFamily: "standard",
                renderPhase: "transparent",
                blendPreset: "additive",
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(events).not.toContain("queue:submit:1");
  });

  it("includes asset mismatch details in material queue route reports", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "AssetMismatchRouteCube" }),
    );
    const firstMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Asset Mismatch First Unlit" }),
    );
    const secondMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Asset Mismatch Second Unlit" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(firstMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(secondMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(46);
    const [firstDraw, secondDraw] = snapshot.meshDraws;

    expect(firstDraw).toBeDefined();
    expect(secondDraw).toBeDefined();

    if (firstDraw === undefined || secondDraw === undefined) {
      return;
    }

    const mismatchedSnapshot = {
      ...snapshot,
      meshDraws: [
        firstDraw,
        {
          ...secondDraw,
          sortKey: {
            ...secondDraw.sortKey,
            pipelineKey: "standard|opaque|back|less|none",
          },
          batchKey: {
            ...secondDraw.batchKey,
            pipelineKey: "standard|opaque|back|less|none",
          },
        },
      ],
    };

    const frame = await app.render({ snapshot: mismatchedSnapshot });

    expect(frame.ok).toBe(false);
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.materialQueueAssetMismatch",
          materialFamily: "standard",
          materialKind: "unlit",
        }),
      ]),
    );
    expect(JSON.parse(JSON.stringify(frame.diagnostics))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.materialQueueRouteReport",
          report: expect.objectContaining({
            valid: false,
            queueItemCount: 2,
            routedItemCount: 1,
            skippedItemCount: 1,
            byFamily: expect.arrayContaining([
              expect.objectContaining({
                key: "standard",
                queuedCount: 1,
                routedCount: 0,
                skippedCount: 1,
              }),
            ]),
            diagnosticSummary: expect.objectContaining({
              total: 1,
              byCode: expect.objectContaining({
                "webGpuApp.materialQueueAssetMismatch": 1,
              }),
            }),
            diagnostics: [
              expect.objectContaining({
                code: "webGpuApp.materialQueueAssetMismatch",
                materialFamily: "standard",
                materialKind: "unlit",
              }),
            ],
          }),
        }),
      ]),
    );
    expect(JSON.stringify(frame.diagnostics)).not.toContain("sourceAsset");
    expect(JSON.stringify(frame.diagnostics)).not.toContain("gpu-resource");
    expect(events).not.toContain("queue:submit:1");
  });

  it("resets material queue route report shell state across failed frames", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "RouteShellReuseCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Route Shell Supported Unlit" }),
    );
    const debugNormalMaterial = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({ label: "Route Shell Debug Normal" }),
    );
    const additiveStandard = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Route Shell Additive Standard",
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "additive" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(debugNormalMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(additiveStandard),
      withRenderLayer(1),
      withVisibility(true),
    );

    app.step(1 / 60, 1);
    const snapshot = app.extract(47);
    const unregisteredDraw = drawForMaterial(snapshot, unlitMaterial);
    const unregisteredPipelineKey = "toon-shaded|opaque|back|less|none";
    const firstFrame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 47, [
        {
          ...unregisteredDraw,
          sortKey: {
            ...unregisteredDraw.sortKey,
            pipelineKey: unregisteredPipelineKey,
          },
          batchKey: {
            ...unregisteredDraw.batchKey,
            pipelineKey: unregisteredPipelineKey,
          },
        },
      ]),
    });
    const secondFrame = await app.render({
      snapshot: renderSnapshotWithDraws(snapshot, 48, [
        drawForMaterial(snapshot, additiveStandard),
      ]),
    });

    expect(firstFrame.ok).toBe(false);
    expect(secondFrame.ok).toBe(false);

    const firstReport = materialQueueRouteReport(firstFrame);
    const secondReport = materialQueueRouteReport(secondFrame);

    expect(firstReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "toon-shaded",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      byPhase: [
        { key: "opaque", queuedCount: 1, routedCount: 0, skippedCount: 1 },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueFamily": 1 },
      }),
    });
    expect(secondReport).toMatchObject({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "standard",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      byPhase: [
        {
          key: "transparent",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      diagnosticSummary: expect.objectContaining({
        total: 1,
        byCode: { "webGpuApp.unsupportedMaterialQueueBlendPreset": 1 },
      }),
    });
    expect(JSON.stringify(secondReport)).not.toContain("debug-normal");
    expect(JSON.stringify(secondReport)).not.toContain("unlit");
    expect(JSON.stringify(secondReport)).not.toContain("toon-shaded");
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks three-family app rendering when StandardMaterial lights are missing", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "ThreeFamilyBlockedCube" }),
    );
    const unlitMaterial = assets.materials.unlit.add(
      createUnlitMaterialAsset({ label: "Three Family Ready Unlit" }),
    );
    const standardMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Three Family No Lights" }),
    );
    const texture = createTextureHandle("three-family-ready-matcap");
    const sampler = createSamplerHandle("three-family-ready-matcap-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "ThreeFamilyReadyMatcap",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "linear",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48,
            72, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(sampler, createSamplerAsset());

    const matcapMaterial = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Three Family Ready Matcap",
        matcapTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(unlitMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(standardMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(mesh),
      withMaterial(matcapMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 40);
    const diagnosticCodes = frame.diagnostics.map((diagnostic) =>
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      "code" in diagnostic
        ? diagnostic.code
        : null,
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 3,
      drawCalls: 0,
    });
    expect(diagnosticCodes).toContain("standardFrameResources.missingLights");
    expect(frame.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "webGpuApp.frameResourceRoute",
          route: expect.objectContaining({
            valid: false,
            status: "failed",
            family: "standard",
            facadeMeshResourceKey: expect.any(String),
            facadeMaterialResourceKey: expect.any(String),
            backendMeshKey: expect.stringContaining("@"),
            backendMaterialKey: expect.stringContaining("@"),
            diagnostics: expect.arrayContaining([
              expect.objectContaining({
                code: "standardFrameResources.missingLights",
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(JSON.stringify(frame.diagnostics)).not.toContain("GPUBuffer");
    expect(JSON.stringify(frame.diagnostics)).not.toContain("GPUBindGroup");
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders the standard material queue path with extracted lights", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(createBoxMeshAsset({ label: "Cube" }));
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Lit",
        metallicFactor: 0.1,
        roughnessFactor: 0.5,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 12);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.lights.map((light) => light.kind)).toEqual([
      "ambient",
      "directional",
    ]);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|opaque|back|less|none",
    );
    expect(frame.counts).toMatchObject({
      views: 1,
      meshDraws: 1,
      drawPackages: 1,
      drawCalls: 1,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
      dynamicBufferWrites: 0,
    });
    expect(queuedFamilyResourceCount(frame.resources?.resources, "unlit")).toBe(
      0,
    );
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "matcap"),
    ).toBe(0);
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(1);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    const value = webGpuAppRenderReportToJsonValue(frame);
    const json = webGpuAppRenderReportToJson(frame);

    expect(value).toMatchObject({
      ok: true,
      frame: 12,
      counts: {
        views: 1,
        meshDraws: 1,
        drawCalls: 1,
        diagnostics: 0,
      },
      diagnostics: [],
      diagnosticsSummary: {
        sectionCount: 4,
        materialQueue: {
          itemCount: 1,
          byPhase: [{ phase: "opaque", itemCount: 1 }],
          byFamily: [{ family: "standard", itemCount: 1 }],
          byPhaseAndFamily: [
            { phase: "opaque", family: "standard", itemCount: 1 },
          ],
        },
        routedResourceSet: {
          itemCount: 1,
          byFamily: [{ family: "standard", itemCount: 1 }],
          byPipeline: [
            { pipelineKey: "standard|opaque|back|less|none", itemCount: 1 },
          ],
          byFamilyAndPipeline: [
            {
              family: "standard",
              pipelineKey: "standard|opaque|back|less|none",
              itemCount: 1,
            },
          ],
        },
        directLighting: {
          ready: true,
          lightCounts: {
            total: 2,
            direct: 1,
            ambient: 1,
            directional: 1,
            point: 0,
            spot: 0,
            environment: 0,
          },
          sections: {
            lightGpuBuffers: true,
            lightBindGroupLayout: true,
            lightBindGroup: true,
            shaderMetadata: true,
          },
          resources: {
            lightGpuBufferResourceKey: "light-buffer:main",
            lightBindGroupLayoutKey: "webgpu-app/standard/group-3",
            lightBindGroupResourceKey:
              "bind-group:lights/group-3/light-buffer:main",
          },
          shaderMetadata: {
            valid: true,
            diagnostics: [],
          },
          diagnostics: [],
        },
      },
      resourceReuse: {
        pipelineMisses: 1,
        meshBuffersCreated: 1,
        preparedMeshBuffersCreated: 1,
        materialBuffersCreated: 1,
        preparedMaterialCache: {
          totalEntries: 1,
          families: {
            unlit: { entries: 0 },
            matcap: { entries: 0 },
            standard: { entries: 1 },
          },
        },
        lightBuffersCreated: 1,
      },
    });
    expect(value).not.toHaveProperty("materialDependencyReadiness");
    expect(json).toBe(JSON.stringify(value));
    expect(json).not.toContain("snapshot");
    expect(json).not.toContain("commandBuffer");
    expect(json).not.toContain("descriptor");
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const firstEventCount = events.length;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 13);
    const secondEvents = events.slice(firstEventCount);
    const firstResources = frame.resources?.resources;
    const secondResources = secondFrame.resources?.resources;
    const firstStandardResources =
      queuedMaterialResources(firstResources, "standard")[0] ?? firstResources;
    const secondStandardResources =
      queuedMaterialResources(secondResources, "standard")[0] ??
      secondResources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersReused: 0,
      materialBuffersReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expect(secondResources?.mesh).toBe(firstResources?.mesh);
    expect(singleMaterialResource(secondResources)).toBe(
      singleMaterialResource(firstResources),
    );
    expect(secondResources?.viewUniform.buffer).toBe(
      firstResources?.viewUniform.buffer,
    );
    expect(secondResources?.worldTransforms.buffer).toBe(
      firstResources?.worldTransforms.buffer,
    );
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);

    if (
      hasStandardLightResources(firstStandardResources) &&
      hasStandardLightResources(secondStandardResources)
    ) {
      expect(secondStandardResources.materialBindGroup).toBe(
        firstStandardResources.materialBindGroup,
      );
      expect(secondStandardResources.lightBindGroup).toBe(
        firstStandardResources.lightBindGroup,
      );
      expect(secondStandardResources.lightGpuBuffers.resource).toBe(
        firstStandardResources.lightGpuBuffers.resource,
      );
    } else {
      expect.unreachable("Expected standard frame resources.");
    }

    expect(secondEvents).toContain("queue:submit:1");
    expect(secondEvents.some((event) => event.startsWith("pass:draw"))).toBe(
      true,
    );
    expect(secondEvents).toContain("queue:writeBuffer:WorldTransforms/storage");
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
  });

  it("reuses prepared StandardMaterial mesh buffers across frame-resource misses", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedStandardCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "PreparedStandardCubeSecond" }),
    );
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Prepared Standard A" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 70);

    app.spawn(
      withTransform({ translation: [0.8, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const secondFrame = await app.stepAndRender(1 / 60, 2, 71);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      lightBuffersCreated: 1,
    });
    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(secondFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
    });
  });

  it("reports scalar StandardMaterial prepared material source-version invalidation", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "VersionedStandardCube" }),
    );
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Versioned Standard A" }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    const standardEntity = app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    const ambientLight = app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.2,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.5,
        layerMask: 1,
      }),
    );

    const firstFrame = await app.stepAndRender(1 / 60, 1, 72);

    assets.materials.standard.markReady(
      material,
      createStandardMaterialAsset({ label: "Versioned Standard B" }),
    );

    const materialVersionFrame = await app.stepAndRender(1 / 60, 2, 73);

    standardEntity
      .getVectorView(LocalTransform, "translation")
      .set([0.25, 0, 0]);
    ambientLight.setValue(Light, "intensity", 0.35);

    const cacheHitFrame = await app.stepAndRender(1 / 60, 3, 74);

    expect(firstFrame.ok).toBe(true);
    expect(firstFrame.resourceReuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialCacheSummary(firstFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialFacadeSummary(firstFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(materialVersionFrame.ok).toBe(true);
    expect(materialVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 1,
      materialBuffersReused: 0,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 4,
      bindGroupsReused: 0,
      lightBuffersCreated: 1,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialCacheSummary(materialVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(materialVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(cacheHitFrame.ok).toBe(true);
    expect(cacheHitFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      meshBuffersCreated: 0,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 0,
      materialBuffersCreated: 0,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 0,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 0,
      bindGroupsCreated: 0,
      bindGroupsReused: 4,
      lightBuffersCreated: 0,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expectPreparedMaterialCacheSummary(cacheHitFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMaterialFacadeSummary(cacheHitFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(
      webGpuAppRenderReportToJsonValue(materialVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
    });
    expect(JSON.stringify(cacheHitFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders mixed opaque and alpha-test StandardMaterial queue items", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "AlphaTestStandardCube" }),
    );
    const opaqueMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Opaque Standard",
        baseColorFactor: new Float32Array([0.2, 0.6, 1, 1]),
      }),
    );
    const alphaTestMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Alpha Test Standard",
        baseColorFactor: new Float32Array([1, 0.4, 0.1, 0.4]),
        renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.5, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.25,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 52);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => ({
        queue: draw.sortKey.queue,
        pipelineKey: draw.batchKey.pipelineKey,
      })),
    ).toEqual([
      { queue: "opaque", pipelineKey: "standard|opaque|back|less|none" },
      { queue: "alpha-test", pipelineKey: "standard|mask|back|less|none" },
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawPackages: 2,
      drawCalls: 2,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 2,
      materialBuffersCreated: 2,
      bindGroupsCreated: 8,
      lightBuffersCreated: 2,
    });
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(2);
    expect(queuedMeshResourceCount(frame.resources?.resources)).toBe(1);
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 3)).toEqual([
      expect.stringContaining(
        "|pipeline:standard|opaque|back|less|none",
      ) as string,
      expect.stringContaining(
        "|pipeline:standard|mask|back|less|none",
      ) as string,
    ]);
    expect(events).toContain("queue:submit:1");

    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 53);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(2);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
    });
    expect(queuedMaterialResources(secondResources, "standard").length).toBe(2);
    expect(
      queuedMaterialResources(secondResources, "standard")[0]?.material,
    ).toBe(queuedMaterialResources(firstResources, "standard")[0]?.material);
    expect(
      queuedMaterialResources(secondResources, "standard")[1]?.material,
    ).toBe(queuedMaterialResources(firstResources, "standard")[1]?.material);
  });

  it("renders transparent StandardMaterial alpha-blend queue items after opaque phases", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 10 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TransparentStandardCube" }),
    );
    const opaqueMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Transparent Route Opaque" }),
    );
    const alphaTestMaterial = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route Mask",
        baseColorFactor: new Float32Array([1, 1, 1, 0.4]),
        renderState: { alphaMode: "mask", alphaCutoff: 0.5 },
      }),
    );
    const transparentA = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route A",
        baseColorFactor: new Float32Array([0.1, 0.6, 1, 0.35]),
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );
    const transparentB = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Transparent Route B",
        baseColorFactor: new Float32Array([1, 0.2, 0.1, 0.45]),
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform({ translation: [-0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(opaqueMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [-0.25, 0, 0] }),
      withMesh(mesh),
      withMaterial(alphaTestMaterial),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.25, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentA),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withTransform({ translation: [0.75, 0, 0] }),
      withMesh(mesh),
      withMaterial(transparentB),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.25,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 54);

    expect(frame.ok).toBe(true);
    expect(
      frame.snapshot.meshDraws.map((draw) => ({
        queue: draw.sortKey.queue,
        materialKey: draw.batchKey.materialKey,
        pipelineKey: draw.batchKey.pipelineKey,
      })),
    ).toEqual([
      {
        queue: "opaque",
        materialKey: assetHandleKey(opaqueMaterial),
        pipelineKey: "standard|opaque|back|less|none",
      },
      {
        queue: "alpha-test",
        materialKey: assetHandleKey(alphaTestMaterial),
        pipelineKey: "standard|mask|back|less|none",
      },
      {
        queue: "transparent",
        materialKey: assetHandleKey(transparentA),
        pipelineKey: "standard|blend|back|less|alpha",
      },
      {
        queue: "transparent",
        materialKey: assetHandleKey(transparentB),
        pipelineKey: "standard|blend|back|less|alpha",
      },
    ]);
    expect(frame.counts).toMatchObject({
      meshDraws: 4,
      drawPackages: 4,
      drawCalls: 4,
      diagnostics: 0,
    });
    expect(
      queuedFamilyResourceCount(frame.resources?.resources, "standard"),
    ).toBe(4);
    expect(queuedBindGroupResourceKeys(frame.resources?.resources, 3)).toEqual([
      expect.stringContaining(
        "|pipeline:standard|opaque|back|less|none",
      ) as string,
      expect.stringContaining(
        "|pipeline:standard|mask|back|less|none",
      ) as string,
      expect.stringContaining(
        "|pipeline:standard|blend|back|less|alpha",
      ) as string,
      expect.stringContaining(
        "|pipeline:standard|blend|back|less|alpha",
      ) as string,
    ]);
    expect(events).toContain("queue:submit:1");

    const secondFrame = await app.stepAndRender(1 / 60, 2, 55);

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(4);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 4,
      pipelineMisses: 0,
    });
  });

  it("renders and reuses StandardMaterial base-color texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedStandardCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "TexturedStandardCubeSecond" }),
    );
    const texture = createTextureHandle("standard-base-color");
    const sampler = createSamplerHandle("standard-base-color-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 64, 64, 255, 64, 255, 64, 255, 64, 64, 255, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardBaseColorSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Textured Standard",
        baseColorTexture: {
          texture,
          sampler,
          transform: {
            offset: [0.125, 0.25],
            rotation: Math.PI / 6,
            scale: [0.75, 1.25],
          },
        },
        metallicFactor: 0,
        roughnessFactor: 0.6,
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 44);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|baseColorTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expectPreparedMaterialFacadeSummary(frame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(frame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-base-color-textured:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardBaseColor");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:StandardBaseColorSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });
    expect(
      webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
    ).toMatchObject({
      sectionCount: 4,
      routedResourceSet: {
        itemCount: 1,
        byFamily: [{ family: "standard", itemCount: 1 }],
        byPipeline: [
          {
            pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
      directLighting: {
        ready: true,
        resources: {
          lightGpuBufferResourceKey: "light-buffer:main",
          lightBindGroupLayoutKey: "webgpu-app/standard/group-3",
          lightBindGroupResourceKey:
            "bind-group:lights/group-3/light-buffer:main",
        },
      },
    });
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toContain("GPU");
    expect(
      JSON.stringify(
        webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary,
      ),
    ).not.toContain("descriptor");

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 45);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expectPreparedMaterialFacadeSummary(secondFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(secondFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 46);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(thirdFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(thirdFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse
        .preparedMeshCache.totalEntries,
    ).toBeGreaterThan(0);
    expectTextureSamplerCacheSummary(thirdFrame, {
      textureEntries: 1,
      samplerEntries: 1,
    });
    expectRetainedBackendCacheSummariesAreJsonSafe(thirdFrame, [
      "TexturedStandardCube",
      "Textured Standard",
      "StandardBaseColor",
      "StandardBaseColorSampler",
    ]);
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardBaseColorV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            64, 64, 255, 255, 255, 64, 64, 255, 64, 255, 64, 255, 255, 255, 64,
            255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 47);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(textureVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(textureVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 2,
    });
    expectPreparedMeshFacadeSummary(textureVersionFrame, { totalEntries: 2 });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardBaseColorSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 48);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expectPreparedMaterialFacadeSummary(samplerVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 1,
    });
    expectPreparedMaterialCacheSummary(samplerVersionFrame, {
      unlit: 0,
      matcap: 0,
      standard: 3,
    });
    expectPreparedMeshFacadeSummary(samplerVersionFrame, { totalEntries: 2 });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
  });

  it("renders and reuses StandardMaterial metallic-roughness texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MetallicRoughnessCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "MetallicRoughnessCubeSecond" }),
    );
    const texture = createTextureHandle("standard-metallic-roughness");
    const sampler = createSamplerHandle("standard-metallic-roughness-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMetallicRoughness",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "metallic-roughness",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            0, 32, 255, 255, 0, 224, 64, 255, 0, 96, 192, 255, 0, 180, 128, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMetallicRoughnessSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Metallic Roughness Standard",
        baseColorFactor: new Float32Array([0.92, 0.78, 0.52, 1]),
        metallicFactor: 0.8,
        roughnessFactor: 0.7,
        metallicRoughnessTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 46);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|metallicRoughnessTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-metallic-roughness-textured:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardMetallicRoughness");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:StandardMetallicRoughnessSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 47);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 48);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardMetallicRoughnessV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "metallic-roughness",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            0, 220, 48, 255, 0, 144, 180, 255, 0, 72, 224, 255, 0, 200, 96, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 49);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardMetallicRoughnessSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 50);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders and reuses StandardMaterial emissive and occlusion texture resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "EmissiveOcclusionCube" }),
    );
    const secondMesh = assets.meshes.add(
      createBoxMeshAsset({ label: "EmissiveOcclusionCubeSecond" }),
    );
    const occlusionTexture = createTextureHandle("standard-occlusion");
    const occlusionSampler = createSamplerHandle("standard-occlusion-sampler");
    const emissiveTexture = createTextureHandle("standard-emissive");
    const emissiveSampler = createSamplerHandle("standard-emissive-sampler");

    app.assets.register(occlusionTexture);
    app.assets.markReady(
      occlusionTexture,
      createTextureAsset({
        label: "StandardOcclusion",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "occlusion",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            255, 0, 0, 255, 160, 0, 0, 255, 192, 0, 0, 255, 96, 0, 0, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(occlusionSampler);
    app.assets.markReady(
      occlusionSampler,
      createSamplerAsset({ label: "StandardOcclusionSampler" }),
    );
    app.assets.register(emissiveTexture);
    app.assets.markReady(
      emissiveTexture,
      createTextureAsset({
        label: "StandardEmissive",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "emissive",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            64, 255, 128, 255, 32, 128, 255, 255, 160, 255, 96, 255, 96, 160,
            255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(emissiveSampler);
    app.assets.markReady(
      emissiveSampler,
      createSamplerAsset({ label: "StandardEmissiveSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Emissive Occlusion Standard",
        baseColorFactor: new Float32Array([0.45, 0.75, 0.62, 1]),
        occlusionStrength: 0.6,
        emissiveFactor: [0.2, 0.25, 0.18],
        occlusionTexture: {
          texture: occlusionTexture,
          sampler: occlusionSampler,
        },
        emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 48);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey.pipelineKey).toBe(
      "standard|emissiveTexture|occlusionTexture|opaque|back|less|none",
    );
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 2,
      samplerResourcesCreated: 2,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-occlusion-emissive-textured:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardOcclusion");
    expect(events).toContain("device:texture:StandardEmissive");
    expect(events).toContain("device:sampler:StandardOcclusionSampler");
    expect(events).toContain("device:sampler:StandardEmissiveSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(occlusionTexture),
        assetHandleKey(occlusionSampler),
        assetHandleKey(emissiveTexture),
        assetHandleKey(emissiveSampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 49);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 50);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 4,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 4,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 4,
      samplerResourcesReused: 4,
    });

    app.assets.markReady(
      occlusionTexture,
      createTextureAsset({
        label: "StandardOcclusionV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "occlusion",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 0, 0, 255, 224, 0, 0, 255, 96, 0, 0, 255, 192, 0, 0, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 51);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 3,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 4,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });

    app.assets.markReady(
      emissiveSampler,
      createSamplerAsset({ label: "StandardEmissiveSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 52);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 4,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 3,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("renders and reuses StandardMaterial tangent-space normal-map resources", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createTangentBoxMeshAsset({ label: "NormalMappedCube" }),
    );
    const secondMesh = assets.meshes.add(
      createTangentBoxMeshAsset({ label: "NormalMappedCubeSecond" }),
    );
    const texture = createTextureHandle("standard-normal");
    const sampler = createSamplerHandle("standard-normal-sampler");

    app.assets.register(texture);
    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardNormal",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "normal",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255, 128,
            128, 255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
    app.assets.register(sampler);
    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardNormalSampler" }),
    );

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Normal Mapped Standard",
        normalScale: 0.75,
        normalTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );
    app.spawn(
      withLight({
        kind: LightKind.Ambient,
        intensity: 0.35,
        layerMask: 1,
      }),
    );
    app.spawn(
      withTransform(),
      withLight({
        kind: LightKind.Directional,
        intensity: 1.25,
        layerMask: 1,
      }),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 50);

    expect(frame.ok).toBe(true);
    expect(frame.snapshot.meshDraws[0]?.batchKey).toMatchObject({
      pipelineKey: "standard|normalTexture|opaque|back|less|none",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,TANGENT",
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineHits: 0,
      pipelineMisses: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
    });
    expect(events).toContain(
      "device:pipeline:aperture/standard-mesh-normal-map-textured:bgra8unorm:triangle-list",
    );
    expect(events).toContain("device:texture:StandardNormal");
    expect(events).toContain("device:sampler:StandardNormalSampler");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        `material-buffer:prepared-material:${assetHandleKey(material)}`,
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResources = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 51);
    const secondResources = secondFrame.resources?.resources;

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
      materialBuffersReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 1,
      bindGroupsReused: 4,
      lightBuffersReused: 1,
      dynamicBufferWrites: 4,
    });
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);

    app.spawn(
      withTransform({ translation: [0.65, 0, 0] }),
      withMesh(secondMesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const thirdFrame = await app.stepAndRender(1 / 60, 3, 52);

    expect(thirdFrame.ok).toBe(true);
    expect(thirdFrame.counts.drawCalls).toBe(2);
    expect(thirdFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      pipelineMisses: 0,
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      preparedMeshBuffersReused: 1,
      materialBuffersCreated: 0,
      materialBuffersReused: 2,
      preparedMaterialBuffersCreated: 0,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsCreated: 0,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 6,
      bindGroupsReused: 2,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(thirdFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 1,
      preparedMaterialBuffersReused: 2,
      preparedMaterialBindGroupsReused: 2,
      textureResourcesReused: 2,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      texture,
      createTextureAsset({
        label: "StandardNormalV2",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "normal",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([
            128, 128, 255, 255, 96, 128, 255, 255, 160, 128, 255, 255, 128, 160,
            255, 255,
          ]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );

    const textureVersionFrame = await app.stepAndRender(1 / 60, 4, 53);

    expect(textureVersionFrame.ok).toBe(true);
    expect(textureVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 1,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 2,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(textureVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMeshBuffersReused: 2,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesCreated: 1,
      samplerResourcesReused: 2,
    });

    app.assets.markReady(
      sampler,
      createSamplerAsset({ label: "StandardNormalSamplerV2" }),
    );

    const samplerVersionFrame = await app.stepAndRender(1 / 60, 5, 54);

    expect(samplerVersionFrame.ok).toBe(true);
    expect(samplerVersionFrame.resourceReuse).toMatchObject({
      pipelineHits: 2,
      meshBuffersCreated: 0,
      meshBuffersReused: 2,
      preparedMeshBuffersCreated: 0,
      preparedMeshBuffersReused: 2,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      textureResourcesCreated: 0,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 1,
      bindGroupsCreated: 7,
      bindGroupsReused: 1,
      lightBuffersCreated: 2,
      dynamicBufferWrites: 0,
    });
    expect(
      webGpuAppRenderReportToJsonValue(samplerVersionFrame).resourceReuse,
    ).toMatchObject({
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      textureResourcesReused: 2,
      samplerResourcesCreated: 1,
    });
    expect(JSON.stringify(samplerVersionFrame.resourceReuse)).not.toContain(
      "descriptor",
    );
  });

  it("blocks StandardMaterial metallic-roughness rendering when texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedMetallicRoughnessCube" }),
    );
    const texture = createTextureHandle("missing-standard-mr");
    const sampler = createSamplerHandle("loading-standard-mr");

    app.assets.register(sampler);
    app.assets.markLoading(sampler);

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Metallic Roughness Standard",
        metallicRoughnessTexture: { texture, sampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 48);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "standard",
        slots: [
          {
            field: "metallicRoughnessTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(texture),
            status: "missing",
          },
          {
            field: "metallicRoughnessTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(sampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });

  it("blocks StandardMaterial emissive and occlusion rendering when texture dependencies are not ready", async () => {
    const events: string[] = [];
    const { canvas, environment } = webGpuHarness(events);
    const created = await createWebGpuApp({
      canvas,
      environment,
      worldOptions: { entityCapacity: 8 },
    });

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const app = created.app;
    const assets = createRenderAssetCollections({ registry: app.assets });
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "BlockedEmissiveOcclusionCube" }),
    );
    const occlusionTexture = createTextureHandle("missing-standard-occlusion");
    const occlusionSampler = createSamplerHandle("loading-standard-occlusion");
    const emissiveTexture = createTextureHandle("missing-standard-emissive");
    const emissiveSampler = createSamplerHandle("loading-standard-emissive");

    app.assets.register(occlusionSampler);
    app.assets.markLoading(occlusionSampler);
    app.assets.register(emissiveSampler);
    app.assets.markLoading(emissiveSampler);

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Blocked Emissive Occlusion Standard",
        occlusionTexture: {
          texture: occlusionTexture,
          sampler: occlusionSampler,
        },
        emissiveTexture: { texture: emissiveTexture, sampler: emissiveSampler },
      }),
    );

    app.spawn(
      withTransform({ translation: [0, 0, 5] }),
      withCamera({ priority: 0, layerMask: 1 }),
    );
    app.spawn(
      withTransform(),
      withMesh(mesh),
      withMaterial(material),
      withRenderLayer(1),
      withVisibility(true),
    );

    const frame = await app.stepAndRender(1 / 60, 1, 50);
    const appDiagnostic = frame.diagnostics.find(
      (diagnostic) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "code" in diagnostic &&
        diagnostic.code === "webGpuApp.materialDependenciesNotReady",
    );

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 0,
      drawCalls: 0,
    });
    expect(appDiagnostic).toMatchObject({
      code: "webGpuApp.materialDependenciesNotReady",
      materialDependencyReadiness: {
        ready: false,
        materialKey: assetHandleKey(material),
        materialKind: "standard",
        slots: [
          {
            field: "occlusionTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(occlusionTexture),
            status: "missing",
          },
          {
            field: "occlusionTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(occlusionSampler),
            status: "loading",
          },
          {
            field: "emissiveTexture",
            dependencyKind: "texture",
            handleKey: assetHandleKey(emissiveTexture),
            status: "missing",
          },
          {
            field: "emissiveTexture",
            dependencyKind: "sampler",
            handleKey: assetHandleKey(emissiveSampler),
            status: "loading",
          },
        ],
      },
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
  });
});

function webGpuHarness(events: string[]) {
  const device = {
    queue: {
      writeBuffer: (buffer: unknown) => {
        events.push(`queue:writeBuffer:${bufferLabel(buffer)}`);
      },
      writeTexture: (
        destination: unknown,
        data: Uint8Array,
        layout: unknown,
        size: unknown,
      ) => {
        void destination;
        void layout;
        void size;
        events.push(`queue:writeTexture:${data.byteLength}`);
      },
      submit: (buffers: readonly unknown[]) => {
        events.push(`queue:submit:${buffers.length}`);
      },
      onSubmittedWorkDone: async () => {
        events.push("queue:done");
      },
    },
    lost: new Promise<never>(() => {}),
    createShaderModule: (descriptor: unknown) => {
      events.push("device:shader");
      return { descriptor, compilationInfo: async () => ({ messages: [] }) };
    },
    createRenderPipeline: (descriptor: { readonly label?: string }) => {
      events.push(`device:pipeline:${descriptor.label ?? "unlabeled"}`);
      return {
        descriptor,
        getBindGroupLayout: (group: number) => ({ group }),
      };
    },
    createBuffer: (descriptor: { readonly label?: string }) => {
      events.push(`device:buffer:${descriptor.label ?? "unlabeled"}`);
      return { descriptor };
    },
    createTexture: (descriptor: { readonly label?: string }) => {
      const label = descriptor.label ?? "unlabeled";

      events.push(`device:texture:${label}`);
      return {
        descriptor,
        createView: () => {
          events.push(`textureResource:view:${label}`);
          return { descriptor, label: `view:${label}` };
        },
      };
    },
    createSampler: (descriptor: { readonly label?: string }) => {
      events.push(`device:sampler:${descriptor.label ?? "unlabeled"}`);
      return { descriptor };
    },
    createBindGroup: (descriptor: { readonly label?: string }) => {
      events.push(`device:bindGroup:${descriptor.label ?? "unlabeled"}`);
      return { descriptor };
    },
    createCommandEncoder: () => {
      events.push("device:encoder");
      return {
        beginRenderPass: () => {
          events.push("encoder:begin");
          return {
            setPipeline: () => events.push("pass:pipeline"),
            setBindGroup: (group: number) => events.push(`pass:bind:${group}`),
            setVertexBuffer: (slot: number) =>
              events.push(`pass:vertex:${slot}`),
            setIndexBuffer: () => events.push("pass:index"),
            draw: (vertexCount: number) =>
              events.push(`pass:draw:${vertexCount}`),
            drawIndexed: (indexCount: number) =>
              events.push(`pass:drawIndexed:${indexCount}`),
            end: () => events.push("pass:end"),
          };
        },
        finish: () => {
          events.push("encoder:finish");
          return { commandBuffer: true };
        },
      };
    },
  };
  const context = {
    configure: (configuration: { readonly format: string }) =>
      events.push(`context:configure:${configuration.format}`),
    getCurrentTexture: () => ({
      createView: () => {
        events.push("texture:view");
        return { view: true };
      },
    }),
  };
  const canvas = {
    getContext: (contextId: "webgpu") => {
      events.push(`canvas:context:${contextId}`);
      return context;
    },
  };
  const environment = {
    navigator: {
      gpu: {
        requestAdapter: async () => ({
          requestDevice: async () => device,
        }),
        getPreferredCanvasFormat: () => "bgra8unorm",
      },
    },
  };

  return { canvas, environment };
}

function bufferLabel(buffer: unknown): string {
  return (
    (buffer as { readonly descriptor?: { readonly label?: string } }).descriptor
      ?.label ?? "unlabeled"
  );
}

function createTangentBoxMeshAsset(options: {
  readonly label: string;
}): MeshAsset {
  const mesh = createBoxMeshAsset(options);
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error("Expected box mesh fixture to provide one vertex stream.");
  }

  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const targetStrideFloats = 12;
  const data = new Float32Array(stream.vertexCount * targetStrideFloats);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * sourceStrideFloats;
    const targetOffset = vertex * targetStrideFloats;

    data.set(source.subarray(sourceOffset, sourceOffset + 8), targetOffset);
    data.set([1, 0, 0, 1], targetOffset + 8);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "primitive-interleaved-tangent",
        arrayStride: targetStrideFloats * 4,
        attributes: [
          ...stream.attributes,
          { semantic: "TANGENT", format: "float32x4", offset: 32 },
        ],
        data,
      },
    ],
  };
}

function resourceEventCounts(events: readonly string[]) {
  return {
    pipelines: countEvents(events, "device:pipeline:"),
    buffers: countEvents(events, "device:buffer:"),
    textures: countEvents(events, "device:texture:"),
    textureViews: countEvents(events, "textureResource:view:"),
    samplers: countEvents(events, "device:sampler:"),
    bindGroups: countEvents(events, "device:bindGroup:"),
  };
}

function countEvents(events: readonly string[], prefix: string): number {
  return events.filter((event) => event.startsWith(prefix)).length;
}

function expectNoMaterialQueueRouteReport(report: {
  readonly diagnostics: readonly unknown[];
}): void {
  expect(report.diagnostics).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "webGpuApp.materialQueueRouteReport",
      }),
    ]),
  );
}

function expectNoFrameResourceRouteDiagnostic(report: {
  readonly diagnostics: readonly unknown[];
}): void {
  expect(report.diagnostics).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "webGpuApp.frameResourceRoute",
      }),
    ]),
  );
}

function materialQueueRouteReport(report: {
  readonly diagnostics: readonly unknown[];
}) {
  const diagnostic = report.diagnostics.find(
    (
      entry,
    ): entry is {
      readonly code: "webGpuApp.materialQueueRouteReport";
      readonly report: unknown;
    } =>
      typeof entry === "object" &&
      entry !== null &&
      "code" in entry &&
      entry.code === "webGpuApp.materialQueueRouteReport" &&
      "report" in entry,
  );

  if (diagnostic === undefined) {
    throw new Error("Expected a material queue route report diagnostic.");
  }

  return diagnostic.report;
}

function renderSnapshotWithDraws(
  snapshot: RenderSnapshot,
  frame: number,
  meshDraws: readonly MeshDrawPacket[],
): RenderSnapshot {
  return {
    ...snapshot,
    frame,
    meshDraws,
    report: {
      ...snapshot.report,
      meshDraws: meshDraws.length,
    },
  };
}

function drawForMaterial(
  snapshot: RenderSnapshot,
  material: RenderSnapshot["meshDraws"][number]["material"],
): MeshDrawPacket {
  const materialKey = assetHandleKey(material);
  const draw = snapshot.meshDraws.find(
    (candidate) => assetHandleKey(candidate.material) === materialKey,
  );

  if (draw === undefined) {
    throw new Error(`Expected snapshot draw for material '${materialKey}'.`);
  }

  return draw;
}

function singleMaterialResource(resources: unknown): unknown {
  if (typeof resources !== "object" || resources === null) {
    return undefined;
  }

  if ("material" in resources) {
    return (resources as { readonly material: unknown }).material;
  }

  for (const family of [
    "unlit",
    "matcap",
    "standard",
    "debug-normal",
  ] as const) {
    const resource = queuedMaterialResources(resources, family)[0];

    if (resource !== undefined) {
      return resource.material;
    }
  }

  return undefined;
}

function expectPreparedMaterialCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly unlit: number;
    readonly matcap: number;
    readonly standard: number;
    readonly debugNormal?: number;
  },
): void {
  const debugNormal = expected.debugNormal ?? 0;

  expect(webGpuAppRenderReportToJsonValue(report).resourceReuse).toMatchObject({
    preparedMaterialCache: {
      totalEntries:
        expected.unlit + expected.matcap + expected.standard + debugNormal,
      families: {
        unlit: { entries: expected.unlit },
        matcap: { entries: expected.matcap },
        standard: { entries: expected.standard },
        "debug-normal": { entries: debugNormal },
      },
    },
  });
}

function expectTextureSamplerCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly textureEntries: number;
    readonly samplerEntries: number;
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.textureSamplerCache;

  expect(summary).toEqual({
    textureEntries: expected.textureEntries,
    samplerEntries: expected.samplerEntries,
    totalEntries: expected.textureEntries + expected.samplerEntries,
  });

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("descriptor");
  expect(json).not.toContain("VersionedUnlitAlbedo");
  expect(json).not.toContain("VersionedUnlitSampler");
}

function expectRetainedBackendCacheSummariesAreJsonSafe(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  absentMarkers: readonly string[],
): void {
  const resourceReuse = webGpuAppRenderReportToJsonValue(report).resourceReuse;
  const retainedBackendCaches = {
    preparedMeshCache: resourceReuse.preparedMeshCache,
    preparedMaterialCache: resourceReuse.preparedMaterialCache,
    textureSamplerCache: resourceReuse.textureSamplerCache,
  };
  const json = JSON.stringify(retainedBackendCaches);

  expect(retainedBackendCaches).toMatchObject({
    preparedMeshCache: { totalEntries: expect.any(Number) },
    preparedMaterialCache: { totalEntries: expect.any(Number) },
    textureSamplerCache: { totalEntries: expect.any(Number) },
  });
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("descriptor");

  for (const marker of absentMarkers) {
    expect(json).not.toContain(marker);
  }
}

function expectPreparedMeshCacheSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly totalEntries: number;
    readonly layoutEntryCounts: readonly number[];
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.preparedMeshCache;

  expect(summary.totalEntries).toBe(expected.totalEntries);
  expect(summary.layouts.map((layout) => layout.entries).sort()).toEqual(
    [...expected.layoutEntryCounts].sort(),
  );

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("FacadeRetainedCube");
  expect(json).not.toContain("FacadePrunedCube");
  expect(json).not.toContain("lastUsedFrame");
}

function expectPreparedMeshFacadeSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly totalEntries: number;
    readonly meshResourceKeys?: readonly string[];
  },
): void {
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse.preparedMeshFacade;

  expect(summary.totalEntries).toBe(expected.totalEntries);

  if (expected.meshResourceKeys !== undefined) {
    expect(
      summary.entries.map((entry) => entry.meshResourceKey).sort(),
    ).toEqual([...expected.meshResourceKeys].sort());
  }

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("Float32Array");
  expect(json).not.toContain("data");
}

function expectPreparedMaterialFacadeSummary(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  expected: {
    readonly unlit: number;
    readonly matcap: number;
    readonly standard: number;
    readonly debugNormal?: number;
  },
): void {
  const debugNormal = expected.debugNormal ?? 0;
  const summary =
    webGpuAppRenderReportToJsonValue(report).resourceReuse
      .preparedMaterialFacade;

  expect(summary).toMatchObject({
    totalEntries:
      expected.unlit + expected.matcap + expected.standard + debugNormal,
    families: {
      unlit: { entries: expected.unlit },
      matcap: { entries: expected.matcap },
      standard: { entries: expected.standard },
      "debug-normal": { entries: debugNormal },
    },
  });

  const json = JSON.stringify(summary);

  expect(json).not.toContain("Map");
  expect(json).not.toContain("GPU");
  expect(json).not.toContain("baseColorFactor");
}

function expectPreparedMaterialFacadeResourceKeys(
  report: Parameters<typeof webGpuAppRenderReportToJsonValue>[0],
  sourceMaterialKeys: readonly string[],
): void {
  const entries =
    webGpuAppRenderReportToJsonValue(report).resourceReuse
      .preparedMaterialFacade.entries;

  expect(entries.map((entry) => entry.materialResourceKey).sort()).toEqual(
    sourceMaterialKeys.map((key) => `prepared-material:${key}`).sort(),
  );
  expect(
    entries
      .map((entry) => entry.bindGroupResourceKey)
      .every((key) => key.startsWith("prepared-material-bind-group:")),
  ).toBe(true);
}

function queuedMeshResourceCount(resources: unknown): number {
  if (typeof resources !== "object" || resources === null) {
    return 0;
  }

  const meshResources = (resources as { readonly meshResources?: unknown })
    .meshResources;

  return Array.isArray(meshResources) ? meshResources.length : 0;
}

function queuedFamilyResourceCount(
  resources: unknown,
  family: "unlit" | "matcap" | "standard" | "debug-normal",
): number {
  return queuedMaterialResources(resources, family).length;
}

function queuedBindGroupResourceKeys(
  resources: unknown,
  group: number,
): readonly string[] {
  if (typeof resources !== "object" || resources === null) {
    return [];
  }

  const value = (resources as { readonly bindGroups?: unknown }).bindGroups;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((bindGroup) => {
    if (typeof bindGroup !== "object" || bindGroup === null) {
      return [];
    }

    const candidate = bindGroup as {
      readonly group?: unknown;
      readonly resourceKey?: unknown;
    };

    return candidate.group === group &&
      typeof candidate.resourceKey === "string"
      ? [candidate.resourceKey]
      : [];
  });
}

function queuedMaterialResources(
  resources: unknown,
  family: "unlit" | "matcap" | "standard" | "debug-normal",
): readonly {
  readonly material?: unknown;
  readonly bindGroups?: readonly { readonly group?: unknown }[];
}[] {
  if (typeof resources !== "object" || resources === null) {
    return [];
  }

  const resourceKey = family === "debug-normal" ? "debugNormal" : family;
  const value = (resources as Record<string, unknown>)[resourceKey];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      resource,
    ): resource is {
      readonly material?: unknown;
      readonly bindGroups?: readonly { readonly group?: unknown }[];
    } => typeof resource === "object" && resource !== null,
  );
}

function hasStandardLightResources(resource: unknown): resource is {
  readonly materialBindGroup: unknown;
  readonly lightBindGroup: unknown;
  readonly lightGpuBuffers: { readonly resource: unknown };
} {
  if (typeof resource !== "object" || resource === null) {
    return false;
  }

  const candidate = resource as {
    readonly materialBindGroup?: unknown;
    readonly lightBindGroup?: unknown;
    readonly lightGpuBuffers?: unknown;
  };

  return (
    candidate.materialBindGroup !== undefined &&
    candidate.lightBindGroup !== undefined &&
    typeof candidate.lightGpuBuffers === "object" &&
    candidate.lightGpuBuffers !== null &&
    "resource" in candidate.lightGpuBuffers
  );
}
