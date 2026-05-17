import { describe, expect, it } from "vitest";

import {
  createAppTextureSamplerResourceCacheSummary,
  writeAppTextureSamplerResourceCacheSummary,
  type AppTextureSamplerResourceCache,
} from "@aperture-engine/webgpu";

describe("app texture sampler resource cache summaries", () => {
  it("summarizes an empty texture/sampler backend cache", () => {
    const cache = createCache();
    const summary = createAppTextureSamplerResourceCacheSummary();
    const result = writeAppTextureSamplerResourceCacheSummary(summary, cache);

    expect(result).toBe(summary);
    expect(summary).toEqual({
      textureEntries: 0,
      samplerEntries: 0,
      totalEntries: 0,
    });
  });

  it("summarizes retained texture and sampler backend cache entries", () => {
    const cache = createCache();

    cache.textures.set("texture:base-color@1", {
      gpuHandle: "GPUTexture",
      sourcePayload: new Uint8Array([1, 2, 3, 4]),
    } as never);
    cache.textures.set("texture:normal@2", {
      gpuHandle: "GPUTextureView",
    } as never);
    cache.samplers.set("sampler:linear@1", {
      gpuHandle: "GPUSampler",
    } as never);

    const summary = writeAppTextureSamplerResourceCacheSummary(
      createAppTextureSamplerResourceCacheSummary(),
      cache,
    );
    const json = JSON.stringify(summary);

    expect(summary).toEqual({
      textureEntries: 2,
      samplerEntries: 1,
      totalEntries: 3,
    });
    expect(json).not.toContain("GPU");
    expect(json).not.toContain("sourcePayload");
    expect(json).not.toContain("Uint8Array");
    expect(json).not.toContain("texture:base-color");
  });

  it("updates a reused summary after texture/sampler caches are cleared", () => {
    const cache = createCache();
    const summary = createAppTextureSamplerResourceCacheSummary();

    cache.textures.set("texture:base-color@1", {} as never);
    cache.samplers.set("sampler:linear@1", {} as never);

    writeAppTextureSamplerResourceCacheSummary(summary, cache);
    expect(summary.totalEntries).toBe(2);

    cache.textures.clear();
    cache.samplers.clear();

    const result = writeAppTextureSamplerResourceCacheSummary(summary, cache);

    expect(result).toBe(summary);
    expect(summary).toEqual({
      textureEntries: 0,
      samplerEntries: 0,
      totalEntries: 0,
    });
  });
});

function createCache(): AppTextureSamplerResourceCache {
  return {
    textures: new Map(),
    samplers: new Map(),
  };
}
