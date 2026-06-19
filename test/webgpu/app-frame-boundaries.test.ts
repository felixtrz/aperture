import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AssetRegistry,
  createRenderTargetHandle,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuAppResourceCache,
  createWebGpuBloomPostEffect,
  createWebGpuCopyPostEffect,
  createWebGpuTonemapPostEffect,
  type RenderPassCommand,
  type WebGpuPostEffect,
} from "@aperture-engine/webgpu/test-support";
import { assembleWebGpuAppFrameBoundaries } from "../../packages/webgpu/src/app/frame-boundaries.js";
import type {
  WebGpuApp,
  WebGpuAppResourceReuseReport,
} from "../../packages/webgpu/src/app/app.js";
import type { ShadowCasterGraphPass } from "../../packages/webgpu/src/app/shadow-caster-graph-pass.js";
import type { StandardFrameTransmissionSceneColorResources } from "../../packages/webgpu/src/materials/standard/standard-frame-resources.js";

interface RenderPassDescriptorLike {
  readonly colorAttachments: readonly {
    readonly view?: { readonly label?: string };
    readonly loadOp?: string;
  }[];
  readonly depthStencilAttachment?: {
    readonly view?: unknown;
    readonly depthLoadOp?: string;
  };
}

describe("WebGPU app frame boundary assembly", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns render-target diagnostics without assembling boundaries", async () => {
    const harness = appHarness([]);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 1, renderTarget: createRenderTargetHandle("rt") }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(false);
    expect(result.boundary).toBeNull();
    expect(result.boundaries).toEqual([]);
    expect(result.renderTargets).toEqual([]);
    expect(result.plannedCommands).toBe(0);
    expect(result.drawCalls).toBe(0);
    expect(result.diagnostics).toMatchObject([
      { code: "webGpuApp.renderTargetMissing" },
    ]);
  });

  it("assembles the legacy path with one encoder and submit per target", async () => {
    const events: string[] = [];
    const harness = appHarness(events);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundary).toBe(result.boundaries[0]);
    expect(result.renderTargets).toEqual([
      {
        viewId: 1,
        source: "swapchain",
        renderTargetKey: null,
        width: 8,
        height: 4,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(result.plannedCommands).toBe(1);
    expect(result.drawCalls).toBe(1);
    expect(result.depthAttachment).toMatchObject({
      format: "depth24plus",
      attached: true,
      width: 8,
      height: 4,
    });
    expect(result.renderBundles).toBeUndefined();
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
  });

  it("records occlusion query readbacks on the legacy path", async () => {
    const events: string[] = [];
    const harness = appHarness(events, { occlusionQuerySets: true });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 3 })]),
      commands: [
        { kind: "beginOcclusionQuery", renderId: 1, queryIndex: 0 },
        drawCommand(1),
        { kind: "endOcclusionQuery", renderId: 1, queryIndex: 0 },
      ],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.occlusionQueryCount).toBe(1);
    expect(result.occlusionCulling.queriedDraws).toBe(1);
    expect(result.occlusionQueryReadbacks).toMatchObject([
      { passName: "main", viewId: 3, renderIds: [1] },
    ]);
    expect(events).toContain("resolveQuerySet:1");
    expect(events).toContain("beginOcclusionQuery:0");
  });

  it("drops occlusion query commands when query sets are unsupported", async () => {
    const events: string[] = [];
    const harness = appHarness(events);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [
        { kind: "beginOcclusionQuery", renderId: 1, queryIndex: 0 },
        drawCommand(1),
        { kind: "endOcclusionQuery", renderId: 1, queryIndex: 0 },
      ],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    // The fallback degrades deliberately (commands stripped, culling report
    // records it, warning diagnostic surfaces it) — the frame stays valid.
    expect(result.valid).toBe(true);
    expect(result.occlusionCulling.fallbackReason).toBe("unsupported");
    expect(result.occlusionQueryDiagnostics).toMatchObject([
      { code: "gpuOcclusion.missingDeviceSupport" },
    ]);
    expect(result.boundaries[0]?.valid).toBe(true);
    expect(result.boundaries[0]?.execution).toMatchObject({ drawCalls: 1 });
    expect(events).not.toContain("beginOcclusionQuery:0");
  });

  it("captures the readback boundary for the last swapchain target", async () => {
    stubReadbackGlobals();

    const harness = appHarness([]);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
      readbackSamples: [{ id: "center", x: 0.5, y: 0.5 }],
    });

    expect(result.valid).toBe(true);
    expect(result.readbackBoundary).toBe(result.boundaries[0]);
    expect(result.readbackBoundary?.readback).toMatchObject({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
    });
  });

  it("folds all forward targets into one encoder on the frame graph path", async () => {
    stubReadbackGlobals();

    const events: string[] = [];
    const harness = appHarness(events, { useFrameGraph: true });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 }), appView({ viewId: 2 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
      readbackSamples: [{ id: "center", x: 0.5, y: 0.5 }],
    });

    expect(result.valid).toBe(true);
    expect(result.boundaries).toHaveLength(2);
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event === "finish")).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    expect(result.boundaries[0]?.encoder).toBe(result.boundaries[1]?.encoder);
    expect(
      harness.passDescriptors.map(
        (descriptor) => descriptor.colorAttachments[0]?.loadOp,
      ),
    ).toEqual(["clear", "load"]);
    expect(result.renderTargets).toMatchObject([
      { viewId: 1, source: "swapchain", ok: true, drawCalls: 1 },
      { viewId: 2, source: "swapchain", ok: true, drawCalls: 1 },
    ]);
    expect(result.plannedCommands).toBe(2);
    expect(result.drawCalls).toBe(2);
    expect(result.readbackBoundary).toBe(result.boundaries[1]);
    expect(result.readbackBoundary?.readback).toMatchObject({
      ok: true,
      source: "current-texture",
    });
  });

  it("declares transient handles for offscreen render targets on the graph path", async () => {
    const events: string[] = [];
    const harness = appHarness(events, { useFrameGraph: true });
    const renderTarget = createRenderTargetHandle("probe");
    const offscreenView = { label: "offscreen-view" };
    const assets = new AssetRegistry();

    assets.register(renderTarget);
    assets.markReady(renderTarget, {
      texture: { createView: () => offscreenView },
      width: 16,
      height: 8,
      format: "bgra8unorm",
    });

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1, renderTarget })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.renderTargets).toEqual([
      {
        viewId: 1,
        source: "offscreen",
        renderTargetKey: "render-target:probe",
        width: 16,
        height: 8,
        format: "bgra8unorm",
        ok: true,
        drawCalls: 1,
      },
    ]);
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(harness.passDescriptors[0]?.colorAttachments[0]?.view).toBe(
      offscreenView,
    );
  });

  it("registers occlusion readbacks for frame-graph targets", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      occlusionQuerySets: true,
      useFrameGraph: true,
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 9 })]),
      commands: [
        { kind: "beginOcclusionQuery", renderId: 4, queryIndex: 0 },
        drawCommand(4),
        { kind: "endOcclusionQuery", renderId: 4, queryIndex: 0 },
      ],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.occlusionQueryCount).toBe(1);
    expect(result.occlusionQueryReadbacks).toMatchObject([
      { passName: "main", viewId: 9, renderIds: [4] },
    ]);
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events).toContain("resolveQuerySet:1");
  });

  it("records occlusion readbacks for post-processed swapchain targets", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      occlusionQuerySets: true,
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 5 })]),
      commands: [
        { kind: "beginOcclusionQuery", renderId: 6, queryIndex: 0 },
        drawCommand(6),
        { kind: "endOcclusionQuery", renderId: 6, queryIndex: 0 },
      ],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.postEffects).toMatchObject([{ effectId: "copy", ok: true }]);
    expect(result.occlusionQueryCount).toBe(1);
    expect(result.occlusionQueryReadbacks).toMatchObject([
      { passName: "main", viewId: 5, renderIds: [6] },
    ]);
    expect(events).toContain("resolveQuerySet:1");
  });

  it("keeps post-graph shadows, occlusion, and overlays on the graph route", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      occlusionQuerySets: true,
      postEffects: [
        createWebGpuBloomPostEffect({
          id: "bloom",
          threshold: 0.7,
          intensity: 0.06,
          radiusPixels: 2,
        }),
        createWebGpuTonemapPostEffect({
          operator: "aces",
          exposure: 1,
        }),
      ],
      useFrameGraph: true,
      sceneRenderFormat: "rgba16float",
    });
    const shadowDepthView = { label: "shadow-depth-view" };
    const shadowPass: ShadowCasterGraphPass = {
      key: "sun:cascade:0",
      depthView: shadowDepthView,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1,
      width: 64,
      height: 64,
      depthFormat: "depth24plus",
      commands: [drawCommand(11)],
    };
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 5 }), appView({ viewId: 6 })]),
      commands: [
        { kind: "beginOcclusionQuery", renderId: 6, queryIndex: 0 },
        drawCommand(6),
        { kind: "endOcclusionQuery", renderId: 6, queryIndex: 0 },
      ],
      overlayCommands: [drawCommand(7)],
      label: "frame",
      reuse: resourceReuseReport(),
      shadowCasterGraphPasses: [shadowPass],
    });

    expect(result.valid).toBe(true);
    expect(result.postEffects).toMatchObject([
      { effectId: "bloom", ok: true },
      { effectId: "hdr-tonemap", ok: true },
    ]);
    expect(result.occlusionQueryCount).toBe(2);
    expect(result.occlusionQueryReadbacks).toMatchObject([
      { passName: "main", viewId: 5, renderIds: [6] },
      { passName: "main", viewId: 6, renderIds: [6] },
    ]);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({
        code: "webgpu.postGraph.shadowCasterGraphDeclined",
      }),
    );
    expect(harness.passDescriptors).toHaveLength(18);
    expect(harness.passDescriptors[0]).toMatchObject({
      colorAttachments: [],
      depthStencilAttachment: { view: shadowDepthView },
    });
    expect(harness.passDescriptors[1]).toMatchObject({
      occlusionQuerySet: expect.anything(),
    });
    expect(harness.passDescriptors[2]).toMatchObject({
      colorAttachments: [],
      depthStencilAttachment: { view: shadowDepthView },
    });
    expect(harness.passDescriptors[3]).toMatchObject({
      occlusionQuerySet: expect.anything(),
    });
    expect(harness.passDescriptors[17]).toMatchObject({
      colorAttachments: [{ loadOp: "load" }],
    });
    expect(events.filter((event) => event === "encoder")).toHaveLength(2);
    expect(events).toContain("beginOcclusionQuery:0");
    expect(events).toContain("resolveQuerySet:1");
  });

  it("creates and reuses render bundles for post-graph scene passes", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
      renderBundles: true,
      useFrameGraph: true,
    });
    const cache = createWebGpuAppResourceCache();
    const baseOptions = {
      app: harness.app,
      assets: new AssetRegistry(),
      cache,
      snapshot: appSnapshot([appView({ viewId: 5 })]),
      commands: [drawCommand(5), drawCommand(6)],
      renderBundleCommands: [drawCommand(5)],
      label: "frame",
      reuse: resourceReuseReport(),
      enableRenderBundles: true,
    };

    const first = await assembleWebGpuAppFrameBoundaries(baseOptions);
    const second = await assembleWebGpuAppFrameBoundaries(baseOptions);

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    expect(first.renderBundles).toMatchObject({
      created: 1,
      reused: 0,
      executedBundles: 1,
      drawCalls: 1,
    });
    expect(first.renderTargets).toMatchObject([{ drawCalls: 2 }]);
    expect(first.renderBundles?.reports[0]).toMatchObject({
      commandCount: 1,
      drawCalls: 1,
    });
    expect(second.renderBundles).toMatchObject({
      created: 0,
      reused: 1,
      encodedCommands: 0,
      executedBundles: 1,
      drawCalls: 1,
    });
    expect(second.renderTargets).toMatchObject([{ drawCalls: 2 }]);
    expect(events).toContain("bundle:create:frame:swapchain:scene:bundle");
    expect(events.filter((event) => event === "executeBundles:1")).toHaveLength(
      2,
    );
  });

  it("runs post effects once after the final same-swapchain camera view", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 }), appView({ viewId: 2 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.boundaries).toHaveLength(3);
    expect(result.renderTargets).toMatchObject([
      { viewId: 1, source: "swapchain", ok: true, drawCalls: 1 },
      { viewId: 2, source: "swapchain", ok: true, drawCalls: 1 },
    ]);
    expect(result.postEffects).toMatchObject([
      { effectId: "copy", viewId: 2, output: "swapchain", ok: true },
    ]);
    expect(result.plannedCommands).toBe(5);
    expect(result.drawCalls).toBe(3);
    expect(harness.passDescriptors).toHaveLength(3);
    expect(harness.passDescriptors[0]?.colorAttachments[0]).toMatchObject({
      view: { label: "view:frame:post:scene" },
      loadOp: "clear",
    });
    expect(harness.passDescriptors[0]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "clear",
    });
    expect(harness.passDescriptors[1]?.colorAttachments[0]).toMatchObject({
      view: { label: "view:frame:post:scene" },
      loadOp: "load",
    });
    expect(harness.passDescriptors[1]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "load",
    });
    expect(harness.passDescriptors[2]?.colorAttachments[0]).toMatchObject({
      view: { label: "swapchain-view" },
      loadOp: "clear",
    });
    expect(events.filter((event) => event === "encoder")).toHaveLength(3);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
      "submit:1",
      "submit:1",
    ]);
  });

  it("clears depth for transparent post-processed overlay camera views", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 1 }),
        appView({ viewId: 2, clearColor: [0, 0, 0, 0] }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.boundaries).toHaveLength(3);
    expect(result.postEffects).toMatchObject([
      { effectId: "copy", viewId: 2, output: "swapchain", ok: true },
    ]);
    expect(harness.passDescriptors[1]?.colorAttachments[0]).toMatchObject({
      view: { label: "view:frame:post:scene" },
      loadOp: "load",
    });
    expect(harness.passDescriptors[1]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "clear",
    });
  });

  it("clears depth for transparent frame-graph overlay camera views", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
      useFrameGraph: true,
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 1 }),
        appView({ viewId: 2, clearColor: [0, 0, 0, 0] }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(result.postEffects).toMatchObject([
      { effectId: "copy", viewId: 2, output: "swapchain", ok: true },
    ]);
    expect(harness.passDescriptors[1]?.colorAttachments[0]).toMatchObject({
      view: { label: "view:frame:post:scene" },
      loadOp: "load",
    });
    expect(harness.passDescriptors[1]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "clear",
    });
  });

  it("clears depth for disjoint-layer post-processed overlay camera views", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
      useFrameGraph: true,
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 1, layerMask: 1 }),
        appView({ viewId: 2, layerMask: 2 }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(harness.passDescriptors[1]?.colorAttachments[0]).toMatchObject({
      view: { label: "view:frame:post:scene" },
      loadOp: "load",
    });
    expect(harness.passDescriptors[1]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "clear",
    });
  });

  it("loads depth for overlapping-layer post-processed camera views", async () => {
    const events: string[] = [];
    const harness = appHarness(events, {
      postEffects: [createWebGpuCopyPostEffect({ id: "copy" })],
      useFrameGraph: true,
    });
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([
        appView({ viewId: 1, layerMask: 1 }),
        appView({ viewId: 2, layerMask: 1 }),
      ]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);
    expect(harness.passDescriptors[1]?.depthStencilAttachment).toMatchObject({
      depthLoadOp: "load",
    });
  });

  it("encodes shadow caster passes before forward targets in the shared encoder", async () => {
    const events: string[] = [];
    const harness = appHarness(events, { useFrameGraph: true });
    const shadowDepthView = { label: "shadow-depth-view" };
    const shadowPass: ShadowCasterGraphPass = {
      key: "sun:cascade:0",
      depthView: shadowDepthView,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1,
      width: 64,
      height: 64,
      depthFormat: "depth24plus",
      commands: [drawCommand(11)],
    };
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
      shadowCasterGraphPasses: [shadowPass],
    });

    expect(result.valid).toBe(true);
    expect(result.boundaries).toHaveLength(1);
    expect(harness.passDescriptors).toHaveLength(2);
    expect(harness.passDescriptors[0]).toMatchObject({
      colorAttachments: [],
      depthStencilAttachment: { view: shadowDepthView },
    });
    expect(harness.passDescriptors[1]?.colorAttachments[0]?.view).toMatchObject(
      { label: "swapchain-view" },
    );
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event === "draw")).toHaveLength(2);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
  });

  it("folds transmission grab passes into the frame graph before the main pass", async () => {
    const events: string[] = [];
    const harness = appHarness(events, { useFrameGraph: true });
    const transmission = transmissionResources(events);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
      transmissionSceneColorResources: transmission.resources,
    });

    expect(result.valid).toBe(true);
    expect(result.transmissionGrabPass).toEqual({
      enabled: true,
      ok: true,
      width: 8,
      height: 4,
      format: "bgra8unorm",
      commands: 1,
      drawCalls: 1,
      textureResourceKey: "transmission-grab:texture",
      samplerResourceKey: "transmission-grab:sampler",
    });
    expect(result.boundaries).toHaveLength(2);
    expect(result.boundaries[0]?.texture.texture).toBe(transmission.texture);
    expect(result.plannedCommands).toBe(2);
    expect(result.drawCalls).toBe(2);
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    expect(harness.passDescriptors[0]?.colorAttachments[0]?.view).toMatchObject(
      { label: "transmission-grab-view" },
    );
  });

  it("runs the transmission grab pass through its own boundary on the legacy path", async () => {
    const events: string[] = [];
    const harness = appHarness(events);
    const transmission = transmissionResources(events);
    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
      transmissionSceneColorResources: transmission.resources,
    });

    expect(result.valid).toBe(true);
    expect(result.transmissionGrabPass).toMatchObject({
      enabled: true,
      ok: true,
      commands: 1,
      drawCalls: 1,
    });
    expect(result.boundaries).toHaveLength(2);
    expect(result.boundary).toBe(result.boundaries[0]);
    expect(events.filter((event) => event === "encoder")).toHaveLength(2);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
      "submit:1",
    ]);
  });
});

