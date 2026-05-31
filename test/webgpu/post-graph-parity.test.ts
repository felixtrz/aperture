import { describe, expect, it } from "vitest";

import {
  assembleWebGpuAppPostProcessedSwapchainTarget,
  createWebGpuPostPassTextureCacheSlot,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

// M3-T3 Done-when #3 + the single-encoder win at the app level: feed the SAME
// prepared post effects through assembleWebGpuAppPostProcessedSwapchainTarget on
// both the legacy path (useFrameGraph off) and the FrameGraph path (on). The
// per-effect WebGpuAppPostEffectSubmissionReport[] must be deep-equal, while the
// graph path submits ONE command buffer vs the legacy path's one-per-pass.

type PostOptions = Parameters<
  typeof assembleWebGpuAppPostProcessedSwapchainTarget
>[0];

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

interface Recorder {
  submits: number;
  encoders: number;
}

function fakeDevice(recorder: Recorder) {
  return {
    createTexture: (descriptor: { readonly label?: string }) =>
      fakeTexture(descriptor.label ?? "texture"),
    createCommandEncoder: () => {
      recorder.encoders += 1;
      return {
        beginRenderPass: () => ({
          setPipeline: () => {},
          setBindGroup: () => {},
          setVertexBuffer: () => {},
          setIndexBuffer: () => {},
          draw: () => {},
          drawIndexed: () => {},
          end: () => {},
        }),
        finish: () => ({ label: "command-buffer" }),
      };
    },
    queue: {
      submit: () => {
        recorder.submits += 1;
      },
    },
  };
}

function simpleEffect(id: string, renderId: number) {
  return {
    id,
    prepare: () => ({
      effectId: id,
      label: id,
      commands: [drawCommand(renderId)],
      diagnostics: [],
    }),
  };
}

function postOptions(useFrameGraph: boolean, recorder: Recorder): PostOptions {
  const device = fakeDevice(recorder);
  const app = {
    initialization: {
      device,
      context: { getCurrentTexture: () => fakeTexture("swapchain") },
    },
    sceneRenderFormat: "rgba8unorm",
  };
  const cache = {
    postPasses: {
      scene: createWebGpuPostPassTextureCacheSlot(),
      ping: createWebGpuPostPassTextureCacheSlot(),
      pong: createWebGpuPostPassTextureCacheSlot(),
      motionVector: createWebGpuPostPassTextureCacheSlot(),
      indirectColor: createWebGpuPostPassTextureCacheSlot(),
    },
  };

  return {
    app,
    cache,
    snapshot: { frame: 0 },
    target: {
      source: "swapchain",
      view: { viewId: 7, clearDepth: 1, clearColor: [0, 0, 0, 1] },
      width: 4,
      height: 4,
      format: "rgba8unorm",
    },
    commands: [drawCommand(1)],
    depthAttachment: {
      texture: fakeTexture("depth"),
      width: 4,
      height: 4,
      format: "depth24plus",
      sampleCount: 1,
      view: { label: "depth-view" },
    },
    effects: [simpleEffect("fxaa", 10), simpleEffect("blur", 11)],
    label: "post",
    clearColor: [0, 0, 0, 1],
    useFrameGraph,
  } as unknown as PostOptions;
}

describe("post processing graph-vs-legacy parity (M3-T3)", () => {
  it("produces deep-equal postEffects reports with one command buffer vs many", () => {
    const legacyRecorder: Recorder = { submits: 0, encoders: 0 };
    const legacy = assembleWebGpuAppPostProcessedSwapchainTarget(
      postOptions(false, legacyRecorder),
    );

    const graphRecorder: Recorder = { submits: 0, encoders: 0 };
    const graph = assembleWebGpuAppPostProcessedSwapchainTarget(
      postOptions(true, graphRecorder),
    );

    // both paths run the same prepared effects
    expect(legacy.valid).toBe(true);
    expect(graph.valid).toBe(true);

    // Done-when #3: identical per-effect submission reports
    expect(graph.postEffects).toEqual(legacy.postEffects);
    expect(graph.postEffects).toHaveLength(2);
    expect(graph.postEffects[0]).toMatchObject({
      effectId: "fxaa",
      output: "offscreen",
      ok: true,
    });
    expect(graph.postEffects[1]).toMatchObject({
      effectId: "blur",
      output: "swapchain",
      ok: true,
    });

    // identical key metrics: same render-target draw count + planned commands
    expect(graph.renderTarget.drawCalls).toBe(legacy.renderTarget.drawCalls);
    expect(graph.plannedCommands).toBe(legacy.plannedCommands);
    expect(graph.drawCalls).toBe(legacy.drawCalls);

    // the win: ONE command buffer (graph) vs one-per-pass (legacy: scene + 2 fx)
    expect(graphRecorder.submits).toBe(1);
    expect(graphRecorder.encoders).toBe(1);
    expect(legacyRecorder.submits).toBe(3);
    expect(legacyRecorder.encoders).toBe(3);
  });
});
