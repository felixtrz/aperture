import { describe, expect, it } from "vitest";

import {
  createOrReuseWebGpuPostPassTexture,
  createWebGpuBloomPostEffect,
  createWebGpuCopyPostEffect,
  createWebGpuFxaaPostEffect,
  createWebGpuPostPassTextureCacheSlot,
} from "@aperture-engine/webgpu";

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

  it("prepares bloom as an ordered bright-neighbor post-pass draw", () => {
    const events: string[] = [];
    const effect = createWebGpuBloomPostEffect({
      threshold: 0.7,
      intensity: 1.25,
      radiusPixels: 2,
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
      device: postDevice(events),
      input,
      outputFormat: "rgba8unorm",
      width: 32,
      height: 16,
      frame: 3,
      passIndex: 0,
      label: "test-bloom",
    });

    expect(prepared.diagnostics).toEqual([]);
    expect(prepared).toMatchObject({
      effectId: "bloom",
      label: "Bloom Post Effect",
      commands: [
        {
          kind: "setPipeline",
          pipelineKey: "webgpu-post-bloom|rgba8unorm|0.7000|1.2500|2.0000",
        },
        { kind: "setBindGroup", index: 0 },
        { kind: "draw", vertexCount: 3 },
      ],
    });
    expect(events).toContain("device:pipeline:test-bloom:bloom:pipeline");
  });
});

function postDevice(events: string[]) {
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
    createBindGroup: (descriptor: unknown) => {
      const input = descriptor as { readonly label?: string };

      events.push(`device:bindGroup:${input.label ?? "unlabeled"}`);
      return { descriptor: input };
    },
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
