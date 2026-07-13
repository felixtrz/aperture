import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createRenderTargetHandle,
  createTextureHandle,
  type RenderTargetHandle,
} from "@aperture-engine/simulation";
import {
  createRenderTargetAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createWebGpuAppResourceCache,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";
import { assembleWebGpuAppFrameBoundaries } from "../../packages/webgpu/src/app/frame-boundaries.js";
import {
  prepareAppTextureResource,
  type AppTextureSamplerResourceReuseReport,
  type WebGpuAppTextureSamplerPreparationDiagnostic,
} from "../../packages/webgpu/src/app/app-texture-sampler-resources.js";
import type {
  WebGpuApp,
  WebGpuAppResourceReuseReport,
} from "../../packages/webgpu/src/app/app.js";

interface FakeTexture {
  readonly label: string;
  readonly format: string;
  readonly usage: number;
  readonly size: readonly number[];
  destroyed: boolean;
  createView: (descriptor?: {
    readonly dimension?: string;
    readonly baseArrayLayer?: number;
  }) => { readonly label: string };
  destroy: () => void;
}

interface CapturedPassDescriptor {
  readonly colorAttachments: readonly {
    readonly view?: { readonly label?: string };
    readonly resolveTarget?: { readonly label?: string };
  }[];
}

const TEXTURE_BINDING = 0x4;
const RENDER_ATTACHMENT = 0x10;

describe("WebGPU app facade render-target realization (B1)", () => {
  it("realizes a facade render-target asset into a renderer-owned texture", async () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("minimap.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ label: "Minimap", width: 256, height: 128 }),
    );

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([
        appView({ viewId: 1, renderTarget: handle }),
        appView({ viewId: 2 }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.renderTargets).toMatchObject([
      {
        viewId: 1,
        source: "offscreen",
        renderTargetKey: "render-target:minimap.rt",
        width: 256,
        height: 128,
        // format "swapchain" resolved to the app's canvas format.
        format: "bgra8unorm",
        ok: true,
      },
      { viewId: 2, source: "swapchain" },
    ]);

    const realized = renderTargetTextures(harness.textures);

    expect(realized).toHaveLength(1);
    expect(realized[0]).toMatchObject({
      size: [256, 128, 1],
      format: "bgra8unorm",
      usage: RENDER_ATTACHMENT | TEXTURE_BINDING,
      destroyed: false,
    });
    expect(cache.renderTargets.counters).toMatchObject({
      renderTargetTexturesCreated: 1,
      renderTargetTexturesDestroyed: 0,
    });
  });

  it("reuses the realized texture across frames and on the frame-graph route", async () => {
    for (const useFrameGraph of [false, true]) {
      const harness = fakeApp({ useFrameGraph });
      const cache = createWebGpuAppResourceCache();
      const assets = new AssetRegistry();
      const handle = createRenderTargetHandle("stable.rt");

      assets.register(handle);
      assets.markReady(
        handle,
        createRenderTargetAsset({ width: 64, height: 64 }),
      );

      for (let frame = 0; frame < 3; frame += 1) {
        const result = await assembleWebGpuAppFrameBoundaries({
          app: harness.app,
          assets,
          cache,
          snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
          commands: [drawCommand(1)],
          label: `frame-${frame}`,
          reuse: resourceReuseReport(),
        });

        expect(result.valid).toBe(true);
      }

      expect(renderTargetTextures(harness.textures)).toHaveLength(1);
      expect(cache.renderTargets.counters).toMatchObject({
        renderTargetTexturesCreated: 1,
        renderTargetTexturesReused: 2,
        renderTargetTexturesDestroyed: 0,
      });
    }
  });

  it("destroys and recreates the texture on a version bump (handle-stable resize)", async () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("resizable.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 128, height: 128 }),
    );

    const first = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame-initial",
      reuse: resourceReuseReport(),
    });

    // Re-publish the SAME handle at a new size (what renderTargets.resize does).
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 384, height: 384 }),
    );

    const second = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame-resized",
      reuse: resourceReuseReport(),
    });

    expect(first.renderTargets[0]).toMatchObject({ width: 128, height: 128 });
    expect(second.renderTargets[0]).toMatchObject({
      renderTargetKey: "render-target:resizable.rt",
      width: 384,
      height: 384,
      ok: true,
    });

    const realized = renderTargetTextures(harness.textures);

    expect(realized).toHaveLength(2);
    expect(realized[0]).toMatchObject({ size: [128, 128, 1], destroyed: true });
    expect(realized[1]).toMatchObject({
      size: [384, 384, 1],
      destroyed: false,
    });
    expect(cache.renderTargets.counters).toMatchObject({
      renderTargetTexturesCreated: 2,
      renderTargetTexturesDestroyed: 1,
    });
  });

  it("wires the MSAA color attachment to resolve into the realized texture", async () => {
    const harness = fakeApp({ msaaSampleCount: 4 });
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("msaa.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 64, height: 64, msaa: 4 }),
    );

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.renderTargets[0]).toMatchObject({
      source: "offscreen",
      msaaSampleCount: 4,
      ok: true,
    });

    // The pass renders into the per-target MSAA color texture and resolves
    // into the realized (1-sample, sampleable) render-target texture.
    const offscreenPass = harness.passDescriptors[0];

    expect(offscreenPass?.colorAttachments[0]?.view?.label).toBe(
      "view:aperture/webgpu-app/msaa/render-target:msaa.rt",
    );
    expect(offscreenPass?.colorAttachments[0]?.resolveTarget?.label).toBe(
      "view:aperture/webgpu-app/render-target/msaa.rt",
    );
  });

  it("diagnoses msaa: 4 targets when the app renders without 4x MSAA", async () => {
    const harness = fakeApp();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("msaa.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 64, height: 64, msaa: 4 }),
    );

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "webGpuApp.renderTargetMsaaUnavailable", viewId: 1 },
    ]);
    expect(renderTargetTextures(harness.textures)).toHaveLength(0);
  });

  it("diagnoses concrete formats that mismatch the app pipeline format", async () => {
    const harness = fakeApp();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("hdr.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 64, height: 64, format: "rgba16float" }),
    );

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "webGpuApp.renderTargetFormatMismatch", viewId: 1 },
    ]);
  });

  it("serves texture bindings from the realized target under the same id", async () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("minimap.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 32, height: 32 }),
    );
    cache.renderTargets.appFormat = "bgra8unorm";

    const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
    const reuse = textureSamplerReuseReport();
    const prepared = prepareAppTextureResource({
      assets,
      device: harness.device,
      cache,
      handle: createTextureHandle("minimap.rt"),
      reuse,
      diagnostics,
    });

    expect(diagnostics).toEqual([]);
    expect(prepared?.cacheKey).toBe("render-target:minimap.rt@1");
    expect((prepared?.resource.view as { readonly label?: string }).label).toBe(
      "view:aperture/webgpu-app/render-target/minimap.rt",
    );

    // The frame boundary reuses the texture the sampling path realized — the
    // offscreen camera renders into the same GPU texture materials sample.
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget: handle })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(renderTargetTextures(harness.textures)).toHaveLength(1);
    expect(cache.renderTargets.counters).toMatchObject({
      renderTargetTexturesCreated: 1,
      renderTargetTexturesReused: 1,
    });

    // Version bump re-realizes for the sampling path too (new cache key).
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 48, height: 48 }),
    );

    const rePrepared = prepareAppTextureResource({
      assets,
      device: harness.device,
      cache,
      handle: createTextureHandle("minimap.rt"),
      reuse,
      diagnostics,
    });

    expect(rePrepared?.cacheKey).toBe("render-target:minimap.rt@2");
    expect(cache.renderTargets.counters.renderTargetTexturesDestroyed).toBe(1);
  });

  it("keeps texture source assets ahead of same-id render targets", () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const textureHandle = createTextureHandle("shared.id");
    const targetHandle = createRenderTargetHandle("shared.id");

    assets.register(textureHandle);
    assets.markReady(textureHandle, {
      kind: "texture",
      label: "Data Texture",
      dimension: "2d",
      width: 2,
      height: 2,
      depthOrLayers: 1,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      mipLevelCount: 1,
      usage: ["sampled", "copy-dst"],
      sourceData: { bytes: new Uint8Array(16), bytesPerRow: 8 },
    });
    assets.register(targetHandle);
    assets.markReady(
      targetHandle,
      createRenderTargetAsset({ width: 32, height: 32 }),
    );
    cache.renderTargets.appFormat = "bgra8unorm";

    const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
    const prepared = prepareAppTextureResource({
      assets,
      device: harness.device,
      cache,
      handle: textureHandle,
      reuse: textureSamplerReuseReport(),
      diagnostics,
    });

    expect(diagnostics).toEqual([]);
    expect(prepared?.cacheKey).toBe("texture:shared.id@1");
    expect(renderTargetTextures(harness.textures)).toHaveLength(0);
  });

  it("diagnoses sampling a cube target through a 2d material texture binding", () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("probe.env");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ dimension: "cube", size: 32 }),
    );
    cache.renderTargets.appFormat = "bgra8unorm";

    const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
    const prepared = prepareAppTextureResource({
      assets,
      device: harness.device,
      cache,
      handle: createTextureHandle("probe.env"),
      reuse: textureSamplerReuseReport(),
      diagnostics,
    });

    expect(prepared).toBeNull();
    expect(diagnostics).toMatchObject([
      {
        code: "webGpuApp.renderTargetCubeBindingUnsupported",
        resourceKey: "texture:probe.env",
      },
    ]);
  });

  it("diagnoses sampling a target registered with sampleable: false", () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("private.rt");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ width: 32, height: 32, sampleable: false }),
    );
    cache.renderTargets.appFormat = "bgra8unorm";

    const diagnostics: WebGpuAppTextureSamplerPreparationDiagnostic[] = [];
    const prepared = prepareAppTextureResource({
      assets,
      device: harness.device,
      cache,
      handle: createTextureHandle("private.rt"),
      reuse: textureSamplerReuseReport(),
      diagnostics,
    });

    expect(prepared).toBeNull();
    expect(diagnostics).toMatchObject([
      {
        code: "webGpuApp.renderTargetNotSampleable",
        resourceKey: "texture:private.rt",
      },
    ]);
  });
});

