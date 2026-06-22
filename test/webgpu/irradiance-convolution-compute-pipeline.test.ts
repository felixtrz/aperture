import { describe, expect, it } from "vitest";

import {
  convolveIrradianceDirection,
  createIrradianceConvolutionComputePipeline,
  createIrradianceConvolutionDispatchSize,
} from "@aperture-engine/webgpu/test-support";

describe("cosine irradiance convolution", () => {
  it("preserves energy: a constant-white environment integrates to constant irradiance", () => {
    for (const normal of [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [-0.3, 0.6, -0.7],
    ] as [number, number, number][]) {
      const irradiance = convolveIrradianceDirection(() => 1, normal, 1024);
      expect(irradiance).toBeGreaterThan(0.98);
      expect(irradiance).toBeLessThan(1.02);
    }
  });

  it("produces a directional cosine lobe for a single bright hemisphere", () => {
    // Environment: bright (1) in the +Z hemisphere, dark (0) below.
    const env = (direction: [number, number, number]) =>
      direction[2] > 0 ? 1 : 0;

    const facingBright = convolveIrradianceDirection(env, [0, 0, 1], 2048);
    const facingDark = convolveIrradianceDirection(env, [0, 0, -1], 2048);
    const facingSide = convolveIrradianceDirection(env, [1, 0, 0], 2048);

    // The probe facing the bright hemisphere is much brighter than the one
    // facing away, but the dark-facing probe is still non-zero (hemisphere
    // bleed) and the side probe lands in between (clamped-cosine falloff).
    expect(facingBright).toBeGreaterThan(0.85);
    expect(facingDark).toBeLessThan(0.15);
    expect(facingBright - facingDark).toBeGreaterThan(0.6);
    expect(facingSide).toBeGreaterThan(facingDark);
    expect(facingSide).toBeLessThan(facingBright);
    // Every irradiance value is a bounded average of the [0,1] environment.
    for (const value of [facingBright, facingDark, facingSide]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("builds an rgba8unorm convolution compute pipeline whose WGSL integrates the hemisphere", () => {
    const calls: string[] = [];
    const device = {
      createShaderModule: (descriptor: unknown) => {
        calls.push((descriptor as { code: string }).code);
        return { module: true };
      },
      createBindGroupLayout: () => ({ layout: true }),
      createPipelineLayout: () => ({ pipelineLayout: true }),
      createComputePipeline: () => ({ pipeline: true }),
    };

    const result = createIrradianceConvolutionComputePipeline({ device });

    expect(result.valid).toBe(true);
    expect(result.resource?.storageFormat).toBe("rgba8unorm");

    const code = calls[0] ?? "";
    expect(code).toContain("texture_storage_2d_array<rgba8unorm, write>");
    expect(code).toContain("texture_cube<f32>");
    expect(code).toContain("cubeDirection");
    expect(code).toContain("hammersley");
    expect(code).toContain("textureSampleLevel(sourceCube");
  });

  it("degrades gracefully when the device cannot create compute pipelines", () => {
    const result = createIrradianceConvolutionComputePipeline({ device: {} });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "irradianceConvolutionPipeline.createShaderModuleUnavailable",
    );
  });

  it("dispatches one workgroup per 8x8 tile across the 6 cube faces", () => {
    expect(
      createIrradianceConvolutionDispatchSize({ width: 32, height: 32 }),
    ).toEqual({ x: 4, y: 4, z: 6 });
  });
});
