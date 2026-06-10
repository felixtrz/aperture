import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createRenderTargetHandle,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuAppResourceCache,
  createWebGpuAppUserPassRegistry,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";
import { assembleWebGpuAppFrameBoundaries } from "../../packages/webgpu/src/app/frame-boundaries.js";
import type {
  WebGpuApp,
  WebGpuAppResourceReuseReport,
} from "../../packages/webgpu/src/app/app.js";

// AI-12 — the public user-pass API (app.addRenderPass / app.addComputePass)
// executes on the FORWARD (no-post) FrameGraph route, mirroring the post
// route's wiring: a user render pass is a depth-tested overlay drawn over the
// presented swapchain target with LOAD, a user compute pass runs on the same
// shared encoder (one submit), ordering follows registry insertion order plus
// before/after sugar, non-scene-color render writes coerce loudly, and a frame
// with no registered passes is byte-identical to before. The legacy
// multi-submit route reads the registry too — to surface a structured
// diagnostic instead of silently no-oping.

interface RenderPassDescriptorLike {
  readonly colorAttachments: readonly {
    readonly view?: { readonly label?: string };
    readonly loadOp?: string;
  }[];
  readonly depthStencilAttachment?: {
    readonly view?: unknown;
    readonly depthLoadOp?: string;
    readonly depthStoreOp?: string;
  };
}

