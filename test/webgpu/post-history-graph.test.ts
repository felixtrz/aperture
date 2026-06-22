import { describe, expect, it } from "vitest";

import {
  assembleWebGpuAppPostProcessedSwapchainTargetViaGraph,
  createWebGpuAppResourceCache,
  type RenderPassCommand,
  type WebGpuPostEffect,
  type WebGpuPostEffectPrepareOptions,
  type WebGpuPostPassTextureResource,
} from "@aperture-engine/webgpu/test-support";

// M3-T6 Done-when #3 (+ #1/#4 at the route level): route TAA's color history
// through the FrameGraph post path. With motion vectors available the graph
// engages and the TAA node samples last frame's buffer (history 'previous')
// while writing this frame's buffer (history 'current') from a persistent
// double-buffered pool that never grows past two textures and swaps exactly
// once per frame. When motion vectors fall back to a flat clear
// (motionVectorColorFormat null: msaa / sprite+skybox packets / unsupported
// target / missing previous-transform buffer) the graph path declines so the
// legacy path reports the upstream-computed fallback reason unchanged.

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
      finish: () => ({ label: "command-buffer" }),
    }),
  };
}

interface TaaPrepareCapture {
  readonly frame: number;
  readonly output: WebGpuPostPassTextureResource | null;
  readonly history: WebGpuPostPassTextureResource | null;
  readonly motionVector: WebGpuPostPassTextureResource | null;
}

interface PresentPrepareCapture {
  readonly frame: number;
  readonly input: WebGpuPostPassTextureResource | null;
  readonly isLast: boolean;
}

function fakeTaaEffect(captured: TaaPrepareCapture[]): WebGpuPostEffect {
  return {
    id: "taa",
    label: "TAA",
    requiresMotionVectors: true,
    requiresColorHistory: true,
    prepare(options: WebGpuPostEffectPrepareOptions) {
      captured.push({
        frame: options.frame,
        output: options.output ?? null,
        history: options.history ?? null,
        motionVector: options.motionVector ?? null,
      });
      return {
        effectId: "taa",
        label: "TAA",
        commands: [drawCommand(0)],
        diagnostics: [],
      };
    },
  };
}

function fakePresentEffect(
  captured: PresentPrepareCapture[],
): WebGpuPostEffect {
  return {
    id: "taa-present",
    label: "Present",
    prepare(options: WebGpuPostEffectPrepareOptions) {
      captured.push({
        frame: options.frame,
        input: options.input ?? null,
        isLast: options.isLast,
      });
      return {
        effectId: "taa-present",
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

function makeOptions(args: {
  readonly cache: ReturnType<typeof createWebGpuAppResourceCache>;
  readonly frame: number;
  readonly motionVectorColorFormat?: string | null;
  readonly effects: readonly WebGpuPostEffect[];
}): ViaGraphOptions {
  const device = recordingDevice();
  const context = { getCurrentTexture: () => fakeTexture("swapchain") };
  return {
    app: {
      initialization: { device, context },
      sceneRenderFormat: "rgba8unorm",
    },
    cache: args.cache,
    snapshot: { frame: args.frame },
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
    effects: args.effects,
    label: "taa-test",
    clearColor: [0, 0, 0, 1],
    ...(args.motionVectorColorFormat === undefined
      ? {}
      : { motionVectorColorFormat: args.motionVectorColorFormat }),
  } as unknown as ViaGraphOptions;
}

describe("TAA color history through the FrameGraph post path (M3-T6)", () => {
  it("binds history 'previous'=last frame's buffer, writes 'current'=a distinct buffer, pool stays 2, swaps once per frame", () => {
    const cache = createWebGpuAppResourceCache();
    const taa: TaaPrepareCapture[] = [];
    const present: PresentPrepareCapture[] = [];
    const seen = new Set<WebGpuPostPassTextureResource>();
    const FRAMES = 4;

    for (let frame = 0; frame < FRAMES; frame += 1) {
      const result = assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(
        makeOptions({
          cache,
          frame,
          motionVectorColorFormat: "bgra8unorm",
          effects: [fakeTaaEffect(taa), fakePresentEffect(present)],
        }),
      );
      // the graph path engaged (did not decline to legacy)
      expect(result).not.toBeNull();
      const pool = cache.postPasses.taaColorHistory.current?.pool;
      expect(pool).toBeDefined();
      if (pool === undefined) {
        return;
      }
      seen.add(pool.current());
      seen.add(pool.previous());
    }

    // #4 at the route level: exactly two physical history buffers, no leak.
    expect(seen.size).toBe(2);
    // swap happens exactly once per frame, at end-of-execute.
    expect(cache.postPasses.taaColorHistory.current?.pool.swapCount).toBe(
      FRAMES,
    );

    // First frame has no history yet (previous() short-circuits to undefined).
    expect(taa[0]?.history).toBeNull();
    expect(taa[0]?.output).not.toBeNull();
    // Motion vectors are supplied as a scene attachment every frame.
    for (let frame = 0; frame < FRAMES; frame += 1) {
      expect(taa[frame]?.motionVector).not.toBeNull();
    }

    // #1 at the route level: from frame 1 on, the 'previous' read resolves to
    // the buffer written as 'current' last frame, and 'current' targets a
    // DIFFERENT physical texture (no read-write aliasing in any single frame).
    for (let frame = 1; frame < FRAMES; frame += 1) {
      expect(taa[frame]?.history).toBe(taa[frame - 1]?.output);
      expect(taa[frame]?.history).not.toBe(taa[frame]?.output);
    }

    // The present pass samples THIS frame's TAA output (the current buffer) and
    // is the final swapchain write.
    for (let frame = 0; frame < FRAMES; frame += 1) {
      expect(present[frame]?.input).toBe(taa[frame]?.output);
      expect(present[frame]?.isLast).toBe(true);
    }
  });

  it("declines to the legacy path when motion vectors fall back (colorFormat null), leaving the upstream fallback reason unchanged", () => {
    const cache = createWebGpuAppResourceCache();
    // Omitting motionVectorColorFormat models the fallback-clear cases (msaa /
    // sprite+skybox packets / unsupported target / missing buffer): motion
    // vectors are required but unavailable as a scene attachment. The reason is
    // computed upstream in queued-built-in-frame.ts, unchanged by the post path.
    const result = assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(
      makeOptions({
        cache,
        frame: 0,
        effects: [fakeTaaEffect([]), fakePresentEffect([])],
      }),
    );

    // The graph path declines so the legacy path runs the fallback-clear motion
    // pass and reports the same WebGpuAppMotionVectorFallbackReason.
    expect(result).toBeNull();
    // No history pool is allocated when the path bails.
    expect(cache.postPasses.taaColorHistory.current).toBeNull();
  });
});
