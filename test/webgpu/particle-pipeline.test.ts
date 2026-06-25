import { describe, expect, it } from "vitest";
import {
  PARTICLE_BURST_RENDER_WGSL,
  PARTICLE_COMPUTE_WGSL,
  PARTICLE_RENDER_WGSL,
  createParticleComputePipelineResource,
  createParticleRenderShaderSource,
  createParticleRenderPipelineResource,
  particleBurstRenderPipelineCacheKey,
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

    expect(shaderCodes[0]).toBe(createParticleRenderShaderSource());
    expect(render.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey("bgra8unorm", "depth24plus"),
    );
  });

  it("builds distinct shader variants for non-billboard render modes", async () => {
    const { device, shaderCodes } = recordingDevice();
    const stretched = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      renderMode: "stretched-billboard",
    });
    const horizontalBurst = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      variant: "burst",
      renderMode: "horizontal-billboard",
    });
    const trail = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      renderMode: "trail",
    });
    const mesh = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      renderMode: "mesh",
    });

    expect(stretched.valid).toBe(true);
    expect(horizontalBurst.valid).toBe(true);
    expect(trail.valid).toBe(true);
    expect(mesh.valid).toBe(true);
    expect(shaderCodes[0]).toContain("const PARTICLE_RENDER_MODE: u32 = 1u;");
    expect(shaderCodes[1]).toContain("const PARTICLE_RENDER_MODE: u32 = 2u;");
    expect(shaderCodes[2]).toContain("const PARTICLE_RENDER_MODE: u32 = 4u;");
    expect(shaderCodes[3]).toContain("const PARTICLE_RENDER_MODE: u32 = 5u;");
    expect(stretched.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "stretched-billboard",
      ),
    );
    expect(horizontalBurst.resource?.cacheKey).toBe(
      particleBurstRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "horizontal-billboard",
      ),
    );
    expect(trail.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "trail",
      ),
    );
    expect(mesh.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "mesh",
      ),
    );
  });

  it("builds soft-particle depth-fade render variants", async () => {
    const { device, shaderCodes } = recordingDevice();
    const render = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      softParticles: true,
    });
    const burst = await createParticleRenderPipelineResource({
      device,
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      variant: "burst",
      softParticles: true,
    });

    expect(render.valid).toBe(true);
    expect(burst.valid).toBe(true);
    expect(shaderCodes[0]).toContain(
      "@group(3) @binding(0) var particleSceneDepth: texture_depth_2d;",
    );
    expect(shaderCodes[0]).toContain(
      "@group(3) @binding(1) var<uniform> particleSoftParams",
    );
    expect(shaderCodes[0]).toContain("textureLoad(particleSceneDepth");
    expect(shaderCodes[1]).toContain(
      "@group(4) @binding(0) var particleSceneDepth: texture_depth_2d;",
    );
    expect(render.resource?.cacheKey).toBe(
      particleRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "billboard",
        true,
      ),
    );
    expect(burst.resource?.cacheKey).toBe(
      particleBurstRenderPipelineCacheKey(
        "bgra8unorm",
        "depth24plus",
        1,
        "additive",
        "none",
        "linear",
        "billboard",
        true,
      ),
    );
  });
});
