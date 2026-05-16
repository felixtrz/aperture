import { describe, expect, it } from "vitest";

import {
  assetHandleKey,
  createBoxMeshAsset,
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
    expect(secondResources?.material).toBe(firstResources?.material);
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
    expect(
      events.filter((event) => event.startsWith("pass:draw")),
    ).toHaveLength(2);
  });

  it("diagnoses multi-draw frames that need additional app resource sets", async () => {
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

    expect(frame.ok).toBe(false);
    expect(frame.counts).toMatchObject({
      meshDraws: 2,
      drawCalls: 0,
      diagnostics: 1,
    });
    expect(frame.diagnostics[0]).toMatchObject({
      code: "webGpuApp.additionalDrawResourceUnsupported",
      drawIndex: 1,
      firstMeshKey: assetHandleKey(mesh),
      firstMaterialKey: assetHandleKey(firstMaterial),
      drawMeshKey: assetHandleKey(mesh),
      drawMaterialKey: assetHandleKey(secondMaterial),
      message: expect.stringContaining("render-world resource cache"),
    });
    expect(() => JSON.stringify(frame.diagnostics)).not.toThrow();
    expect(events).not.toContain("queue:submit:1");
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
    expect(secondResources?.material).toBe(firstResources?.material);
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
});

function webGpuHarness(events: string[]) {
  const device = {
    queue: {
      writeBuffer: (buffer: unknown) => {
        events.push(`queue:writeBuffer:${bufferLabel(buffer)}`);
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