describe("forward-route user passes (AI-12)", () => {
  it("runs a render overlay + compute pass in the single forward submit and reports the graph order", async () => {
    const events: string[] = [];
    const harness = appHarness(events);
    const resolvedViews: string[] = [];

    harness.registry.addRenderPass({
      name: "wireframe-overlay",
      after: "opaque",
      reads: ["depth"],
      writes: [{ handle: "scene-color", attachment: "load" }],
      encode(ctx) {
        ctx.setPipeline({ id: "wireframe" });
        ctx.draw(6);
      },
    });
    harness.registry.addComputePass({
      name: "luminance-histogram",
      reads: ["scene-color"],
      writes: [{ handle: "histogram-buffer" }],
      encode(ctx) {
        ctx.setComputePipeline({ id: "histogram" });
        ctx.setBindGroup(
          0,
          ctx.bindings({
            src: (() => {
              resolvedViews.push("scene-color");
              return ctx.view("scene-color");
            })(),
          }),
        );
        ctx.dispatchWorkgroups(4, 4, 1);
      },
    });

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
    // ONE encoder / ONE submit for the forward target + both user passes.
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    // the overlay drew and the compute dispatched in-frame
    expect(events.filter((event) => event === "draw")).toHaveLength(2);
    expect(events).toContain("dispatch");
    // user passes registered their resolvers ("scene-color" resolved to a view)
    expect(resolvedViews).toEqual(["scene-color"]);

    // the graph report on the presented target: forward node first, then the
    // user passes in insertion order, each marked ran with executed commands.
    const graph = result.renderTargets[0]?.graph;
    expect(graph).toBeDefined();
    const order = graph?.order ?? [];
    const forwardIndex = order.findIndex((name) => name.includes(":fg:"));
    expect(forwardIndex).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("wireframe-overlay")).toBeGreaterThan(forwardIndex);
    expect(order.indexOf("luminance-histogram")).toBeGreaterThan(forwardIndex);
    expect(graph?.userPasses).toMatchObject([
      { name: "wireframe-overlay", kind: "render", ran: true },
      { name: "luminance-histogram", kind: "compute", ran: true },
    ]);
    expect(graph?.userPasses.every((pass) => pass.executedCommands > 0)).toBe(
      true,
    );

    // the overlay pass LOADs the swapchain color AND the forward depth (a
    // depth-tested overlay over the already-rendered scene).
    expect(harness.passDescriptors).toHaveLength(2);
    const forwardPass = harness.passDescriptors[0];
    const overlayPass = harness.passDescriptors[1];
    expect(forwardPass?.colorAttachments[0]?.loadOp).toBe("clear");
    expect(overlayPass?.colorAttachments[0]?.loadOp).toBe("load");
    expect(overlayPass?.colorAttachments[0]?.view).toMatchObject({
      label: "swapchain-view",
    });
    expect(overlayPass?.depthStencilAttachment?.view).toBe(
      forwardPass?.depthStencilAttachment?.view,
    );
    expect(overlayPass?.depthStencilAttachment?.depthLoadOp).toBe("load");

    // planned counts include the user commands (forward draw + overlay
    // setPipeline/draw + compute pipeline/bind/dispatch), draw calls the overlay.
    expect(result.plannedCommands).toBe(6);
    expect(result.drawCalls).toBe(2);
    // user render passes synthesize a legacy-compatible boundary
    expect(result.boundaries).toHaveLength(2);
    expect(result.boundaries[1]?.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("still draws a render pass that writes a non-scene-color handle and emits the coercion diagnostic", async () => {
    const events: string[] = [];
    const harness = appHarness(events);

    harness.registry.addRenderPass({
      name: "history-overlay",
      reads: [],
      writes: [{ handle: "history-color", attachment: "clear" }],
      encode(ctx) {
        ctx.setPipeline({ id: "history" });
        ctx.draw(3);
      },
    });

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
    // drawn over scene-color with LOAD rather than dropped...
    expect(events.filter((event) => event === "draw")).toHaveLength(2);
    expect(harness.passDescriptors[1]?.colorAttachments[0]?.loadOp).toBe(
      "load",
    );
    expect(result.renderTargets[0]?.graph?.userPasses).toMatchObject([
      { name: "history-overlay", kind: "render", ran: true },
    ]);
    // ...with the structured coercion diagnostic (loud, not silent).
    expect(result.diagnostics).toMatchObject([
      {
        code: "webgpu.userPass.renderWriteCoercedToSceneColor",
        severity: "warning",
        data: { pass: "history-overlay", coercedWrites: ["history-color"] },
      },
    ]);
  });

  it("orders user passes by registry insertion order and honors before/after sugar", async () => {
    const insertion = appHarness([]);
    insertion.registry.addRenderPass({
      name: "overlay-a",
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });
    insertion.registry.addRenderPass({
      name: "overlay-b",
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });

    const inOrder = await assembleWebGpuAppFrameBoundaries({
      app: insertion.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });
    const insertionOrder = inOrder.renderTargets[0]?.graph?.order ?? [];
    expect(insertionOrder.indexOf("overlay-a")).toBeGreaterThanOrEqual(0);
    expect(insertionOrder.indexOf("overlay-b")).toBeGreaterThan(
      insertionOrder.indexOf("overlay-a"),
    );

    // before/after sugar compiles to an edge: a compute pass registered AFTER
    // the overlay but declaring before:"overlay-late" must run before it.
    const sugar = appHarness([]);
    sugar.registry.addRenderPass({
      name: "overlay-late",
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });
    sugar.registry.addComputePass({
      name: "histogram-early",
      before: "overlay-late",
      reads: ["scene-color"],
      writes: [{ handle: "histogram-buffer" }],
      encode(ctx) {
        ctx.setComputePipeline({});
        ctx.dispatchWorkgroups(1, 1, 1);
      },
    });

    const sugared = await assembleWebGpuAppFrameBoundaries({
      app: sugar.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });
    const sugaredOrder = sugared.renderTargets[0]?.graph?.order ?? [];
    expect(sugaredOrder.indexOf("histogram-early")).toBeGreaterThanOrEqual(0);
    expect(sugaredOrder.indexOf("histogram-early")).toBeLessThan(
      sugaredOrder.indexOf("overlay-late"),
    );
  });

  it("leaves a no-user-pass forward frame untouched (no extra nodes, no graph report, one submit)", async () => {
    const events: string[] = [];
    const harness = appHarness(events);

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
    // exactly the two target passes — no user-pass node was inserted
    expect(harness.passDescriptors).toHaveLength(2);
    expect(result.boundaries).toHaveLength(2);
    expect(events.filter((event) => event === "encoder")).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    // the renderTarget reports carry NO graph field (report byte-identical)
    expect(result.renderTargets.every((target) => !("graph" in target))).toBe(
      true,
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("emits the structured skippedOnLegacyRoute diagnostic instead of running passes on the legacy route", async () => {
    const events: string[] = [];
    const harness = appHarness(events, { useFrameGraph: false });
    harness.registry.addRenderPass({
      name: "wireframe-overlay",
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });
    harness.registry.addRenderPass({
      name: "disabled-overlay",
      enabled: false,
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets: new AssetRegistry(),
      cache: createWebGpuAppResourceCache(),
      snapshot: appSnapshot([appView({ viewId: 1 })]),
      commands: [drawCommand(1)],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    // the frame renders, but the user pass did NOT run...
    expect(result.valid).toBe(true);
    expect(events.filter((event) => event === "draw")).toHaveLength(1);
    expect(result.boundaries).toHaveLength(1);
    // ...and the skip is loud, naming only the enabled pass.
    expect(result.diagnostics).toMatchObject([
      {
        code: "webgpu.userPass.skippedOnLegacyRoute",
        severity: "warning",
        data: { passes: ["wireframe-overlay"] },
      },
    ]);
  });

  it("skips loudly when the forward graph frame has no swapchain target to host user passes", async () => {
    const events: string[] = [];
    const harness = appHarness(events);
    harness.registry.addRenderPass({
      name: "wireframe-overlay",
      writes: ["scene-color"],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });

    const renderTarget = createRenderTargetHandle("probe");
    const assets = new AssetRegistry();
    assets.register(renderTarget);
    assets.markReady(renderTarget, {
      texture: { createView: () => ({ label: "offscreen-view" }) },
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
    expect(events.filter((event) => event === "draw")).toHaveLength(1);
    expect(result.diagnostics).toMatchObject([
      {
        code: "webgpu.userPass.forwardTargetUnavailable",
        severity: "warning",
        data: { passes: ["wireframe-overlay"] },
      },
    ]);
  });
});

describe("forward graph multi-target command isolation", () => {
  it("encodes each target's own view-filtered commands, not the last view's", async () => {
    const events: string[] = [];
    const harness = appHarness(events);

    const renderTarget = createRenderTargetHandle("offscreen");
    const assets = new AssetRegistry();
    assets.register(renderTarget);
    assets.markReady(renderTarget, {
      texture: { createView: () => ({ label: "offscreen-view" }) },
      width: 16,
      height: 8,
      format: "bgra8unorm",
    });

    // Two views on disjoint layers: view 1 renders layer-1 into the off-screen
    // target, view 2 renders layer-2 onto the swapchain.
    const snapshot = {
      ...appSnapshot([
        { ...appView({ viewId: 1, renderTarget }), layerMask: 1 },
        { ...appView({ viewId: 2 }), layerMask: 2 },
      ]),
      meshDraws: [
        { renderId: 1, layerMask: 1, batchKey: { pipelineKey: "" } },
        { renderId: 2, layerMask: 2, batchKey: { pipelineKey: "" } },
      ],
    } as unknown as RenderSnapshot;

    const result = await assembleWebGpuAppFrameBoundaries({
      app: harness.app,
      assets,
      cache: createWebGpuAppResourceCache(),
      snapshot,
      commands: [
        {
          kind: "draw",
          renderId: 1,
          vertexCount: 3,
          instanceCount: 1,
          firstVertex: 0,
          firstInstance: 0,
        },
        {
          kind: "draw",
          renderId: 2,
          vertexCount: 6,
          instanceCount: 1,
          firstVertex: 0,
          firstInstance: 0,
        },
      ],
      label: "frame",
      reuse: resourceReuseReport(),
    });

    expect(result.valid).toBe(true);

    const offscreenPass = harness.passes.find(
      (pass) =>
        pass.descriptor.colorAttachments?.[0]?.view?.label === "offscreen-view",
    );
    const swapchainPass = harness.passes.find(
      (pass) =>
        pass.descriptor.colorAttachments?.[0]?.view?.label === "swapchain-view",
    );
    expect(offscreenPass).toBeDefined();
    expect(swapchainPass).toBeDefined();

    // Graph nodes encode AFTER the per-target assembly loop, so each node's
    // payload must snapshot its view-filtered commands instead of aliasing the
    // shared frame scratch — aliasing replays the LAST view's commands into
    // every attachment (the render-to-texture mixed-target regression).
    expect(offscreenPass?.draws).toEqual([3]);
    expect(swapchainPass?.draws).toEqual([6]);
  });
});

function appHarness(
  events: string[],
  options: {
    readonly useFrameGraph?: boolean;
  } = {},
): {
  readonly app: WebGpuApp;
  readonly registry: ReturnType<typeof createWebGpuAppUserPassRegistry>;
  readonly passDescriptors: RenderPassDescriptorLike[];
  readonly passes: {
    readonly descriptor: RenderPassDescriptorLike;
    readonly draws: number[];
  }[];
} {
  const passDescriptors: RenderPassDescriptorLike[] = [];
  const passes: {
    readonly descriptor: RenderPassDescriptorLike;
    readonly draws: number[];
  }[] = [];
  const registry = createWebGpuAppUserPassRegistry();
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
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: () => {
      events.push("encoder");
      return {
        beginRenderPass: (descriptor: unknown) => {
          events.push("begin");
          passDescriptors.push(descriptor as RenderPassDescriptorLike);
          const pass = {
            descriptor: descriptor as RenderPassDescriptorLike,
            draws: [] as number[],
          };
          passes.push(pass);
          return {
            setViewport: () => {},
            setScissorRect: () => {},
            setPipeline: () => events.push("setPipeline"),
            setBindGroup: () => events.push("setBindGroup"),
            setVertexBuffer: () => events.push("setVertexBuffer"),
            draw: (vertexCount?: number) => {
              events.push("draw");
              pass.draws.push(vertexCount ?? 0);
            },
            end: () => events.push("end"),
          };
        },
        beginComputePass: () => {
          events.push("beginCompute");
          return {
            setPipeline: () => {},
            setBindGroup: () => {},
            dispatchWorkgroups: () => events.push("dispatch"),
            end: () => events.push("endCompute"),
          };
        },
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
    postEffects: [],
    useFrameGraph: options.useFrameGraph ?? true,
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

  return { app, registry, passDescriptors, passes };
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
