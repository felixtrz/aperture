import { describe, expect, it } from "vitest";

import {
  createOrReuseWebGpuPostPassTexture,
  createWebGpuBloomPostEffect,
  createWebGpuCopyPostEffect,
  createWebGpuDofPostEffect,
  createWebGpuFxaaPostEffect,
  createWebGpuPostPassTextureCacheSlot,
  createWebGpuSsaoPostEffect,
  createWebGpuSsrPostEffect,
  createWebGpuTaaPostEffect,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU post-pass helpers", () => {
  it("prepares a copy/no-op post effect as a full-screen draw", () => {
    const events: string[] = [];
    const effect = createWebGpuCopyPostEffect({ id: "noop", label: "Noop" });
    const input = {
      texture: {
        createView: () => {
          events.push("input:view");
          return { view: "input" };
        },
      },
      width: 16,
      height: 16,
      format: "rgba8unorm",
      label: "input",
    };
    const prepared = effect.prepare({
      device: postDevice(events),
      input,
      outputFormat: "rgba8unorm",
      width: 16,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-post",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared).toMatchObject({
      effectId: "noop",
      label: "Noop",
      commands: [
        { kind: "setPipeline" },
        { kind: "setBindGroup", index: 0 },
        { kind: "draw", vertexCount: 3 },
      ],
    });
    expect(events).toEqual([
      "device:shader:test-post:noop:pipeline:shader",
      "device:pipeline:test-post:noop:pipeline",
      "device:sampler:aperture/post/noop/sampler",
      "input:view",
      "pipeline:layout:0",
      "device:bindGroup:test-post:noop:bind-group",
    ]);
  });

  it("reuses intermediate textures when dimensions and format are unchanged", () => {
    const events: string[] = [];
    const slot = createWebGpuPostPassTextureCacheSlot();
    const first = createOrReuseWebGpuPostPassTexture({
      device: textureDevice(events),
      slot,
      width: 32,
      height: 16,
      format: "bgra8unorm",
      label: "post-a",
    });
    const second = createOrReuseWebGpuPostPassTexture({
      device: textureDevice(events),
      slot,
      width: 32,
      height: 16,
      format: "bgra8unorm",
      label: "post-b",
    });

    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(second.resource).toBe(first.resource);
    expect(events).toEqual(["device:texture:post-a"]);
  });

  it("prepares FXAA as an ordered post-pass draw", () => {
    const events: string[] = [];
    const effect = createWebGpuFxaaPostEffect();
    const input = {
      texture: {
        createView: () => {
          events.push("input:view");
          return { view: "input" };
        },
      },
      width: 32,
      height: 16,
      format: "rgba8unorm",
      label: "edge-input",
    };
    const prepared = effect.prepare({
      device: postDevice(events),
      input,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 2,
      passIndex: 0,
      isLast: true,
      label: "test-fxaa",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared).toMatchObject({
      effectId: "fxaa",
      label: "FXAA Post Effect",
      commands: [
        { kind: "setPipeline", pipelineKey: "webgpu-post-fxaa|rgba8unorm" },
        { kind: "setBindGroup", index: 0 },
        { kind: "draw", vertexCount: 3 },
      ],
    });
    expect(events).toContain("device:pipeline:test-fxaa:fxaa:pipeline");
  });

  it("prepares bloom as a BloomNode-style Gaussian mip graph", () => {
    const events: string[] = [];
    const bufferWrites: BufferWriteRecord[] = [];
    const effect = createWebGpuBloomPostEffect({
      threshold: 0.7,
      intensity: 1.25,
      radius: 0.25,
      levels: 2,
    });
    const input = {
      texture: {
        createView: () => {
          events.push("input:view");
          return { view: "input" };
        },
      },
      width: 32,
      height: 16,
      format: "rgba8unorm",
      label: "bright-input",
    };
    const prepared = effect.prepare({
      device: postGraphDevice(events, bufferWrites),
      input,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 3,
      passIndex: 0,
      isLast: true,
      label: "test-bloom",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared).toMatchObject({
      effectId: "bloom",
      label: "Bloom Post Effect",
      commands: [],
      graph: {
        report: {
          topology: "unreal-bloom",
          passCount: 6,
          resourceCount: 5,
          brightpassPasses: 1,
          downsamplePasses: 0,
          upsamplePasses: 0,
          horizontalBlurPasses: 2,
          verticalBlurPasses: 2,
          compositePasses: 1,
          levels: [
            { width: 16, height: 8, kernelSize: 6 },
            { width: 8, height: 4, kernelSize: 10 },
          ],
        },
      },
    });
    expect(prepared.graph?.passes.map((pass) => pass.kind)).toEqual([
      "brightpass",
      "blur-horizontal",
      "blur-vertical",
      "blur-horizontal",
      "blur-vertical",
      "composite",
    ]);
    expect(prepared.graph?.passes.map((pass) => pass.commands.length)).toEqual([
      3, 3, 3, 3, 3, 3,
    ]);
    expect(prepared.graph?.passes[0]?.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-bloom|brightpass|rgba8unorm|0.7000|1.2500|0.2500|no-kernel|levels:0",
      },
      { kind: "setBindGroup", index: 0 },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(prepared.graph?.passes[1]?.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-bloom|blur-horizontal|rgba8unorm|0.7000|1.2500|0.2500|kernel:6|levels:0",
      },
      {
        kind: "setBindGroup",
        index: 0,
        resourceKey: expect.stringContaining(":blur:16x8"),
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(prepared.graph?.passes[3]?.commands[1]).toMatchObject({
      kind: "setBindGroup",
      resourceKey: expect.stringContaining(":blur:8x4"),
    });
    expect(prepared.graph?.passes[5]?.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-bloom|composite|rgba8unorm|0.7000|1.2500|0.2500|no-kernel|levels:2",
      },
      { kind: "setBindGroup", index: 0 },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(events).toContain(
      "device:pipeline:test-bloom:bloom:blur-horizontal:0:pipeline",
    );
    expect(events).toContain(
      "device:pipeline:test-bloom:bloom:blur-vertical:0:pipeline",
    );
    expect(events).toContain(
      "device:pipeline:test-bloom:bloom:composite:pipeline",
    );
    expect(
      bufferWrites
        .filter((write) => write.label.includes(":blur-params:"))
        .map((write) => Array.from(floatUpload(write).slice(0, 2))),
    ).toEqual([
      [1 / 16, 1 / 8],
      [1 / 8, 1 / 4],
    ]);
  });

  it("keeps the intentional BloomNode-style default threshold at zero", () => {
    const effect = createWebGpuBloomPostEffect({ levels: 1 });
    const prepared = effect.prepare({
      device: postGraphDevice([]),
      input: postTexture("default-bloom-input", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-default-bloom",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.graph?.passes[0]?.commands[0]).toMatchObject({
      kind: "setPipeline",
      pipelineKey:
        "webgpu-post-bloom|brightpass|rgba8unorm|0.0000|0.7500|0.0000|no-kernel|levels:0",
    });
  });

  it("reuses bloom graph bind groups while texture identities are stable", () => {
    const events: string[] = [];
    const effect = createWebGpuBloomPostEffect({ levels: 2 });
    const input = postTexture("cached-bloom-input", events);
    const device = postGraphDevice(events);

    const first = effect.prepare({
      device,
      input,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-bloom-cache",
    });
    const firstBindGroupCount = bloomBindGroupEvents(events).length;
    const firstEventCount = events.length;
    const second = effect.prepare({
      device,
      input,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 2,
      passIndex: 0,
      isLast: true,
      label: "test-bloom-cache",
    });

    expect(first.diagnostics).toEqual([]);
    expect(second.diagnostics).toEqual([]);
    expect(firstBindGroupCount).toBe(6);
    expect(bloomBindGroupEvents(events)).toHaveLength(firstBindGroupCount);
    expect(events.slice(firstEventCount)).toEqual([]);
    expect(second.graph?.passes.map((pass) => pass.commands.length)).toEqual([
      3, 3, 3, 3, 3, 3,
    ]);

    const resizedInput = postTexture(
      "cached-bloom-input-resized",
      events,
      64,
      32,
    );
    const resized = effect.prepare({
      device,
      input: resizedInput,
      outputFormat: "rgba8unorm",
      width: 64,
      height: 32,
      frame: 3,
      passIndex: 0,
      isLast: true,
      label: "test-bloom-cache",
    });

    expect(resized.diagnostics).toEqual([]);
    expect(bloomBindGroupEvents(events).length).toBeGreaterThan(
      firstBindGroupCount,
    );
  });

  it("prepares TAA with persistent alternating history output", () => {
    const events: string[] = [];
    const effect = createWebGpuTaaPostEffect();
    const firstInput = postTexture("scene-a", events);
    const firstOutput = postTexture("history-a", events);
    const firstMotion = postTexture("motion-a", events);
    const secondInput = postTexture("scene-b", events);
    const secondOutput = postTexture("history-b", events);
    const secondMotion = postTexture("motion-b", events);

    const first = effect.prepare({
      device: postDevice(events),
      input: firstInput,
      motionVector: firstMotion,
      output: firstOutput,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: false,
      label: "test-taa",
    });
    const second = effect.prepare({
      device: postDevice(events),
      input: secondInput,
      motionVector: secondMotion,
      output: secondOutput,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 2,
      passIndex: 0,
      isLast: false,
      label: "test-taa",
    });

    expect(first.diagnostics).toEqual([]);
    expect(second.diagnostics).toEqual([]);
    expect(first.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey: "webgpu-post-taa|rgba8unorm|history:0.950",
      },
      {
        kind: "setBindGroup",
        resourceKey:
          "taa:input:scene-a:history:scene-a:motion:motion-a:weight:0.950",
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(second.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey: "webgpu-post-taa|rgba8unorm|history:0.950",
      },
      {
        kind: "setBindGroup",
        resourceKey:
          "taa:input:scene-b:history:history-a:motion:motion-b:weight:0.950",
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(events).toEqual([
      "device:shader:test-taa:taa:pipeline:shader",
      "device:pipeline:test-taa:taa:pipeline",
      "device:sampler:aperture/post/taa/sampler",
      "view:scene-a",
      "view:scene-a",
      "view:motion-a",
      "pipeline:layout:0",
      "device:bindGroup:test-taa:taa:bind-group",
      "view:scene-b",
      "view:history-a",
      "view:motion-b",
      "pipeline:layout:0",
      "device:bindGroup:test-taa:taa:bind-group",
    ]);
  });

  it("prepares SSAO as a depth-reading post-pass draw", () => {
    const events: string[] = [];
    const effect = createWebGpuSsaoPostEffect({
      radiusPixels: 7,
      intensity: 1.5,
      depthBias: 0.001,
      maxDepthDifference: 0.08,
      near: 0.1,
      far: 40,
      fovYRadians: Math.PI / 3,
      sampleCount: 18,
      minAngleDegrees: 7,
      power: 1.2,
      randomSeed: 0.25,
    });
    const input = postTexture("scene", events);
    const depth = postDepthTexture("scene-depth", events);
    const prepared = effect.prepare({
      device: postDevice(events),
      input,
      depth,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssao",
    });

    expect(effect.requiresDepthTexture).toBe(true);
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-ssao|rgba8unorm|depthSamples:1|radius:7.000|intensity:1.500|bias:0.00100|range:0.0800|near:0.1000|far:40.000|fovY:1.0472|samples:18|minAngle:7.00|power:1.200|random:0.2500|appliesTo:composite",
      },
      {
        kind: "setBindGroup",
        resourceKey:
          "ssao:input:scene:depth:scene-depth:depthSamples:1:radius:7.00:samples:18:intensity:1.50:indirect:no",
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(events).toEqual([
      "device:shader:test-ssao:ssao:pipeline:shader",
      "device:pipeline:test-ssao:ssao:pipeline",
      "device:sampler:aperture/post/ssao/sampler",
      "view:scene",
      "view:scene-depth",
      "pipeline:layout:0",
      "device:bindGroup:test-ssao:ssao:bind-group",
    ]);
  });

  it("diagnoses SSAO when scene depth is unavailable", () => {
    const effect = createWebGpuSsaoPostEffect();
    const prepared = effect.prepare({
      device: postDevice([]),
      input: postTexture("scene", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssao",
    });

    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics).toMatchObject([
      { code: "webGpuPostPass.depthTextureUnavailable", effectId: "ssao" },
    ]);
  });

  it("prepares SSAO when scene depth is multisampled", () => {
    const events: string[] = [];
    const effect = createWebGpuSsaoPostEffect();
    const prepared = effect.prepare({
      device: postDevice(events),
      input: postTexture("scene", events),
      depth: postDepthTexture("msaa-depth", events, 4),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssao",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey: expect.stringContaining(
          "webgpu-post-ssao|rgba8unorm|depthSamples:4|",
        ),
      },
      {
        kind: "setBindGroup",
        resourceKey: expect.stringContaining(
          "ssao:input:scene:depth:msaa-depth:depthSamples:4:",
        ),
      },
      { kind: "draw", vertexCount: 3 },
    ]);
  });

  it("prepares SSR as a depth-reading post-pass draw", () => {
    const events: string[] = [];
    const effect = createWebGpuSsrPostEffect({
      opacity: 0.5,
      maxSteps: 16,
      stridePixels: 4,
      thickness: 0.05,
      near: 0.1,
      far: 40,
      fovYRadians: Math.PI / 3,
      maxDistance: 8,
      fresnel: true,
      distanceAttenuation: true,
      reflectionBlurPixels: 1.5,
      fallbackOpacity: 0.12,
    });
    const input = postTexture("scene", events);
    const depth = postDepthTexture("scene-depth", events);
    const prepared = effect.prepare({
      device: postDevice(events),
      input,
      depth,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssr",
    });

    expect(effect.requiresDepthTexture).toBe(true);
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-ssr|rgba8unorm|depthSamples:1|opacity:0.500|steps:16|stride:4.000|thickness:0.0500|near:0.1000|far:40.000|fovY:1.0472|maxDistance:8.000|fresnel:true|attenuate:true|blur:1.500|fallback:0.120",
      },
      {
        kind: "setBindGroup",
        resourceKey:
          "ssr:input:scene:depth:scene-depth:depthSamples:1:opacity:0.50:distance:8.00:fresnel:true",
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(events).toEqual([
      "device:shader:test-ssr:ssr:pipeline:shader",
      "device:pipeline:test-ssr:ssr:pipeline",
      "device:sampler:aperture/post/ssr/sampler",
      "view:scene",
      "view:scene-depth",
      "pipeline:layout:0",
      "device:bindGroup:test-ssr:ssr:bind-group",
    ]);
  });

  it("diagnoses SSR when scene depth is unavailable", () => {
    const effect = createWebGpuSsrPostEffect();
    const prepared = effect.prepare({
      device: postDevice([]),
      input: postTexture("scene", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssr",
    });

    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics).toMatchObject([
      { code: "webGpuPostPass.depthTextureUnavailable", effectId: "ssr" },
    ]);
  });

  it("prepares SSR when scene depth is multisampled", () => {
    const events: string[] = [];
    const effect = createWebGpuSsrPostEffect();
    const prepared = effect.prepare({
      device: postDevice(events),
      input: postTexture("scene", events),
      depth: postDepthTexture("msaa-depth", events, 4),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-ssr",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey: expect.stringContaining(
          "webgpu-post-ssr|rgba8unorm|depthSamples:4|",
        ),
      },
      {
        kind: "setBindGroup",
        resourceKey: expect.stringContaining(
          "ssr:input:scene:depth:msaa-depth:depthSamples:4:",
        ),
      },
      { kind: "draw", vertexCount: 3 },
    ]);
  });

  it("prepares DOF as a depth-reading bokeh post-pass draw", () => {
    const events: string[] = [];
    const effect = createWebGpuDofPostEffect({
      near: 0.1,
      far: 20,
      focusDistance: 3.2,
      focusRange: 0.8,
      aperture: 1.25,
      maxBlurPixels: 9,
      nearBlur: false,
      blurRings: 4,
      blurRingPoints: 4,
      farBlurScale: 0.75,
      nearBlurScale: 1.1,
    });
    const input = postTexture("scene", events);
    const depth = postDepthTexture("scene-depth", events);
    const prepared = effect.prepare({
      device: postDevice(events),
      input,
      depth,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-dof",
    });

    expect(effect.requiresDepthTexture).toBe(true);
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey:
          "webgpu-post-dof|rgba8unorm|depthSamples:1|near:0.1000|far:20.000|focus:3.200|range:0.800|aperture:1.250|max:9.000|nearBlur:false|rings:4|ringPoints:4|farScale:0.750|nearScale:1.100",
      },
      {
        kind: "setBindGroup",
        resourceKey:
          "dof:input:scene:depth:scene-depth:depthSamples:1:focus:3.20:aperture:1.25:kernel:4x4",
      },
      { kind: "draw", vertexCount: 3 },
    ]);
    expect(events).toEqual([
      "device:shader:test-dof:dof:pipeline:shader",
      "device:pipeline:test-dof:dof:pipeline",
      "device:sampler:aperture/post/dof/sampler",
      "view:scene",
      "view:scene-depth",
      "pipeline:layout:0",
      "device:bindGroup:test-dof:dof:bind-group",
    ]);
  });

  it("diagnoses DOF when scene depth is unavailable", () => {
    const effect = createWebGpuDofPostEffect();
    const prepared = effect.prepare({
      device: postDevice([]),
      input: postTexture("scene", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-dof",
    });

    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics).toMatchObject([
      { code: "webGpuPostPass.depthTextureUnavailable", effectId: "dof" },
    ]);
  });

  it("prepares DOF when scene depth is multisampled", () => {
    const events: string[] = [];
    const effect = createWebGpuDofPostEffect();
    const prepared = effect.prepare({
      device: postDevice(events),
      input: postTexture("scene", events),
      depth: postDepthTexture("msaa-depth", events, 4),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-dof",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands).toMatchObject([
      {
        kind: "setPipeline",
        pipelineKey: expect.stringContaining(
          "webgpu-post-dof|rgba8unorm|depthSamples:4|",
        ),
      },
      {
        kind: "setBindGroup",
        resourceKey: expect.stringContaining(
          "dof:input:scene:depth:msaa-depth:depthSamples:4:",
        ),
      },
      { kind: "draw", vertexCount: 3 },
    ]);
  });

  it("diagnoses TAA when no persistent output texture is available", () => {
    const effect = createWebGpuTaaPostEffect();
    const prepared = effect.prepare({
      device: postDevice([]),
      input: postTexture("scene", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "test-taa",
    });

    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics).toMatchObject([
      { code: "webGpuPostPass.outputTextureUnavailable", effectId: "taa" },
    ]);
  });

  it("diagnoses TAA when the motion-vector texture is unavailable", () => {
    const effect = createWebGpuTaaPostEffect();
    const prepared = effect.prepare({
      device: postDevice([]),
      input: postTexture("scene", []),
      output: postTexture("history", []),
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 1,
      passIndex: 0,
      isLast: false,
      label: "test-taa",
    });

    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics).toMatchObject([
      {
        code: "webGpuPostPass.motionVectorTextureUnavailable",
        effectId: "taa",
      },
    ]);
  });
});

