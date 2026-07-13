import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createRenderTargetHandle,
} from "@aperture-engine/simulation";
import {
  createRenderTargetAsset,
  type PreparedCustomWgslMaterial,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createWebGpuAppResourceCache,
  createWebGpuAppUserPassRegistry,
  resolveWebGpuAppCustomMaterialColorTargets,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";
import { assembleWebGpuAppFrameBoundaries } from "../../packages/webgpu/src/app/frame-boundaries.js";
import type {
  WebGpuApp,
  WebGpuAppResourceReuseReport,
} from "../../packages/webgpu/src/app/app.js";

// B3 (three.js parity plan) — MRT custom materials at the frame level: the
// pass hosting the material's draws attaches the declared facade render
// targets at @location(1..N-1); incompatible hosts (size mismatch, mixed
// pipelines) render empty with a structured diagnostic (never a device
// error); a user pass reading the extras is ordered after the MRT camera
// node; and the plan resolver validates realization before any encoding.

const MRT_PIPELINE_KEY = "custom-wgsl|bgra8unorm|depth24plus|samples-1|mrt";

interface RenderPassDescriptorLike {
  readonly colorAttachments: readonly {
    readonly view?: { readonly label?: string };
    readonly loadOp?: string;
    readonly storeOp?: string;
  }[];
}

describe("MRT custom-material frame boundaries (B3)", () => {
  it("attaches the declared extras to the pass drawing the MRT pipeline and orders a resolving user pass after it", async () => {
    const harness = appHarness([]);
    const { assets, cache, plan } = mrtSetup(harness.app);

    // The resolve pass reads both extras and writes scene-color.
    harness.registry.addRenderPass({
      name: "gbuffer-resolve",
      reads: ["gbuffer.normal", "gbuffer.id"],
      writes: [{ handle: "scene-color", attachment: "load" }],
      encode(ctx) {
        ctx.setPipeline({ id: "resolve" });
        ctx.draw(3);
      },
    });

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: mrtSnapshot(assets),
      commands: mrtCommands(),
      label: "frame",
      reuse: resourceReuseReport(),
      customColorTargets: plan,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);

    // the gbuffer camera pass carries THREE color attachments: albedo (the
    // camera target) + the two declared extras (cleared + stored)
    const gbufferPass = harness.passDescriptors.find((descriptor) =>
      descriptor.colorAttachments[0]?.view?.label?.includes("gbuffer.albedo"),
    );
    expect(gbufferPass?.colorAttachments).toHaveLength(3);
    expect(gbufferPass?.colorAttachments[1]?.view).toMatchObject({
      label: "view:aperture/webgpu-app/render-target/gbuffer.normal",
    });
    expect(gbufferPass?.colorAttachments[1]?.loadOp).toBe("clear");
    expect(gbufferPass?.colorAttachments[1]?.storeOp).toBe("store");
    expect(gbufferPass?.colorAttachments[2]?.view).toMatchObject({
      label: "view:aperture/webgpu-app/render-target/gbuffer.id",
    });

    // the swapchain pass keeps its single attachment (no MRT draws there)
    const swapchainPass = harness.passDescriptors.find(
      (descriptor) =>
        descriptor.colorAttachments[0]?.view?.label === "swapchain-view",
    );
    expect(swapchainPass?.colorAttachments).toHaveLength(1);

    // the resolve pass ran and was ordered AFTER the gbuffer camera node
    // (read-after-write on the extras' handles)
    const graph = result.renderTargets.find((target) => target.graph)?.graph;
    const order = graph?.order ?? [];
    const gbufferIndex = order.findIndex((name) =>
      name.includes("render-target:gbuffer.albedo"),
    );
    const resolveIndex = order.indexOf("gbuffer-resolve");
    expect(gbufferIndex).toBeGreaterThanOrEqual(0);
    expect(resolveIndex).toBeGreaterThan(gbufferIndex);
    expect(graph?.userPasses).toMatchObject([
      { name: "gbuffer-resolve", kind: "render", ran: true },
    ]);
  });

  it("strips an incompatible host pass (size mismatch) with a structured diagnostic instead of a device error", async () => {
    const harness = appHarness([]);
    const { assets, cache, plan } = mrtSetup(harness.app, {
      albedoSize: { width: 16, height: 16 }, // extras stay 8x4 -> mismatch
    });

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache,
      snapshot: mrtSnapshot(assets),
      commands: mrtCommands(),
      label: "frame",
      reuse: resourceReuseReport(),
      customColorTargets: plan,
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: "webGpuApp.customWgslColorTargetsPassIncompatible",
        data: { reason: "size-mismatch" },
      },
    ]);
    // the host pass rendered empty (clear only) rather than encoding a
    // pipeline whose target count mismatches the pass attachments
    const gbufferPass = harness.passDescriptors.find((descriptor) =>
      descriptor.colorAttachments[0]?.view?.label?.includes("gbuffer.albedo"),
    );
    expect(gbufferPass?.colorAttachments).toHaveLength(1);
  });

  it("resolves the declaration into an attachment plan and rejects format mismatches and msaa apps", () => {
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const device = fakeDevice([]);
    const normal = createRenderTargetHandle("gbuffer.normal");
    assets.register(normal);
    assets.markReady(
      normal,
      createRenderTargetAsset({
        width: 8,
        height: 4,
        format: "rgba16float", // declared as rgba8unorm below -> mismatch
        label: "Normal",
      }),
    );

    const mismatch = resolveWebGpuAppCustomMaterialColorTargets({
      assets,
      device,
      state: cache.renderTargets,
      material: mrtPreparedMaterial(),
      pipelineCacheKey: MRT_PIPELINE_KEY,
      passColorFormat: "bgra8unorm",
      appFormat: "bgra8unorm",
      sampleCount: 1,
    });
    expect(mismatch.valid).toBe(false);
    expect(mismatch.diagnostics).toMatchObject([
      { code: "webGpuApp.customWgslColorTargetFormatMismatch" },
    ]);

    const msaa = resolveWebGpuAppCustomMaterialColorTargets({
      assets,
      device,
      state: cache.renderTargets,
      material: mrtPreparedMaterial(),
      pipelineCacheKey: MRT_PIPELINE_KEY,
      passColorFormat: "bgra8unorm",
      appFormat: "bgra8unorm",
      sampleCount: 4,
    });
    expect(msaa.valid).toBe(false);
    expect(msaa.diagnostics).toMatchObject([
      { code: "webGpuApp.customWgslColorTargetsMsaaUnsupported" },
    ]);

    const missing = resolveWebGpuAppCustomMaterialColorTargets({
      assets: new AssetRegistry(),
      device,
      state: createWebGpuAppResourceCache().renderTargets,
      material: mrtPreparedMaterial(),
      pipelineCacheKey: MRT_PIPELINE_KEY,
      passColorFormat: "bgra8unorm",
      appFormat: "bgra8unorm",
      sampleCount: 1,
    });
    expect(missing.valid).toBe(false);
    expect(missing.diagnostics).toMatchObject([
      {
        code: "webGpuApp.customWgslColorTargetUnavailable",
        data: { reason: "unknown" },
      },
    ]);

    // undeclared materials resolve to no plan (single-target path untouched)
    const single = resolveWebGpuAppCustomMaterialColorTargets({
      assets,
      device,
      state: cache.renderTargets,
      material: (() => {
        const base = mrtPreparedMaterial();
        const { colorTargets: _dropped, ...pipeline } = base.pipeline;

        return { ...base, pipeline } as PreparedCustomWgslMaterial;
      })(),
      pipelineCacheKey: MRT_PIPELINE_KEY,
      passColorFormat: "bgra8unorm",
      appFormat: "bgra8unorm",
      sampleCount: 4,
    });
    expect(single.valid).toBe(true);
    expect(single.plan).toBeNull();
    expect(single.diagnostics).toEqual([]);
  });
});

