import { describe, expect, it } from "vitest";

import {
  SKYBOX_WGSL,
  createSkyboxRenderPipelineResource,
  skyboxPipelineCacheKey,
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
});
