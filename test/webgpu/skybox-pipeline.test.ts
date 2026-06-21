import { describe, expect, it } from "vitest";

import {
  PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT,
  PROCEDURAL_SKY_WGSL,
  SKYBOX_WGSL,
  createProceduralSkyRenderPipelineResource,
  createSkyboxRenderPipelineResource,
  proceduralSkyPipelineCacheKey,
  skyboxPipelineCacheKey,
  type ProceduralSkyRenderPipelineDeviceLike,
  type SkyboxRenderPipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("skybox WebGPU pipeline", () => {
  it("builds an infinite-depth cube-map background pipeline", async () => {
    const renderPipelineDescriptors: unknown[] = [];
    const device: SkyboxRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        renderPipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const result = await createSkyboxRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resource?.cacheKey).toBe(
      skyboxPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
    expect(SKYBOX_WGSL).toContain("texture_cube<f32>");
    expect(SKYBOX_WGSL).toContain("inverseViewProjection");
    expect(SKYBOX_WGSL).toContain("textureSample(");
    expect(SKYBOX_WGSL).toContain("skyboxTexture");
    expect(SKYBOX_WGSL).toContain("vec3f(1.0, 1.0, -1.0)");
    expect(renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/skybox:bgra8unorm",
        layout: "auto",
        vertex: expect.objectContaining({ entryPoint: "vs_main" }),
        fragment: expect.objectContaining({
          entryPoint: "fs_main",
          targets: [
            expect.objectContaining({
              format: "bgra8unorm",
              writeMask: 0xf,
            }),
          ],
        }),
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "less-equal",
        },
      }),
    ]);
  });

  it("builds a procedural gradient sky pipeline with dithered uniforms", async () => {
    const renderPipelineDescriptors: unknown[] = [];
    const device: ProceduralSkyRenderPipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createRenderPipeline: (descriptor) => {
        renderPipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const result = await createProceduralSkyRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      sampleCount: 4,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(PROCEDURAL_SKY_UNIFORM_FLOAT_COUNT).toBe(44);
    expect(result.resource?.cacheKey).toBe(
      proceduralSkyPipelineCacheKey("bgra8unorm", "depth24plus", 4),
    );
    expect(PROCEDURAL_SKY_WGSL).toContain("ProceduralSkyUniform");
    expect(PROCEDURAL_SKY_WGSL).toContain("horizonColorPosition");
    expect(PROCEDURAL_SKY_WGSL).toContain("hash12");
    expect(PROCEDURAL_SKY_WGSL).toContain("smoothstep");
    expect(renderPipelineDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/procedural-sky:bgra8unorm",
        layout: "auto",
        vertex: expect.objectContaining({ entryPoint: "vs_main" }),
        fragment: expect.objectContaining({
          entryPoint: "fs_main",
          targets: [
            expect.objectContaining({
              format: "bgra8unorm",
              writeMask: 0xf,
            }),
          ],
        }),
        multisample: { count: 4 },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "less-equal",
        },
      }),
    ]);
  });
});
