import { describe, expect, it } from "vitest";

import {
  assembleFrameBoundary,
  buildFrameBoundaryTargetPlan,
  compileFrameGraph,
  createFrameGraph,
  executeFrameGraph,
  type FrameGraphRenderNodeBoundary,
  type FrameGraphResources,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

// M3-T3 Done-when #2 (vitest variant): a scene + bloom(down/up/composite) post
// stack assembled through the FrameGraph submits exactly ONE command buffer,
// where the legacy assembleFrameBoundary-per-pass path submits one PER pass
// (>= 4). Both paths build their attachments through the SAME
// buildFrameBoundaryTargetPlan helper, so only the encoder/submit count differs
// — the single-encoder win, proven with the fake-device recorder.

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

function offscreenTexture(label: string) {
  return { createView: () => ({ label: `${label}:view` }) };
}

function recordingDevice(events: string[]) {
  return {
    createCommandEncoder: () => {
      events.push("createCommandEncoder");
      return {
        beginRenderPass: () => ({
          setPipeline: () => {},
          setBindGroup: () => {},
          setVertexBuffer: () => {},
          setIndexBuffer: () => {},
          draw: () => events.push("draw"),
          drawIndexed: () => events.push("draw"),
          end: () => {},
        }),
        finish: () => {
          events.push("finish");
          return { label: "command-buffer" };
        },
      };
    },
  };
}

function swapchainContext() {
  return {
    getCurrentTexture: () => offscreenTexture("swapchain"),
  };
}

// the four post passes, each described by the same boundary options both paths
// consume (scene + 2 bloom intermediates off-screen, composite to swapchain).
function postPassBoundaryOptions(device: unknown, context: unknown) {
  return [
    {
      name: "scene",
      reads: [] as string[],
      write: "scene-color",
      boundary: {
        context,
        colorTarget: {
          source: "offscreen-target" as const,
          texture: offscreenTexture("scene"),
        },
        clearColor: [0, 0, 0, 1],
        commands: [drawCommand(1)],
        label: "scene",
        device,
      },
    },
    {
      name: "bloom-down",
      reads: ["scene-color"],
      write: "bloom-half",
      boundary: {
        context,
        colorTarget: {
          source: "offscreen-target" as const,
          texture: offscreenTexture("bloom-half"),
        },
        clearColor: [0, 0, 0, 1],
        commands: [drawCommand(2)],
        label: "bloom-down",
        device,
      },
    },
    {
      name: "bloom-up",
      reads: ["bloom-half"],
      write: "bloom-full",
      boundary: {
        context,
        colorTarget: {
          source: "offscreen-target" as const,
          texture: offscreenTexture("bloom-full"),
        },
        clearColor: [0, 0, 0, 1],
        commands: [drawCommand(3)],
        label: "bloom-up",
        device,
      },
    },
    {
      name: "composite",
      reads: ["bloom-full", "scene-color"],
      write: "swapchain",
      boundary: {
        context,
        clearColor: [0, 0, 0, 1],
        commands: [drawCommand(4)],
        label: "composite",
        device,
      },
    },
  ];
}

describe("post stack via frame graph (M3-T3)", () => {
  it("submits ONE command buffer for scene+bloom vs the legacy path's one-per-pass", () => {
    const graphEvents: string[] = [];
    const graphDevice = recordingDevice(graphEvents);
    const context = swapchainContext();
    const passes = postPassBoundaryOptions(graphDevice, context);

    // ---- graph path: build nodes + payloads, execute ONCE ----
    const graph = createFrameGraph();
    const colorDesc = {
      kind: "color-texture" as const,
      width: 8,
      height: 8,
      format: "rgba8unorm",
      sampleCount: 1,
    };
    graph.declareTransient("scene-color", colorDesc);
    graph.declareTransient("bloom-half", colorDesc);
    graph.declareTransient("bloom-full", colorDesc);
    graph.importSwapchain();

    const payloads = new Map<string, FrameGraphRenderNodeBoundary>();
    for (const pass of passes) {
      const plan = buildFrameBoundaryTargetPlan({
        context: pass.boundary.context as Parameters<
          typeof buildFrameBoundaryTargetPlan
        >[0]["context"],
        ...(pass.boundary.colorTarget === undefined
          ? {}
          : { colorTarget: pass.boundary.colorTarget }),
        clearColor: pass.boundary.clearColor,
      });
      graph.addRenderPass({
        name: pass.name,
        reads: pass.reads,
        writes: [{ handle: pass.write, attachment: "clear" }],
        commands: pass.boundary.commands,
      });
      payloads.set(pass.name, {
        device: graphDevice,
        attachments: plan.attachments,
        commands: pass.boundary.commands,
        label: pass.name,
        colorTargetSource:
          pass.boundary.colorTarget === undefined
            ? "current-texture"
            : "offscreen-target",
        readbackTexture: plan.texture.texture,
      });
    }

    const resources: FrameGraphResources = {
      resolveAttachment: () => null,
      resolveRenderBoundary: (node) => payloads.get(node.name) ?? null,
    };

    const exec = executeFrameGraph({
      device: graphDevice,
      queue: {
        submit: (buffers) => graphEvents.push(`submit:${buffers.length}`),
      },
      compiled: compileFrameGraph(graph),
      resources,
      label: "post",
    });

    // exactly one encoder, one finish, one submit, all four draws inside it
    expect(
      graphEvents.filter((e) => e === "createCommandEncoder"),
    ).toHaveLength(1);
    expect(graphEvents.filter((e) => e === "finish")).toHaveLength(1);
    expect(graphEvents.filter((e) => e.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    expect(graphEvents.filter((e) => e === "draw")).toHaveLength(4);
    expect(exec.valid).toBe(true);
    expect(exec.metrics.counts.commandBuffers).toBe(1);
    expect(exec.metrics.counts.submittedCommandBuffers).toBe(1);
    expect(exec.metrics.counts.drawCalls).toBe(4);

    // ---- legacy path: assembleFrameBoundary per pass = one submit per pass ----
    const legacyEvents: string[] = [];
    const legacyDevice = recordingDevice(legacyEvents);
    const legacyContext = swapchainContext();
    const legacyPasses = postPassBoundaryOptions(legacyDevice, legacyContext);
    for (const pass of legacyPasses) {
      assembleFrameBoundary({
        context: pass.boundary.context as Parameters<
          typeof assembleFrameBoundary
        >[0]["context"],
        device: legacyDevice as Parameters<
          typeof assembleFrameBoundary
        >[0]["device"],
        queue: {
          submit: (buffers) => legacyEvents.push(`submit:${buffers.length}`),
        },
        commands: pass.boundary.commands,
        label: pass.name,
        ...(pass.boundary.colorTarget === undefined
          ? {}
          : { colorTarget: pass.boundary.colorTarget }),
        clearColor: pass.boundary.clearColor,
      });
    }

    const legacySubmits = legacyEvents.filter((e) => e.startsWith("submit:"));
    const legacyEncoders = legacyEvents.filter(
      (e) => e === "createCommandEncoder",
    );
    // legacy assembles + submits each pass independently: >= 4 command buffers
    expect(legacySubmits).toEqual([
      "submit:1",
      "submit:1",
      "submit:1",
      "submit:1",
    ]);
    expect(legacyEncoders).toHaveLength(4);
    // the win: 1 command buffer (graph) vs 4 (legacy) for the identical stack
    expect(exec.metrics.counts.commandBuffers).toBeLessThan(
      legacySubmits.length,
    );
  });
});
