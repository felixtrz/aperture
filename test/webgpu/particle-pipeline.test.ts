import { describe, expect, it } from "vitest";
import {
  PARTICLE_COMPUTE_WGSL,
  PARTICLE_RENDER_WGSL,
  createParticleComputePipelineResource,
  createParticleRenderPipelineResource,
  particleComputePipelineCacheKey,
  particleRenderPipelineCacheKey,
  type ParticlePipelineDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("GPU particle WebGPU pipelines", () => {
  it("builds compute state and additive quad render pipelines", async () => {
    const computeDescriptors: unknown[] = [];
    const renderDescriptors: unknown[] = [];
    const device: ParticlePipelineDeviceLike = {
      createShaderModule: () => ({
        compilationInfo: async () => ({ messages: [] }),
      }),
      createComputePipeline: (descriptor) => {
        computeDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
      createRenderPipeline: (descriptor) => {
        renderDescriptors.push(descriptor);
        return { getBindGroupLayout: (group: number) => ({ group }) };
      },
    };

    const compute = await createParticleComputePipelineResource({ device });
    const render = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      sampleCount: 4,
    });

    expect(compute.valid).toBe(true);
    expect(render.valid).toBe(true);
    expect(compute.resource?.cacheKey).toBe(particleComputePipelineCacheKey());
    expect(render.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey("bgra8unorm", "depth24plus", 4),
    );
    expect(PARTICLE_COMPUTE_WGSL).toContain(
      "var<storage, read_write> particles",
    );
    expect(PARTICLE_COMPUTE_WGSL).toContain("index == 0u");
    expect(PARTICLE_RENDER_WGSL).toContain("var<storage, read> particles");
    expect(PARTICLE_RENDER_WGSL).toContain("@builtin(instance_index)");
    expect(computeDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/gpu-particles-compute",
        layout: "auto",
        compute: expect.objectContaining({ entryPoint: "cs_main" }),
      }),
    ]);
    expect(renderDescriptors).toEqual([
      expect.objectContaining({
        label: "aperture/gpu-particles-render:bgra8unorm",
        layout: "auto",
        vertex: expect.objectContaining({ entryPoint: "vs_main" }),
        fragment: expect.objectContaining({
          entryPoint: "fs_main",
          targets: [
            expect.objectContaining({
              format: "bgra8unorm",
              blend: {
                color: {
                  operation: "add",
                  srcFactor: "src-alpha",
                  dstFactor: "one",
                },
                alpha: {
                  operation: "add",
                  srcFactor: "one",
                  dstFactor: "one",
                },
              },
            }),
          ],
        }),
        primitive: {
          topology: "triangle-list",
          cullMode: "none",
          frontFace: "ccw",
        },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: false,
          depthCompare: "always",
        },
        multisample: { count: 4 },
      }),
    ]);
  });
});