function mrtPreparedMaterial(): PreparedCustomWgslMaterial {
  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: "material:gbuffer",
    materialKey: "material:gbuffer",
    label: "GBuffer Material",
    materialFamily: "example/gbuffer",
    pipelineKey: MRT_PIPELINE_KEY,
    materialResourceKey: "custom-wgsl-bind-group:material:gbuffer",
    bindGroupResourceKey: "custom-wgsl-bind-group:material:gbuffer",
    shader: {
      language: "wgsl",
      moduleKey: "custom-wgsl-module:material:gbuffer",
      sourceKey: "inline:material:gbuffer",
      code: "",
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    pipeline: {
      pipelineKey: MRT_PIPELINE_KEY,
      shaderModuleKey: "custom-wgsl-module:material:gbuffer",
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
      renderState: {
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        cullMode: "back",
        frontFace: "ccw",
        depth: { test: true, write: true, compare: "less" },
        blend: { preset: "none" },
        colorWriteMask: "all",
      },
      instanceAttributes: null,
      colorTargets: [
        { format: "swapchain", writeMask: "all" },
        {
          format: "rgba8unorm",
          writeMask: "all",
          renderTarget: createRenderTargetHandle("gbuffer.normal"),
        },
        {
          format: "rgba8unorm",
          writeMask: "all",
          renderTarget: createRenderTargetHandle("gbuffer.id"),
        },
      ],
    },
    bindGroupLayout: {
      resourceKey: "custom-wgsl-bind-group-layout:material:gbuffer",
      entries: [],
    },
    bindGroup: {
      resourceKey: "custom-wgsl-bind-group:material:gbuffer",
      layoutResourceKey: "custom-wgsl-bind-group-layout:material:gbuffer",
      entries: [],
    },
  };
}

