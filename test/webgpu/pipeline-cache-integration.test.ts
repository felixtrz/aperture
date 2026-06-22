import { describe, expect, it } from "vitest";

import {
  WebGpuRenderPipelineCache,
  createUnlitPipelineDescriptorPlan,
  getOrCreateRenderPipelineFromPlan,
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

describe("pipeline cache descriptor integration", () => {
  it("creates pipelines on cache misses and reuses them on hits", () => {
    const cache = new WebGpuRenderPipelineCache();
    const created: unknown[] = [];
    const pipeline = { id: "pipeline" };
    const device: WebGpuRenderPipelineDeviceLike = {
      createRenderPipeline: (descriptor) => {
        created.push(descriptor);
        return pipeline;
      },
    };
    const plan = required(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: BATCH_KEY,
      }).plan,
    );

    const miss = getOrCreateRenderPipelineFromPlan({ cache, device, plan });
    const hit = getOrCreateRenderPipelineFromPlan({ cache, device: {}, plan });

    expect(miss).toMatchObject({ ok: true, status: "miss", pipeline });
    expect(hit).toMatchObject({ ok: true, status: "hit", pipeline });
    expect(created).toEqual([plan.descriptor]);
  });

  it("reports missing device support and null descriptor plans", () => {
    const cache = new WebGpuRenderPipelineCache();
    const plan = required(
      createUnlitPipelineDescriptorPlan({
        colorFormat: "bgra8unorm",
        batchKey: BATCH_KEY,
      }).plan,
    );

    expect(
      getOrCreateRenderPipelineFromPlan({ cache, device: {}, plan }),
    ).toMatchObject({
      ok: false,
      reason: "create-render-pipeline-unavailable",
      diagnostics: [
        { code: "pipelineCacheIntegration.pipelineCreationFailed" },
      ],
    });
    expect(
      getOrCreateRenderPipelineFromPlan({
        cache,
        device: {},
        plan: null,
      }),
    ).toMatchObject({
      ok: false,
      reason: "null-descriptor-plan",
      diagnostics: [{ code: "pipelineCacheIntegration.nullDescriptorPlan" }],
    });
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
