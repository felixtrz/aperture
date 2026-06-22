import { describe, expect, it } from "vitest";
import {
  PARTICLE_BURST_RENDER_WGSL,
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
      blendMode: "alpha",
    });

    expect(compute.valid).toBe(true);
    expect(render.valid).toBe(true);
    expect(compute.resource?.cacheKey).toBe(particleComputePipelineCacheKey());
    expect(render.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey("bgra8unorm", "depth24plus", 4, "alpha"),
    );
    expect(PARTICLE_COMPUTE_WGSL).toContain(
      "var<storage, read_write> particles",
    );
    expect(PARTICLE_COMPUTE_WGSL).toContain("index == 0u");
    expect(PARTICLE_COMPUTE_WGSL).toContain("fn sampleSizeCurve");
    expect(PARTICLE_COMPUTE_WGSL).toContain("fn sampleColorCurve");
    expect(PARTICLE_COMPUTE_WGSL).toContain("colorCurve: array<vec4f, 16>");
    expect(PARTICLE_COMPUTE_WGSL).not.toContain(
      "let color = mix(params.colorA, params.colorB, c);",
    );
    expect(PARTICLE_RENDER_WGSL).toContain("var<storage, read> particles");
    expect(PARTICLE_RENDER_WGSL).toContain("var particleTexture");
    expect(PARTICLE_RENDER_WGSL).toContain("textureSample");
    expect(PARTICLE_RENDER_WGSL).toContain("@builtin(instance_index)");
    expect(PARTICLE_RENDER_WGSL).toContain("fogColor: vec4f");
    expect(PARTICLE_RENDER_WGSL).toContain("applyParticleFog");
    expect(PARTICLE_BURST_RENDER_WGSL).toContain("fogColor: vec4f");
    expect(PARTICLE_BURST_RENDER_WGSL).toContain("applyParticleFog");
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
                  dstFactor: "one-minus-src-alpha",
                },
                alpha: {
                  operation: "add",
                  srcFactor: "one",
                  dstFactor: "one-minus-src-alpha",
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
          depthCompare: "less",
        },
        multisample: { count: 4 },
      }),
    ]);
  });
});

describe("particle render pipeline output-stage tonemap/encode (AI-17)", () => {
  function recordingDevice(): {
    device: ParticlePipelineDeviceLike;
    shaderCodes: string[];
  } {
    const shaderCodes: string[] = [];
    const device: ParticlePipelineDeviceLike = {
      createShaderModule: (descriptor: { readonly code?: string }) => {
        shaderCodes.push(descriptor.code ?? "");
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createComputePipeline: () => ({
        getBindGroupLayout: (group: number) => ({ group }),
      }),
      createRenderPipeline: () => ({
        getBindGroupLayout: (group: number) => ({ group }),
      }),
    };
    return { device, shaderCodes };
  }

  it("wraps the particle render fragment with the output stage when requested", async () => {
    const { device, shaderCodes } = recordingDevice();
    const render = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "aces",
      outputColorSpace: "srgb",
    });

    expect(render.valid).toBe(true);
    expect(shaderCodes[0]).toContain(
      "fn apertureOutputStageInner(input: VertexOutput) -> vec4f",
    );
    expect(shaderCodes[0]).toContain(
      "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
    );
    expect(shaderCodes[0]?.match(/@fragment/g)).toHaveLength(1);
    expect(render.resource?.cacheKey).toContain("tonemap:aces");
    expect(render.resource?.cacheKey).toContain("output-color:srgb");
  });

  it("leaves the particle render shader + cache key byte-identical on none + linear", async () => {
    const { device, shaderCodes } = recordingDevice();
    const render = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      tonemap: "none",
      outputColorSpace: "linear",
    });

    expect(shaderCodes[0]).toBe(PARTICLE_RENDER_WGSL);
    expect(render.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
  });
});
