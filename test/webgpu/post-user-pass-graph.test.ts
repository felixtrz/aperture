import { describe, expect, it } from "vitest";

import {
  assembleWebGpuAppPostProcessedSwapchainTargetViaGraph,
  createWebGpuAppResourceCache,
  createWebGpuAppUserPassRegistry,
  type RenderPassCommand,
  type WebGpuPostEffect,
  type WebGpuPostEffectPrepareOptions,
} from "@aperture-engine/webgpu/test-support";

// M3-T7 — user passes (app.addRenderPass / app.addComputePass) execute through
// the single-encoder graph post path. A compute pass (reads scene-color, writes
// a buffer) and a depth-tested render overlay (reads depth, writes scene-color)
// are inserted AFTER the scene node and BEFORE the post effects; they fold into
// the one command buffer, run their commands in-frame, and appear in the
// additive status.graph report in dependency order (Done-when #1 ordering + #2
// in-frame compute mechanism, at the route level).

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

function fakeTexture(label: string) {
  return { label, createView: () => ({ label: `${label}:view` }) };
}

function recordingDevice() {
  return {
    queue: { submit: () => {} },
    createTexture: (descriptor: { readonly label?: string }) =>
      fakeTexture(descriptor.label ?? "texture"),
    createBindGroup: () => ({ bindGroup: true }),
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        setPipeline: () => {},
        setBindGroup: () => {},
        setVertexBuffer: () => {},
        setIndexBuffer: () => {},
        setViewport: () => {},
        setScissorRect: () => {},
        draw: () => {},
        drawIndexed: () => {},
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

// A minimal present effect so the post graph stays engaged (effects.length > 0).
function fakePresentEffect(): WebGpuPostEffect {
  return {
    id: "present",
    label: "Present",
    prepare(_options: WebGpuPostEffectPrepareOptions) {
      return {
        effectId: "present",
        label: "Present",
        commands: [drawCommand(0)],
        diagnostics: [],
      };
    },
  };
}

type ViaGraphOptions = Parameters<
  typeof assembleWebGpuAppPostProcessedSwapchainTargetViaGraph
>[0];

function makeOptions(
  registry: ReturnType<typeof createWebGpuAppUserPassRegistry>,
): ViaGraphOptions {
  const device = recordingDevice();
  const context = { getCurrentTexture: () => fakeTexture("swapchain") };
  return {
    app: {
      initialization: { device, context },
      sceneRenderFormat: "rgba8unorm",
      userPassRegistry: registry,
    },
    cache: createWebGpuAppResourceCache(),
    snapshot: { frame: 0 },
    target: {
      source: "swapchain",
      view: { viewId: 0, clearDepth: 1, clearColor: [0, 0, 0, 1] },
      width: 8,
      height: 8,
      format: "bgra8unorm",
    },
    commands: [drawCommand(1)],
    depthAttachment: {
      texture: fakeTexture("depth"),
      view: { label: "depth:view" },
      width: 8,
      height: 8,
      format: "depth24plus",
      sampleCount: 1,
    },
    effects: [fakePresentEffect()],
    label: "custom-graph-pass",
    clearColor: [0, 0, 0, 1],
  } as unknown as ViaGraphOptions;
}

describe("user passes through the graph post path (M3-T7)", () => {
  it("inserts a compute + a render overlay after the scene node, executes them in one encoder, and reports the order", () => {
    const registry = createWebGpuAppUserPassRegistry();
    registry.addComputePass({
      name: "luminance-histogram",
      reads: ["scene-color"],
      writes: [{ handle: "histogram-buffer" }],
      encode(ctx) {
        ctx.setComputePipeline({ id: "histogram" });
        ctx.setBindGroup(0, ctx.bindings({ src: ctx.view("scene-color") }));
        ctx.dispatchWorkgroups(4, 4, 1);
      },
    });
    registry.addRenderPass({
      name: "wireframe-overlay",
      after: "opaque",
      reads: ["depth"],
      writes: [{ handle: "scene-color", attachment: "load" }],
      encode(ctx) {
        // a depth-tested overlay drawing over the scene
        ctx.setPipeline({ id: "wireframe" });
        ctx.draw(6);
      },
    });

    const result = assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(
      makeOptions(registry),
    );

    expect(result).not.toBeNull();
    if (result === null) {
      return;
    }
    expect(result.graph).toBeDefined();
    const order = result.graph?.order ?? [];
    const sceneIndex = order.findIndex((name) => name.endsWith(":scene"));
    const overlayIndex = order.indexOf("wireframe-overlay");
    const computeIndex = order.indexOf("luminance-histogram");
    const presentIndex = order.findIndex((name) => name.includes(":present"));

    // both user passes are present, AFTER the scene (opaque) node...
    expect(sceneIndex).toBeGreaterThanOrEqual(0);
    expect(overlayIndex).toBeGreaterThan(sceneIndex);
    expect(computeIndex).toBeGreaterThan(sceneIndex);
    // ...and the overlay runs BEFORE the present (first post) node, since the
    // present samples the scene-color the overlay wrote.
    expect(presentIndex).toBeGreaterThan(overlayIndex);

    // the compute pass ran its dispatch in-frame (executedCommands > 0)
    const computeReport = result.graph?.userPasses.find(
      (pass) => pass.name === "luminance-histogram",
    );
    expect(computeReport?.kind).toBe("compute");
    expect(computeReport?.ran).toBe(true);
    expect(computeReport?.executedCommands ?? 0).toBeGreaterThan(0);

    // the overlay ran its draw in-frame
    const overlayReport = result.graph?.userPasses.find(
      (pass) => pass.name === "wireframe-overlay",
    );
    expect(overlayReport?.kind).toBe("render");
    expect(overlayReport?.ran).toBe(true);
  });

  it("inserts nothing when no user passes are registered (graph report empty)", () => {
    const registry = createWebGpuAppUserPassRegistry();
    const result = assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(
      makeOptions(registry),
    );
    expect(result).not.toBeNull();
    expect(result?.graph?.userPasses ?? []).toHaveLength(0);
  });
});