function stubReadbackGlobals(): void {
  vi.stubGlobal("GPUBufferUsage", { MAP_READ: 1, COPY_DST: 8 });
  vi.stubGlobal("GPUMapMode", { READ: 1 });
}

function appHarness(
  events: string[],
  options: {
    readonly occlusionQuerySets?: boolean;
    readonly useFrameGraph?: boolean;
    readonly postEffects?: readonly WebGpuPostEffect[];
    readonly renderBundles?: boolean;
    readonly sceneRenderFormat?: string;
  } = {},
): {
  readonly app: WebGpuApp;
  readonly passDescriptors: RenderPassDescriptorLike[];
} {
  const passDescriptors: RenderPassDescriptorLike[] = [];
  const device = {
    features: { has: () => false },
    queue: {
      writeBuffer: () => {},
      submit: (buffers: readonly unknown[]) =>
        events.push(`submit:${buffers.length}`),
    },
    createTexture: (descriptor: { readonly label?: string }) => ({
      createView: () => ({ label: `view:${descriptor.label ?? "unlabeled"}` }),
      destroy: () => {},
    }),
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
    ...(options.renderBundles === true
      ? {
          createRenderBundleEncoder: (descriptor: {
            readonly label?: string;
          }) => {
            events.push(`bundle:create:${descriptor.label ?? "unlabeled"}`);
            return {
              setPipeline: () => events.push("bundle:setPipeline"),
              setBindGroup: () => events.push("bundle:setBindGroup"),
              setVertexBuffer: () => events.push("bundle:setVertexBuffer"),
              draw: () => events.push("bundle:draw"),
              finish: () => {
                events.push("bundle:finish");
                return { label: "render-bundle" };
              },
            };
          },
        }
      : {}),
    createBuffer: (descriptor: { readonly label?: string }) => ({
      descriptor,
      mapAsync: async () => {},
      getMappedRange: () => new Uint8Array([7, 8, 9, 255]),
      unmap: () => {},
    }),
    ...(options.occlusionQuerySets === true
      ? {
          createQuerySet: (descriptor: unknown) => ({ descriptor }),
        }
      : {}),
    createCommandEncoder: () => {
      events.push("encoder");
      return {
        beginRenderPass: (descriptor: unknown) => {
          events.push("begin");
          passDescriptors.push(descriptor as RenderPassDescriptorLike);
          return {
            setViewport: () => {},
            setScissorRect: () => {},
            setPipeline: () => events.push("setPipeline"),
            setBindGroup: () => events.push("setBindGroup"),
            setVertexBuffer: () => events.push("setVertexBuffer"),
            draw: () => events.push("draw"),
            ...(options.renderBundles === true
              ? {
                  executeBundles: (bundles: readonly unknown[]) =>
                    events.push(`executeBundles:${bundles.length}`),
                }
              : {}),
            beginOcclusionQuery: (queryIndex: number) =>
              events.push(`beginOcclusionQuery:${queryIndex}`),
            endOcclusionQuery: () => events.push("endOcclusionQuery"),
            end: () => events.push("end"),
          };
        },
        resolveQuerySet: (
          _querySet: unknown,
          _firstQuery: number,
          queryCount: number,
        ) => events.push(`resolveQuerySet:${queryCount}`),
        copyBufferToBuffer: (
          _source: unknown,
          _sourceOffset: number,
          _destination: unknown,
          _destinationOffset: number,
          size: number,
        ) => events.push(`copyBufferToBuffer:${size}`),
        copyTextureToBuffer: () => events.push("copyTextureToBuffer"),
        finish: () => {
          events.push("finish");
          return { label: "command-buffer" };
        },
      };
    },
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
    postEffects: options.postEffects ?? [],
    useFrameGraph: options.useFrameGraph ?? false,
    msaa: {
      requestedSampleCount: 1,
      sampleCount: 1,
      enabled: false,
      clamped: false,
      supportedSampleCounts: [1, 4],
    },
    sceneRenderFormat: options.sceneRenderFormat ?? "bgra8unorm",
  } as unknown as WebGpuApp;

  return { app, passDescriptors };
}

