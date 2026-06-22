import { describe, expect, it } from "vitest";

import {
  createEquirectToCubeComputePipeline,
  createEquirectToCubeDispatchSize,
  cubeFaceCenterDirection,
  equirectToCubeUv,
} from "@aperture-engine/webgpu/test-support";

describe("equirect -> cube direction/UV mapping", () => {
  it("maps the +Z cube-face center direction to the equirect UV centre (0.5, 0.5)", () => {
    const [u, v] = equirectToCubeUv(cubeFaceCenterDirection(4));
    expect(u).toBeCloseTo(0.5, 5);
    expect(v).toBeCloseTo(0.5, 5);
  });

  it("maps the cardinal directions to the expected equirect longitudes/latitudes", () => {
    // Horizon ring (y=0) spans the full longitude; the poles sit at v=0/1.
    expect(equirectToCubeUv([0, 0, 1])[0]).toBeCloseTo(0.5, 5); // +Z -> centre
    expect(equirectToCubeUv([1, 0, 0])[0]).toBeCloseTo(0.75, 5); // +X -> quarter east
    expect(equirectToCubeUv([-1, 0, 0])[0]).toBeCloseTo(0.25, 5); // -X -> quarter west
    expect(equirectToCubeUv([0, 1, 0])[1]).toBeCloseTo(1.0, 5); // +Y -> north pole
    expect(equirectToCubeUv([0, -1, 0])[1]).toBeCloseTo(0.0, 5); // -Y -> south pole
  });

  it("turns horizontal direction variation into horizontal UV variation (direction-varying faces)", () => {
    // Sweep the horizon ring; u must increase monotonically (mod wrap) and the
    // latitude must stay at the equator.
    const samples = [
      [0, 0, 1],
      [0.7, 0, 0.7],
      [1, 0, 0],
      [0.7, 0, -0.7],
    ] as [number, number, number][];
    const us = samples.map((direction) => equirectToCubeUv(direction)[0]);

    for (let i = 1; i < us.length; i += 1) {
      expect(us[i]).toBeGreaterThan(us[i - 1]!);
    }
    for (const direction of samples) {
      expect(equirectToCubeUv(direction)[1]).toBeCloseTo(0.5, 5);
    }
  });

  it("builds an rgba16float projection pipeline whose WGSL maps cube directions to equirect UV", () => {
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

    const result = createEquirectToCubeComputePipeline({ device });

    expect(result.valid).toBe(true);
    expect(result.resource?.storageFormat).toBe("rgba16float");

    const code = calls[0] ?? "";
    expect(code).toContain("texture_storage_2d_array<rgba16float, write>");
    expect(code).toContain("texture_2d<f32>");
    expect(code).toContain("fn equirectUv(");
    expect(code).toContain("atan2(direction.x, direction.z)");
    expect(code).toContain("cubeDirection");
  });

  it("degrades gracefully when the device cannot create compute pipelines", () => {
    const result = createEquirectToCubeComputePipeline({ device: {} });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "equirectToCubePipeline.createShaderModuleUnavailable",
    );
  });

  it("dispatches one workgroup per 8x8 tile across the 6 cube faces", () => {
    expect(createEquirectToCubeDispatchSize({ faceSize: 64 })).toEqual({
      x: 8,
      y: 8,
      z: 6,
    });
  });
});
