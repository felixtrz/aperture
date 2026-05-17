import { describe, expect, it } from "vitest";

import {
  assetHandleKey,
  createBoxMeshAsset,
  createMatcapMaterialAsset,
  createRenderAssetCollections,
  createSamplerHandle,
  createSamplerAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  createTextureHandle,
  createUnlitMaterialAsset,
  LightKind,
  withCamera,
  withLight,
  withMaterial,
  withMesh,
  withRenderLayer,
  withTransform,
  withVisibility,
} from "@aperture-engine/core";
import {
  createWebGpuApp,
  createWebGpuAppDrawResourceSetPlan,
  webGpuAppRenderReportToJson,
  webGpuAppRenderReportToJsonValue,
} from "@aperture-engine/webgpu";

describe("WebGPU app facade", () => {
  it("initializes WebGPU and renders the existing unlit path from ECS-authored entities", async () => {
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
      materialBuffersCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
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
      materialBuffersReused: 1,
      bindGroupsReused: 3,
      dynamicBufferWrites: 2,
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
  });

  it("renders same-resource multi-draw frames through the current app resource set", async () => {
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
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
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
      meshBuffersCreated: 2,
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

  it("prepares and reuses app-facade texture and sampler resources for textured unlit materials", async () => {
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
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
    });
    expect(events).toContain("device:texture:AppAlbedo");
    expect(events).toContain("textureResource:view:AppAlbedo");
    expect(events).toContain("device:sampler:AppLinear");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        "material-buffer:TexturedApp/uniform",
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

    const firstResourceEvents = resourceEventCounts(events);
    const firstResourceBindings = frame.resources?.resources;
    const secondFrame = await app.stepAndRender(1 / 60, 2, 25);
    const secondResourceBindings = secondFrame.resources?.resources;

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
      bindGroupsReused: 3,
      dynamicBufferWrites: 2,
    });
    expect(secondResourceBindings?.bindGroups).toBe(
      firstResourceBindings?.bindGroups,
    );
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
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

  it("renders and reuses the single-material matcap app path", async () => {
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
      materialBuffersCreated: 1,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 3,
      dynamicBufferWrites: 0,
    });
    expect(events).toContain("device:texture:StudioMatcap");
    expect(events).toContain("queue:writeTexture:16");
    expect(events).toContain("device:sampler:MatcapLinear");
    expect(events).toContain("pass:bind:2");
    expect(events).toContain("queue:submit:1");
    expect(
      frame.resources?.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      entryResourceKeys: [
        "material-buffer:Studio Matcap/uniform",
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
      materialBuffersReused: 1,
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
      meshDraws: 2,
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

  it("renders unlit, standard, and matcap app resource sets in one shared-mesh frame", async () => {
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

    const frame = await app.stepAndRender(1 / 60, 1, 38);

    expect(frame.ok).toBe(true);
    expect(frame.counts).toMatchObject({
      meshDraws: 3,
      drawPackages: 3,
      drawCalls: 3,
      diagnostics: 0,
    });
    expect(frame.resourceReuse).toMatchObject({
      pipelineMisses: 3,
      meshBuffersCreated: 3,
      materialBuffersCreated: 3,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 10,
      lightBuffersCreated: 1,
    });
    expect(events.filter((event) => event === "pass:pipeline")).toHaveLength(3);
    expect(events.filter((event) => event === "pass:bind:2")).toHaveLength(3);
    expect(events).toContain("pass:bind:3");
    expect(events).toContain("queue:submit:1");

    const firstResourceEvents = resourceEventCounts(events);
    const secondFrame = await app.stepAndRender(1 / 60, 2, 39);

    expect(secondFrame.ok).toBe(true);
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
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
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
    expect(events).not.toContain("queue:submit:1");
  });

  it("renders the standard material app path with extracted lights", async () => {
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
      materialBuffersCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
      dynamicBufferWrites: 0,
    });
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
      resourceReuse: {
        pipelineMisses: 1,
        meshBuffersCreated: 1,
        materialBuffersCreated: 1,
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

    expect(secondFrame.ok).toBe(true);
    expect(secondFrame.counts.drawCalls).toBe(1);
    expect(secondFrame.resourceReuse).toMatchObject({
      pipelineHits: 1,
      pipelineMisses: 0,
      meshBuffersReused: 1,
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
      firstResources !== undefined &&
      firstResources !== null &&
      secondResources !== undefined &&
      secondResources !== null &&
      "lightBindGroup" in firstResources &&
      "lightBindGroup" in secondResources
    ) {
      expect(secondResources.materialBindGroup).toBe(
        firstResources.materialBindGroup,
      );
      expect(secondResources.lightBindGroup).toBe(
        firstResources.lightBindGroup,
      );
      expect(secondResources.lightGpuBuffers.resource).toBe(
        firstResources.lightGpuBuffers.resource,
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
        baseColorTexture: { texture, sampler },
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
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      bindGroupsCreated: 4,
      lightBuffersCreated: 1,
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
        "material-buffer:Textured Standard/uniform",
        assetHandleKey(texture),
        assetHandleKey(sampler),
      ],
    });

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
    expect(secondResources?.bindGroups).toBe(firstResources?.bindGroups);
    expect(resourceEventCounts(events)).toEqual(firstResourceEvents);
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
        "material-buffer:Metallic Roughness Standard/uniform",
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
        "material-buffer:Emissive Occlusion Standard/uniform",
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
      meshDraws: 1,
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
      meshDraws: 1,
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

function singleMaterialResource(resources: unknown): unknown {
  if (typeof resources !== "object" || resources === null) {
    return undefined;
  }

  return "material" in resources
    ? (resources as { readonly material: unknown }).material
    : undefined;
}