describe("WebGPU app cube render-target capture (B2)", () => {
  const cubeCaptureViews = (
    handle: RenderTargetHandle,
  ): RenderSnapshot["views"] => [
    ...Array.from({ length: 6 }, (_, face) =>
      appView({
        viewId: 100 + face,
        renderTarget: handle,
        renderTargetFace: face,
      }),
    ),
    appView({ viewId: 1 }),
  ];
  // Fake shared view-uniform buffer + packed records for the 6 faces and the
  // swapchain view; records are 44 floats apart (PACKED_VIEW_UNIFORM stride).
  const fakeViewUniformCapture = (writes: number[]) => {
    const viewIds = [100, 101, 102, 103, 104, 105, 1];

    return {
      viewUniforms: {
        data: new Float32Array(44 * viewIds.length),
        floatCount: 44 * viewIds.length,
        views: viewIds.map((viewId, index) => ({
          viewId,
          sourceOffset: 0,
          packedOffset: index * 44,
        })),
        diagnostics: [],
      },
      buffers: [
        {
          label: "fake-view-uniform-buffer",
          recordWrite: (dataOffset: number) => writes.push(dataOffset),
        },
      ],
    };
  };

  for (const useFrameGraph of [false, true]) {
    it(`renders six face passes into cube layers (useFrameGraph: ${String(useFrameGraph)})`, async () => {
      const harness = fakeApp({ useFrameGraph });
      const cache = createWebGpuAppResourceCache();
      const assets = new AssetRegistry();
      const handle = createRenderTargetHandle("probe.env");

      assets.register(handle);
      assets.markReady(
        handle,
        createRenderTargetAsset({ dimension: "cube", size: 64 }),
      );

      const viewUniformWrites: number[] = [];
      const result = await assembleWebGpuAppFrameBoundaries({
        app: harness.app,
        assets,
        cache,
        snapshot: appSnapshot(cubeCaptureViews(handle)),
        commands: [drawCommand(1)],
        label: "frame",
        reuse: resourceReuseReport(),
        viewUniformCapture: fakeViewUniformCapture(viewUniformWrites),
      });

      expect(result.diagnostics).toEqual([]);
      expect(result.valid).toBe(true);

      // Each target selected its own packed view record before submitting
      // (six faces + the swapchain view), then record 0 was restored.
      expect(viewUniformWrites).toEqual([0, 44, 88, 132, 176, 220, 264, 0]);

      // One realized 6-layer cube texture, not six 2d textures.
      const realized = renderTargetTextures(harness.textures);

      expect(realized).toHaveLength(1);
      expect(realized[0]).toMatchObject({
        size: [64, 64, 6],
        format: "bgra8unorm",
        destroyed: false,
      });

      // Six offscreen face submissions (face-tagged) plus the swapchain view.
      const faceSubmissions = result.renderTargets.filter(
        (submission) => submission.face !== undefined,
      );

      expect(faceSubmissions).toHaveLength(6);
      expect(faceSubmissions.map((submission) => submission.face)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
      expect(
        faceSubmissions.every(
          (submission) =>
            submission.ok &&
            submission.renderTargetKey === "render-target:probe.env",
        ),
      ).toBe(true);

      // One completed capture: generation 1.
      expect(result.renderTargetCaptures).toEqual([
        {
          renderTargetKey: "render-target:probe.env",
          faces: 6,
          ok: true,
          captureGeneration: 1,
        },
      ]);
      expect(
        cache.renderTargets.captureGenerations.get("render-target:probe.env"),
      ).toBe(1);

      // Each face pass attaches its own layer view (never the cube view).
      const attachmentLabels = harness.passDescriptors
        .map(
          (descriptor) =>
            descriptor.colorAttachments[0]?.view?.label ?? "missing",
        )
        .filter((label) => label.includes("render-target/probe.env"));

      expect(attachmentLabels).toEqual(
        Array.from(
          { length: 6 },
          (_, face) =>
            `view:aperture/webgpu-app/render-target/probe.env#layer${face}`,
        ),
      );
    });
  }

  it("bumps the capture generation per captured frame and survives resize", async () => {
    const harness = fakeApp();
    const cache = createWebGpuAppResourceCache();
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("probe.env");

    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({ dimension: "cube", size: 32 }),
    );

    const first = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot(cubeCaptureViews(handle)),
      commands: [drawCommand(1)],
      label: "frame-1",
      reuse: resourceReuseReport(),
      viewUniformCapture: fakeViewUniformCapture([]),
    });
    const second = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot(cubeCaptureViews(handle)),
      commands: [drawCommand(1)],
      label: "frame-2",
      reuse: resourceReuseReport(),
      viewUniformCapture: fakeViewUniformCapture([]),
    });

    expect(first.renderTargetCaptures[0]?.captureGeneration).toBe(1);
    expect(second.renderTargetCaptures[0]?.captureGeneration).toBe(2);
    expect(cache.renderTargets.counters).toMatchObject({
      renderTargetTexturesCreated: 1,
      renderTargetTexturesReused: 5 + 6,
    });

    // A frame without capture views leaves the generation untouched.
    const idle = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame-idle",
      reuse: resourceReuseReport(),
      viewUniformCapture: fakeViewUniformCapture([]),
    });

    expect(idle.renderTargetCaptures).toEqual([]);
    expect(
      cache.renderTargets.captureGenerations.get("render-target:probe.env"),
    ).toBe(2);

    // Handle-stable resize: destroy + recreate, generation keeps counting.
    assets.markReady(
      handle,
      createRenderTargetAsset({ dimension: "cube", size: 64 }),
    );

    const resized = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: appSnapshot(cubeCaptureViews(handle)),
      commands: [drawCommand(1)],
      label: "frame-resized",
      reuse: resourceReuseReport(),
      viewUniformCapture: fakeViewUniformCapture([]),
    });

    expect(resized.renderTargetCaptures[0]?.captureGeneration).toBe(3);

    const realized = renderTargetTextures(harness.textures);

    expect(realized).toHaveLength(2);
    expect(realized[0]).toMatchObject({ size: [32, 32, 6], destroyed: true });
    expect(realized[1]).toMatchObject({ size: [64, 64, 6], destroyed: false });
    expect(cache.renderTargets.counters.renderTargetTexturesDestroyed).toBe(1);
  });

  it("diagnoses msaa: 4 cube targets as invalid assets", async () => {
    const harness = fakeApp({ msaaSampleCount: 4 });
    const assets = new AssetRegistry();
    const handle = createRenderTargetHandle("probe.env");

    assets.register(handle);
    assets.markReady(handle, {
      ...createRenderTargetAsset({ dimension: "cube", size: 32 }),
      msaa: 4,
    });

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 100, renderTarget: handle, renderTargetFace: 0 }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "webGpuApp.renderTargetInvalid", viewId: 100 },
    ]);
    expect(renderTargetTextures(harness.textures)).toHaveLength(0);
  });
});