function mrtSetup(
  app: WebGpuApp,
  options: {
    readonly albedoSize?: { readonly width: number; readonly height: number };
  } = {},
): {
  readonly assets: AssetRegistry;
  readonly cache: ReturnType<typeof createWebGpuAppResourceCache>;
  readonly plan: NonNullable<
    ReturnType<typeof resolveWebGpuAppCustomMaterialColorTargets>["plan"]
  >;
} {
  const assets = new AssetRegistry();
  const cache = createWebGpuAppResourceCache();
  const albedo = createRenderTargetHandle("gbuffer.albedo");
  assets.register(albedo);
  assets.markReady(
    albedo,
    createRenderTargetAsset({
      width: options.albedoSize?.width ?? 8,
      height: options.albedoSize?.height ?? 4,
      label: "Albedo",
    }),
  );
  for (const id of ["gbuffer.normal", "gbuffer.id"]) {
    const handle = createRenderTargetHandle(id);
    assets.register(handle);
    assets.markReady(
      handle,
      createRenderTargetAsset({
        width: 8,
        height: 4,
        format: "rgba8unorm",
        label: id,
      }),
    );
  }

  const resolved = resolveWebGpuAppCustomMaterialColorTargets({
    assets,
    device: app.initialization.device,
    state: cache.renderTargets,
    material: mrtPreparedMaterial(),
    pipelineCacheKey: MRT_PIPELINE_KEY,
    passColorFormat: "bgra8unorm",
    appFormat: "bgra8unorm",
    sampleCount: 1,
  });

  expect(resolved.valid).toBe(true);
  expect(resolved.plan).not.toBeNull();

  return {
    assets,
    cache,
    plan: resolved.plan as NonNullable<typeof resolved.plan>,
  };
}

function mrtSnapshot(assets: AssetRegistry): RenderSnapshot {
  const albedo = createRenderTargetHandle("gbuffer.albedo");
  // sanity: the handle must be registered for the offscreen view to resolve
  expect(assets.get(albedo)).toBeDefined();

  return {
    ...baseSnapshot([
      { ...appView({ viewId: 1, renderTarget: albedo }), layerMask: 1 },
      { ...appView({ viewId: 2 }), layerMask: 2 },
    ]),
    meshDraws: [{ renderId: 1, layerMask: 1, batchKey: { pipelineKey: "" } }],
  } as unknown as RenderSnapshot;
}

function mrtCommands(): RenderPassCommand[] {
  return [
    {
      kind: "setPipeline",
      renderId: 1,
      pipelineKey: MRT_PIPELINE_KEY,
      pipeline: { id: "mrt" },
    },
    {
      kind: "draw",
      renderId: 1,
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    },
  ];
}

// ---- shared harness (mirrors forward-user-pass-graph.test.ts) -------------

function fakeDevice(events: string[]): unknown {
  return {
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
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        setViewport: () => {},
        setScissorRect: () => {},
        setPipeline: () => {},
        setBindGroup: () => {},
        setVertexBuffer: () => {},
        draw: () => events.push("draw"),
        end: () => {},
      }),
      beginComputePass: () => ({
        setPipeline: () => {},
        setBindGroup: () => {},
        dispatchWorkgroups: () => {},
        end: () => {},
      }),
      finish: () => ({ label: "command-buffer" }),
    }),
  };
}

function appHarness(events: string[]): {
  readonly app: WebGpuApp;
  readonly registry: ReturnType<typeof createWebGpuAppUserPassRegistry>;
  readonly passDescriptors: RenderPassDescriptorLike[];
} {
  const passDescriptors: RenderPassDescriptorLike[] = [];
  const registry = createWebGpuAppUserPassRegistry();
  const device = fakeDevice(events) as Record<string, unknown>;
  const baseEncoder = device["createCommandEncoder"] as () => Record<
    string,
    unknown
  >;
  device["createCommandEncoder"] = () => {
    const encoder = baseEncoder();
    const beginRenderPass = encoder["beginRenderPass"] as (
      descriptor: unknown,
    ) => unknown;
    encoder["beginRenderPass"] = (descriptor: unknown) => {
      passDescriptors.push(descriptor as RenderPassDescriptorLike);
      return beginRenderPass(descriptor);
    };
    return encoder;
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
    useFrameGraph: true,
    userPassRegistry: registry,
    msaa: {
      requestedSampleCount: 1,
      sampleCount: 1,
      enabled: false,
      clamped: false,
      supportedSampleCounts: [1, 4],
    },
    sceneRenderFormat: "bgra8unorm",
  } as unknown as WebGpuApp;

  return { app, registry, passDescriptors };
}

function baseSnapshot(views: RenderSnapshot["views"]): RenderSnapshot {
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
