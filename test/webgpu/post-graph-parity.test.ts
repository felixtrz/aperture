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

interface PreparedFormatRecord {
  readonly id: string;
  readonly inputFormat: string;
  readonly outputFormat: string;
  readonly outputResourceFormat: string | null;
  readonly isLast: boolean;
}

function formatCapturingEffect(
  id: string,
  renderId: number,
  records: PreparedFormatRecord[],
) {
  return {
    id,
    prepare: (options: {
      readonly input: { readonly format: string };
      readonly outputFormat: string;
      readonly output?: { readonly format: string };
      readonly isLast: boolean;
    }) => {
      records.push({
        id,
        inputFormat: options.input.format,
        outputFormat: options.outputFormat,
        outputResourceFormat: options.output?.format ?? null,
        isLast: options.isLast,
      });
      return {
        effectId: id,
        label: id,
        commands: [drawCommand(renderId)],
        diagnostics: [],
      };
    },
  };
}

function fakeTextureResource(label: string, width: number, height: number) {
  return {
    texture: fakeTexture(label),
    width,
    height,
    format: "rgba8unorm",
    label,
  };
}

// A bloom-style effect: prepare() returns a multi-pass graph (down/up/composite),
// the path the real post-effects example exercises through the graph branch.
function bloomEffect(id: string) {
  return {
    id,
    prepare: (input: { readonly isLast: boolean }) => ({
      effectId: id,
      label: id,
      commands: [],
      diagnostics: [],
      graph: {
        passes: [
          {
            label: `${id}:down`,
            kind: "downsample",
            output: "offscreen",
            outputResource: fakeTextureResource(`${id}:half`, 2, 2),
            width: 2,
            height: 2,
            commands: [drawCommand(20)],
            diagnostics: [],
          },
          {
            label: `${id}:up`,
            kind: "upsample",
            output: "offscreen",
            outputResource: fakeTextureResource(`${id}:full`, 4, 4),
            width: 4,
            height: 4,
            commands: [drawCommand(21)],
            diagnostics: [],
          },
          {
            label: `${id}:composite`,
            kind: "composite",
            output: input.isLast ? "swapchain" : "offscreen",
            ...(input.isLast
              ? {}
              : { outputResource: fakeTextureResource(`${id}:out`, 4, 4) }),
            width: 4,
            height: 4,
            commands: [drawCommand(22)],
            diagnostics: [],
          },
        ],
        report: {
          topology: "downsample-upsample",
          passCount: 3,
          resourceCount: 2,
          downsamplePasses: 1,
          upsamplePasses: 1,
          compositePasses: 1,
          levels: [
            { width: 2, height: 2 },
            { width: 4, height: 4 },
          ],
        },
      },
    }),
  };
}

function postOptions(
  useFrameGraph: boolean,
  recorder: Recorder,
  effects: readonly unknown[] = [
    simpleEffect("fxaa", 10),
    simpleEffect("blur", 11),
  ],
  sceneRenderFormat = "rgba8unorm",
): PostOptions {
  const device = fakeDevice(recorder);
  const app = {
    initialization: {
      device,
      context: { getCurrentTexture: () => fakeTexture("swapchain") },
    },
    sceneRenderFormat,
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
    effects,
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

  it("matches for a multi-pass bloom effect (graph-pass expansion) in one encoder", () => {
    const effects = [simpleEffect("fxaa", 10), bloomEffect("bloom")];

    const legacyRecorder: Recorder = { submits: 0, encoders: 0 };
    const legacy = assembleWebGpuAppPostProcessedSwapchainTarget(
      postOptions(false, legacyRecorder, effects),
    );

    const graphRecorder: Recorder = { submits: 0, encoders: 0 };
    const graph = assembleWebGpuAppPostProcessedSwapchainTarget(
      postOptions(true, graphRecorder, effects),
    );

    expect(legacy.valid).toBe(true);
    expect(graph.valid).toBe(true);

    // Done-when #3 across the graph-pass path: identical reports incl. the bloom
    // effect's expanded draw count (down+up+composite = 3) + its graph sub-report.
    expect(graph.postEffects).toEqual(legacy.postEffects);
    expect(graph.postEffects[1]).toMatchObject({
      effectId: "bloom",
      output: "swapchain",
      ok: true,
      drawCalls: 3,
    });
    expect(graph.postEffects[1]?.graph).toMatchObject({
      topology: "downsample-upsample",
      passCount: 3,
    });

    // scene + fxaa + 3 bloom passes = 5 legacy submits, collapsed to ONE
    expect(graphRecorder.submits).toBe(1);
    expect(graphRecorder.encoders).toBe(1);
    expect(legacyRecorder.submits).toBe(5);
    expect(legacyRecorder.encoders).toBe(5);
  });

  it("keeps non-final post effects in the HDR scene format", () => {
    for (const useFrameGraph of [false, true]) {
      const records: PreparedFormatRecord[] = [];
      const recorder: Recorder = { submits: 0, encoders: 0 };
      const result = assembleWebGpuAppPostProcessedSwapchainTarget(
        postOptions(
          useFrameGraph,
          recorder,
          [
            formatCapturingEffect("bloom-like", 20, records),
            formatCapturingEffect("tonemap-like", 21, records),
          ],
          "rgba16float",
        ),
      );

      expect(result.valid).toBe(true);
      expect(records).toEqual([
        {
          id: "bloom-like",
          inputFormat: "rgba16float",
          outputFormat: "rgba16float",
          outputResourceFormat: "rgba16float",
          isLast: false,
        },
        {
          id: "tonemap-like",
          inputFormat: "rgba16float",
          outputFormat: "rgba8unorm",
          outputResourceFormat: null,
          isLast: true,
        },
      ]);
    }
  });
});
