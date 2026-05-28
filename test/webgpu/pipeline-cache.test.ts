import { describe, expect, it } from "vitest";

import {
  WebGpuRenderPipelineCache,
  createWebGpuRenderPipelineCacheKey,
  type BatchCompatibilityKey,
  type WebGpuRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

const BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "unlit|opaque|back|less|none",
  materialKey: "material:white",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("WebGPU render pipeline cache", () => {
  it("creates stable keys from shader, formats, topology, and batch compatibility", () => {
    const first = createWebGpuRenderPipelineCacheKey({
      shaderLabel: "aperture/unlit",
      colorFormats: ["bgra8unorm"],
      depthFormat: "depth24plus",
      topology: "triangle-list",
      batchKey: BATCH_KEY,
    });
    const second = createWebGpuRenderPipelineCacheKey({
      shaderLabel: "aperture/unlit",
      colorFormats: ["bgra8unorm"],
      depthFormat: "depth24plus",
      batchKey: { ...BATCH_KEY },
    });

    expect(first).toBe(second);
    expect(JSON.parse(first) as unknown).toEqual({
      shader: {
        label: "aperture/unlit",
        family: "aperture/unlit",
        variantKey: BATCH_KEY.pipelineKey,
      },
      targets: {
        colorFormats: ["bgra8unorm"],
        depthFormat: "depth24plus",
        stencilFormat: null,
      },
      layouts: {
        vertex: "primitive-interleaved",
        bindGroups: [],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
        frontFace: "ccw",
        stripIndexFormat: null,
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "always",
        stencilReadMask: 0,
        stencilWriteMask: 0,
      },
      blend: {
        alphaToCoverageEnabled: false,
        colorTargets: [{ format: "bgra8unorm", blend: null, writeMask: "all" }],
      },
      multisample: {
        sampleCount: 1,
      },
      material: {
        pipelineKey: BATCH_KEY.pipelineKey,
        variantKey: BATCH_KEY.materialKey,
      },
      batch: BATCH_KEY,
    });
  });

  it("creates pipelines on misses and reuses them on hits", () => {
    const cache = new WebGpuRenderPipelineCache();
    const pipeline = { label: "pipeline" };
    const descriptors: unknown[] = [];
    const device: WebGpuRenderPipelineDeviceLike = {
      createRenderPipeline: (descriptor) => {
        descriptors.push(descriptor);
        return pipeline;
      },
    };
    const request = {
      device,
      key: {
        shaderLabel: "aperture/unlit",
        colorFormats: ["bgra8unorm"],
        depthFormat: "depth24plus",
        batchKey: BATCH_KEY,
      },
      descriptor: {
        label: "unlit pipeline",
        primitive: { topology: "triangle-list" },
      },
    };

    const miss = cache.getOrCreate(request);
    const hit = cache.getOrCreate(request);

    expect(miss).toMatchObject({ ok: true, status: "miss", pipeline });
    expect(hit).toMatchObject({ ok: true, status: "hit", pipeline });
    expect(descriptors).toEqual([request.descriptor]);
    expect(cache.size).toBe(1);
  });

  it("separates keys by color format and primitive topology", () => {
    const base = {
      shaderLabel: "aperture/unlit",
      colorFormats: ["bgra8unorm"],
      depthFormat: "depth24plus",
      batchKey: BATCH_KEY,
    };
    const bgra = createWebGpuRenderPipelineCacheKey(base);
    const rgba = createWebGpuRenderPipelineCacheKey({
      ...base,
      colorFormats: ["rgba8unorm"],
    });
    const lines = createWebGpuRenderPipelineCacheKey({
      ...base,
      topology: "line-list",
    });

    expect(bgra).not.toBe(rgba);
    expect(bgra).not.toBe(lines);
  });

  it("separates keys by layout, render state, and material variant", () => {
    const base = {
      shaderLabel: "aperture/unlit",
      colorFormats: ["bgra8unorm"],
      depthFormat: "depth24plus",
      batchKey: BATCH_KEY,
    };
    const baseline = createWebGpuRenderPipelineCacheKey(base);
    const vertexLayout = createWebGpuRenderPipelineCacheKey({
      ...base,
      vertexLayoutKey: "mesh-layout:skinned",
    });
    const bindGroupLayout = createWebGpuRenderPipelineCacheKey({
      ...base,
      bindGroupLayoutKeys: ["group-0", "group-1", "group-2:textured"],
    });
    const cullMode = createWebGpuRenderPipelineCacheKey({
      ...base,
      primitive: { cullMode: "back" },
    });
    const materialVariant = createWebGpuRenderPipelineCacheKey({
      ...base,
      materialVariantKey: "material:white|alpha-cutout",
    });
    const sampleCount = createWebGpuRenderPipelineCacheKey({
      ...base,
      sampleCount: 4,
    });

    expect(baseline).not.toBe(vertexLayout);
    expect(baseline).not.toBe(bindGroupLayout);
    expect(baseline).not.toBe(cullMode);
    expect(baseline).not.toBe(materialVariant);
    expect(baseline).not.toBe(sampleCount);
  });

  it("reports missing createRenderPipeline support on cache misses", () => {
    const cache = new WebGpuRenderPipelineCache();
    const result = cache.getOrCreate({
      device: {},
      key: {
        shaderLabel: "aperture/unlit",
        colorFormats: ["bgra8unorm"],
        batchKey: BATCH_KEY,
      },
      descriptor: { label: "unlit pipeline" },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "create-render-pipeline-unavailable",
    });
    expect(cache.size).toBe(0);
  });
});
