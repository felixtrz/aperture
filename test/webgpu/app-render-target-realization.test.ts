import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createRenderTargetHandle,
  createTextureHandle,
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
  createView: () => { readonly label: string };
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
      writeBuffer: () => {},
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
        createView: () => ({
          label: `view:${descriptor.label ?? "unlabeled"}`,
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