function postTexture(label: string, events: string[], width = 32, height = 16) {
  return {
    texture: {
      createView: () => {
        events.push(`view:${label}`);
        return { label };
      },
    },
    width,
    height,
    format: "rgba8unorm",
    label,
  };
}

function postDepthTexture(label: string, events: string[], sampleCount = 1) {
  return {
    texture: {
      createView: () => {
        events.push(`view:${label}`);
        return { label };
      },
    },
    width: 32,
    height: 16,
    format: "depth24plus",
    sampleCount,
    label,
  };
}

interface BufferWriteRecord {
  readonly label: string;
  readonly data: ArrayBufferLike | ArrayBufferView;
  readonly dataOffset?: number;
  readonly size?: number;
}

function postDevice(events: string[], bufferWrites: BufferWriteRecord[] = []) {
  return {
    createShaderModule: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:shader:${input.label ?? "unlabeled"}`);
      return { descriptor: input };
    },
    createRenderPipeline: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:pipeline:${input.label ?? "unlabeled"}`);
      return {
        descriptor: input,
        getBindGroupLayout: (group: number) => {
          events.push(`pipeline:layout:${group}`);
          return { group };
        },
      };
    },
    createSampler: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:sampler:${input.label ?? "unlabeled"}`);
      return { descriptor: input };
    },
    createBuffer: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };
      const label = input.label ?? "unlabeled";

      events.push(`device:buffer:${label}`);
      return { label, descriptor: input };
    },
    createBindGroup: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:bindGroup:${input.label ?? "unlabeled"}`);
      return { descriptor: input };
    },
    queue: {
      writeBuffer: (
        buffer: { readonly label?: string },
        _bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => {
        const label = buffer.label ?? "unlabeled";

        events.push(`device:writeBuffer:${label}`);
        bufferWrites.push({
          label,
          data,
          ...(dataOffset === undefined ? {} : { dataOffset }),
          ...(size === undefined ? {} : { size }),
        });
      },
    },
  };
}

function postGraphDevice(
  events: string[],
  bufferWrites: BufferWriteRecord[] = [],
) {
  return {
    ...postDevice(events, bufferWrites),
    ...textureDevice(events),
  };
}

function textureDevice(events: string[]) {
  return {
    createTexture: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:texture:${input.label ?? "unlabeled"}`);
      return { descriptor: input, createView: () => ({ descriptor: input }) };
    },
  };
}

function bloomBindGroupEvents(events: readonly string[]): readonly string[] {
  return events.filter(
    (event) => event.includes(":bloom:") && event.includes(":bind-group"),
  );
}

function floatUpload(record: BufferWriteRecord): Float32Array {
  if (ArrayBuffer.isView(record.data)) {
    return new Float32Array(
      record.data.buffer,
      record.data.byteOffset + (record.dataOffset ?? 0),
      (record.size ?? record.data.byteLength) / Float32Array.BYTES_PER_ELEMENT,
    );
  }

  return new Float32Array(
    record.data,
    record.dataOffset ?? 0,
    (record.size ?? record.data.byteLength) / Float32Array.BYTES_PER_ELEMENT,
  );
}