function transmissionResources(events: string[]): {
  readonly resources: StandardFrameTransmissionSceneColorResources;
  readonly texture: { createView: () => { label: string } };
} {
  const texture = {
    createView: () => {
      events.push("transmission:view");
      return { label: "transmission-grab-view" };
    },
  };

  return {
    texture,
    resources: {
      texture: {
        resourceKey: "transmission-grab:texture",
        texture,
        view: { label: "transmission-grab-view" },
        width: 8,
        height: 4,
        format: "bgra8unorm",
      },
      sampler: {
        resourceKey: "transmission-grab:sampler",
        sampler: { label: "transmission-grab-sampler" },
      },
    },
  };
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
  readonly clearColor?: readonly [number, number, number, number];
  readonly layerMask?: number;
}): RenderSnapshot["views"][number] {
  return {
    viewId: options.viewId,
    camera: { index: 0, generation: 1 },
    priority: 0,
    layerMask: options.layerMask ?? 1,
    viewMatrixOffset: 0,
    projectionMatrixOffset: 16,
    viewProjectionMatrixOffset: 32,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: options.clearColor ?? [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: options.renderTarget ?? null,
  };
}

function resourceReuseReport(): WebGpuAppResourceReuseReport {
  return {} as unknown as WebGpuAppResourceReuseReport;
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
