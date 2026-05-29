import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createAppTextureSamplerResourceCacheSummary,
  createSamplerAsset,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureAsset,
  createTextureHandle,
  prepareStandardAppTextureSamplerResources,
  writeAppTextureSamplerResourceCacheSummary,
  type AppTextureSamplerResourceCache,
} from "@aperture-engine/webgpu/test-support";

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

  it("prepares clearcoat-only StandardMaterial texture and sampler resources", () => {
    const registry = new AssetRegistry();
    const clearcoatTexture = createTextureHandle("clearcoat-factor");
    const clearcoatSampler = createSamplerHandle("clearcoat-nearest");
    const createdTextures: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const writes: unknown[] = [];
    const reuse = {
      textureResourcesCreated: 0,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 0,
    };

    registry.register(clearcoatTexture);
    registry.register(clearcoatSampler);
    registry.markReady(
      clearcoatTexture,
      createTextureAsset({
        label: "clearcoat-factor",
        dimension: "2d",
        width: 2,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "data",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255]),
          bytesPerRow: 8,
        },
      }),
    );
    registry.markReady(
      clearcoatSampler,
      createSamplerAsset({
        label: "clearcoat-nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
      }),
    );

    const result = prepareStandardAppTextureSamplerResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return { createView: () => ({ label: "clearcoat-view" }) };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "clearcoat-sampler-gpu" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      material: createStandardMaterialAsset({
        clearcoatTexture: {
          texture: clearcoatTexture,
          sampler: clearcoatSampler,
        },
      }),
      reuse,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.textureKeys).toEqual(["texture:clearcoat-factor@1"]);
    expect(result.samplerKeys).toEqual(["sampler:clearcoat-nearest@1"]);
    expect(result.textures).toHaveLength(1);
    expect(result.samplers).toHaveLength(1);
    expect(result.textures[0]?.descriptor).toMatchObject({
      label: "clearcoat-factor",
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
    });
    expect(createdTextures).toEqual([
      {
        label: "clearcoat-factor",
        size: [2, 1, 1],
        format: "rgba8unorm",
        usage: 6,
        mipLevelCount: 1,
      },
    ]);
    expect(createdSamplers).toEqual([
      expect.objectContaining({
        label: "clearcoat-nearest",
        magFilter: "nearest",
        minFilter: "nearest",
      }),
    ]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 8 },
        size: [2, 1, 1],
      },
    ]);
    expect(reuse).toEqual({
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
    });
  });

  it("prepares clearcoat roughness StandardMaterial texture and sampler resources", () => {
    const registry = new AssetRegistry();
    const roughnessTexture = createTextureHandle("clearcoat-roughness");
    const roughnessSampler = createSamplerHandle("clearcoat-roughness-nearest");
    const createdTextures: unknown[] = [];
    const createdSamplers: unknown[] = [];
    const writes: unknown[] = [];
    const reuse = {
      textureResourcesCreated: 0,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 0,
    };

    registry.register(roughnessTexture);
    registry.register(roughnessSampler);
    registry.markReady(
      roughnessTexture,
      createTextureAsset({
        label: "clearcoat-roughness",
        dimension: "2d",
        width: 2,
        height: 1,
        format: "rgba8unorm",
        colorSpace: "data",
        semantic: "clearcoat-roughness",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([0, 255, 0, 255, 0, 0, 0, 255]),
          bytesPerRow: 8,
        },
      }),
    );
    registry.markReady(
      roughnessSampler,
      createSamplerAsset({
        label: "clearcoat-roughness-nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
      }),
    );

    const result = prepareStandardAppTextureSamplerResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: (descriptor: unknown) => {
          createdTextures.push(descriptor);
          return { createView: () => ({ label: "roughness-view" }) };
        },
        createSampler: (descriptor: unknown) => {
          createdSamplers.push(descriptor);
          return { label: "roughness-sampler-gpu" };
        },
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      material: createStandardMaterialAsset({
        clearcoatRoughnessTexture: {
          texture: roughnessTexture,
          sampler: roughnessSampler,
        },
      }),
      reuse,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.textureKeys).toEqual(["texture:clearcoat-roughness@1"]);
    expect(result.samplerKeys).toEqual([
      "sampler:clearcoat-roughness-nearest@1",
    ]);
    expect(result.textures[0]?.descriptor).toMatchObject({
      label: "clearcoat-roughness",
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "clearcoat-roughness",
    });
    expect(createdTextures).toEqual([
      {
        label: "clearcoat-roughness",
        size: [2, 1, 1],
        format: "rgba8unorm",
        usage: 6,
        mipLevelCount: 1,
      },
    ]);
    expect(createdSamplers).toEqual([
      expect.objectContaining({
        label: "clearcoat-roughness-nearest",
        magFilter: "nearest",
        minFilter: "nearest",
      }),
    ]);
    expect(writes).toMatchObject([
      {
        layout: { bytesPerRow: 8 },
        size: [2, 1, 1],
      },
    ]);
    expect(reuse).toEqual({
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
    });
  });

  it("preserves precomputed texture mip levels from source assets", () => {
    const registry = new AssetRegistry();
    const baseTexture = createTextureHandle("ktx2-base-color");
    const baseSampler = createSamplerHandle("ktx2-linear");
    const writes: unknown[] = [];
    const reuse = {
      textureResourcesCreated: 0,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 0,
    };

    registry.register(baseTexture);
    registry.register(baseSampler);
    registry.markReady(
      baseTexture,
      createTextureAsset({
        label: "ktx2-base-color",
        dimension: "2d",
        width: 4,
        height: 4,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        mipLevelCount: 3,
        sourceData: {
          bytes: new Uint8Array(4 * 4 * 4).fill(10),
          bytesPerRow: 16,
          rowsPerImage: 4,
          mipLevels: [
            {
              bytes: new Uint8Array(4 * 4 * 4).fill(10),
              bytesPerRow: 16,
              rowsPerImage: 4,
              width: 4,
              height: 4,
            },
            {
              bytes: new Uint8Array(2 * 2 * 4).fill(20),
              bytesPerRow: 8,
              rowsPerImage: 2,
              width: 2,
              height: 2,
            },
            {
              bytes: new Uint8Array(1 * 1 * 4).fill(30),
              bytesPerRow: 4,
              rowsPerImage: 1,
              width: 1,
              height: 1,
            },
          ],
        },
      }),
    );
    registry.markReady(baseSampler, createSamplerAsset());

    const result = prepareStandardAppTextureSamplerResources({
      assets: registry,
      cache: createCache(),
      device: {
        createTexture: () => ({ createView: () => ({ label: "ktx2-view" }) }),
        createSampler: () => ({ label: "ktx2-sampler" }),
        queue: {
          writeTexture: (
            destination: unknown,
            data: Uint8Array,
            layout: unknown,
            size: unknown,
          ) => {
            writes.push({ destination, data, layout, size });
          },
        },
      },
      material: createStandardMaterialAsset({
        baseColorTexture: {
          texture: baseTexture,
          sampler: baseSampler,
        },
      }),
      reuse,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.textures[0]?.descriptor.mipLevelCount).toBe(3);
    expect(writes).toMatchObject([
      {
        destination: { mipLevel: 0 },
        layout: { bytesPerRow: 16, rowsPerImage: 4 },
        size: [4, 4, 1],
      },
      {
        destination: { mipLevel: 1 },
        layout: { bytesPerRow: 8, rowsPerImage: 2 },
        size: [2, 2, 1],
      },
      {
        destination: { mipLevel: 2 },
        layout: { bytesPerRow: 4, rowsPerImage: 1 },
        size: [1, 1, 1],
      },
    ]);
  });
});

function createCache(): AppTextureSamplerResourceCache {
  return {
    textures: new Map(),
    samplers: new Map(),
  };
}