function fakeApp(
  options: {
    readonly useFrameGraph?: boolean;
    readonly msaaSampleCount?: number;
  } = {},
): {
  readonly app: WebGpuApp;
  readonly device: unknown;
  readonly textures: FakeTexture[];
  readonly passDescriptors: CapturedPassDescriptor[];
} {
  const textures: FakeTexture[] = [];
  const passDescriptors: CapturedPassDescriptor[] = [];
  const sampleCount = options.msaaSampleCount ?? 1;
  const device = {
    features: { has: () => false },
    queue: {
      writeBuffer: (
        buffer: { recordWrite?: (dataOffset: number) => void },
        _bufferOffset: number,
        _data: unknown,
        dataOffset?: number,
      ) => {
        buffer.recordWrite?.(dataOffset ?? 0);
      },
      writeTexture: () => {},
      submit: () => {},
    },
    createTexture: (descriptor: {
      readonly label?: string;
      readonly format?: string;
      readonly usage?: number;
      readonly size?:
        | readonly number[]
        | { readonly width?: number; readonly height?: number };
    }) => {
      const size = Array.isArray(descriptor.size)
        ? [...descriptor.size]
        : [
            (descriptor.size as { width?: number } | undefined)?.width ?? 0,
            (descriptor.size as { height?: number } | undefined)?.height ?? 0,
          ];
      const texture: FakeTexture = {
        label: descriptor.label ?? "unlabeled",
        format: descriptor.format ?? "unknown",
        usage: descriptor.usage ?? 0,
        size,
        destroyed: false,
        // Cube realizations create labeled sub-views (a cube sampling view +
        // one 2d view per layer); default views keep the plain label.
        createView: (viewDescriptor?: {
          readonly dimension?: string;
          readonly baseArrayLayer?: number;
        }) => ({
          label:
            viewDescriptor?.dimension === "cube"
              ? `view:${descriptor.label ?? "unlabeled"}#cube`
              : viewDescriptor?.dimension === "2d" &&
                  viewDescriptor.baseArrayLayer !== undefined
                ? `view:${descriptor.label ?? "unlabeled"}#layer${viewDescriptor.baseArrayLayer}`
                : `view:${descriptor.label ?? "unlabeled"}`,
        }),
        destroy: () => {
          texture.destroyed = true;
        },
      };

      textures.push(texture);
      return texture;
    },
    createSampler: (descriptor: unknown) => ({ descriptor }),
    createShaderModule: (descriptor: unknown) => ({
      descriptor,
      compilationInfo: async () => ({ messages: [] }),
    }),
    createRenderPipeline: (descriptor: unknown) => ({
      descriptor,
      getBindGroupLayout: (group: number) => ({ group }),
    }),
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createBuffer: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: () => ({
      beginRenderPass: (descriptor: unknown) => {
        passDescriptors.push(descriptor as CapturedPassDescriptor);
        return {
          setViewport: () => {},
          setScissorRect: () => {},
          setPipeline: () => {},
          setBindGroup: () => {},
          setVertexBuffer: () => {},
          draw: () => {},
          end: () => {},
        };
      },
      finish: () => ({ label: "command-buffer" }),
    }),
  };
  const context = {
    getCurrentTexture: () => ({
      createView: () => ({ label: "swapchain-view" }),
    }),
  };
  const app = {
    canvas: { width: 8, height: 4 },
    initialization: {
      device,
      context,
      format: "bgra8unorm",
      adapter: {},
    },
    postEffects: [],
    useFrameGraph: options.useFrameGraph ?? false,
    msaa: {
      requestedSampleCount: sampleCount,
      sampleCount,
      enabled: sampleCount > 1,
      clamped: false,
      supportedSampleCounts: [1, 4],
    },
    sceneRenderFormat: "bgra8unorm",
  } as unknown as WebGpuApp;

  return { app, device, textures, passDescriptors };
}

