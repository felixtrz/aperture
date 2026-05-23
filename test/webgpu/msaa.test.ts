import { describe, expect, it } from "vitest";

import {
  createOrReuseWebGpuMsaaColorTexture,
  createWebGpuMsaaColorTextureCacheSlot,
  resolveWebGpuMsaaConfig,
} from "@aperture-engine/webgpu";

describe("WebGPU MSAA helpers", () => {
  it("resolves requested sample counts to WebGPU-supported counts", () => {
    expect(resolveWebGpuMsaaConfig(undefined)).toMatchObject({
      requestedSampleCount: 1,
      sampleCount: 1,
      enabled: false,
      clamped: false,
      supportedSampleCounts: [1, 4],
    });
    expect(resolveWebGpuMsaaConfig(4)).toMatchObject({
      requestedSampleCount: 4,
      sampleCount: 4,
      enabled: true,
      clamped: false,
    });
    expect(resolveWebGpuMsaaConfig(2)).toMatchObject({
      requestedSampleCount: 2,
      sampleCount: 4,
      enabled: true,
      clamped: true,
    });
    expect(resolveWebGpuMsaaConfig(8)).toMatchObject({
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
    });
  });

  it("creates and reuses multisampled color textures by dimensions and sample count", () => {
    const descriptors: unknown[] = [];
    const slot = createWebGpuMsaaColorTextureCacheSlot();
    const device = {
      createTexture: (descriptor: unknown) => {
        descriptors.push(descriptor);
        return {
          createView: () => ({ descriptor }),
          destroy: () => {},
        };
      },
    };

    const first = createOrReuseWebGpuMsaaColorTexture({
      device,
      cache: slot,
      width: 320,
      height: 180,
      format: "bgra8unorm",
      sampleCount: 4,
      label: "unit-msaa",
    });
    const second = createOrReuseWebGpuMsaaColorTexture({
      device,
      cache: slot,
      width: 320,
      height: 180,
      format: "bgra8unorm",
      sampleCount: 4,
      label: "unit-msaa",
    });

    expect(first).toMatchObject({
      valid: true,
      status: "created",
      resource: {
        width: 320,
        height: 180,
        format: "bgra8unorm",
        sampleCount: 4,
      },
    });
    expect(second).toMatchObject({
      valid: true,
      status: "reused",
      resource: first.resource,
    });
    expect(descriptors).toEqual([
      {
        label: "unit-msaa",
        size: { width: 320, height: 180 },
        format: "bgra8unorm",
        sampleCount: 4,
        usage: 0x10,
      },
    ]);
  });
});