function renderTargetTextures(textures: readonly FakeTexture[]): FakeTexture[] {
  return textures.filter((texture) =>
    texture.label.startsWith("aperture/webgpu-app/render-target/"),
  );
}

function appSnapshot(views: RenderSnapshot["views"]): RenderSnapshot {
  return {
    frame: 1,
    views,
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(16),
    viewMatrices: new Float32Array(48),
    diagnostics: [],
    report: {
      views: views.length,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function appView(options: {
  readonly viewId: number;
  readonly renderTarget?: RenderSnapshot["views"][number]["renderTarget"];
  readonly renderTargetFace?: number;
}): RenderSnapshot["views"][number] {
  return {
    viewId: options.viewId,
    camera: { index: 0, generation: 1 },
    priority: 0,
    layerMask: 1,
    viewMatrixOffset: 0,
    projectionMatrixOffset: 16,
    viewProjectionMatrixOffset: 32,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: options.renderTarget ?? null,
    ...(options.renderTargetFace === undefined
      ? {}
      : { renderTargetFace: options.renderTargetFace }),
  };
}

function resourceReuseReport(): WebGpuAppResourceReuseReport {
  return {} as unknown as WebGpuAppResourceReuseReport;
}

function textureSamplerReuseReport(): AppTextureSamplerResourceReuseReport {
  return {
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}

function drawCommand(renderId: number): RenderPassCommand {
  return {
    kind: "draw",
    renderId,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}
