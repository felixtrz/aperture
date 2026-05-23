import { describe, expect, it } from "vitest";

import {
  detectWebGpuSupport,
  initializeWebGpu,
  type WebGpuAdapterLike,
  type WebGpuCanvasContextLike,
  type WebGpuDeviceLike,
  type WebGpuLike,
} from "@aperture-engine/webgpu";

describe("WebGPU support boundary", () => {
  it("reports missing navigator.gpu distinctly", () => {
    expect(detectWebGpuSupport({ navigator: {} })).toEqual({
      ok: false,
      reason: "navigator-gpu-unavailable",
      message: "WebGPU is unavailable because navigator.gpu is missing.",
    });
  });

  it("reports adapter failure distinctly", async () => {
    const gpu: WebGpuLike = {
      requestAdapter: async () => null,
    };

    await expect(
      initializeWebGpu({
        environment: { navigator: { gpu } },
        context: fakeContext(),
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "adapter-unavailable",
    });
  });

  it("reports device request failure distinctly", async () => {
    const gpu = fakeGpu({
      requestDevice: async () => {
        throw new Error("device denied");
      },
    });

    await expect(
      initializeWebGpu({
        environment: { navigator: { gpu } },
        context: fakeContext(),
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "device-request-failed",
    });
  });

  it("reports missing canvas context distinctly", async () => {
    const gpu = fakeGpu(fakeAdapter());

    await expect(
      initializeWebGpu({
        environment: { navigator: { gpu } },
        canvas: { getContext: () => null },
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "context-unavailable",
    });
  });

  it("initializes injected adapter, device, and context successfully", async () => {
    const configured: unknown[] = [];
    const context = fakeContext((configuration) =>
      configured.push(configuration),
    );
    const device: WebGpuDeviceLike = {};
    const gpu = fakeGpu(fakeAdapter(device), "rgba8unorm");

    const result = await initializeWebGpu({
      environment: { navigator: { gpu } },
      context,
      textureUsage: 17,
    });

    expect(result).toMatchObject({ ok: true, format: "rgba8unorm" });
    expect(configured).toHaveLength(1);
    expect(configured[0]).toMatchObject({
      device,
      format: "rgba8unorm",
      colorSpace: "srgb",
      usage: 17,
    });
  });

  it("requests timestamp-query automatically when the adapter exposes it", async () => {
    const descriptors: unknown[] = [];
    const device: WebGpuDeviceLike = {};
    const gpu = fakeGpu({
      features: {
        has: (feature) => feature === "timestamp-query",
      },
      requestDevice: async (descriptor) => {
        descriptors.push(descriptor);
        return device;
      },
    });

    const result = await initializeWebGpu({
      environment: { navigator: { gpu } },
      context: fakeContext(),
      deviceDescriptor: { label: "timed-device", requiredFeatures: ["foo"] },
    });

    expect(result).toMatchObject({ ok: true });
    expect(descriptors).toEqual([
      {
        label: "timed-device",
        requiredFeatures: ["foo", "timestamp-query"],
      },
    ]);
  });

  it("requests supported texture compression features automatically", async () => {
    const descriptors: unknown[] = [];
    const device: WebGpuDeviceLike = {};
    const gpu = fakeGpu({
      features: {
        has: (feature) =>
          feature === "texture-compression-bc" ||
          feature === "texture-compression-etc2",
      },
      requestDevice: async (descriptor) => {
        descriptors.push(descriptor);
        return device;
      },
    });

    const result = await initializeWebGpu({
      environment: { navigator: { gpu } },
      context: fakeContext(),
    });

    expect(result).toMatchObject({ ok: true });
    expect(descriptors).toEqual([
      {
        requiredFeatures: [
          "texture-compression-bc",
          "texture-compression-etc2",
        ],
      },
    ]);
  });

  it("requests indirect-first-instance automatically when the adapter exposes it", async () => {
    const descriptors: unknown[] = [];
    const device: WebGpuDeviceLike = {};
    const gpu = fakeGpu({
      features: {
        has: (feature) => feature === "indirect-first-instance",
      },
      requestDevice: async (descriptor) => {
        descriptors.push(descriptor);
        return device;
      },
    });

    const result = await initializeWebGpu({
      environment: { navigator: { gpu } },
      context: fakeContext(),
    });

    expect(result).toMatchObject({ ok: true });
    expect(descriptors).toEqual([
      {
        requiredFeatures: ["indirect-first-instance"],
      },
    ]);
  });

  it("does not request timestamp-query when disabled", async () => {
    const descriptors: unknown[] = [];
    const device: WebGpuDeviceLike = {};
    const gpu = fakeGpu({
      features: {
        has: (feature) => feature === "timestamp-query",
      },
      requestDevice: async (descriptor) => {
        descriptors.push(descriptor);
        return device;
      },
    });

    const result = await initializeWebGpu({
      environment: { navigator: { gpu } },
      context: fakeContext(),
      timestampQuery: false,
    });

    expect(result).toMatchObject({ ok: true });
    expect(descriptors).toEqual([undefined]);
  });

  it("reports canvas configuration failures distinctly", async () => {
    const gpu = fakeGpu(fakeAdapter());

    await expect(
      initializeWebGpu({
        environment: { navigator: { gpu } },
        context: fakeContext(() => {
          throw new Error("usage denied");
        }),
        textureUsage: 17,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "context-configure-failed",
      message: "WebGPU canvas context configuration failed.",
    });
  });

  it("exposes a device-loss result promise when the device reports loss", async () => {
    const device: WebGpuDeviceLike = {
      lost: Promise.resolve({ reason: "destroyed", message: "test loss" }),
    };
    const result = await initializeWebGpu({
      environment: { navigator: { gpu: fakeGpu(fakeAdapter(device)) } },
      context: fakeContext(),
    });

    expect(result.ok).toBe(true);

    if (!result.ok || result.deviceLost === null) {
      throw new Error("Expected deviceLost promise.");
    }

    await expect(result.deviceLost).resolves.toMatchObject({
      ok: false,
      reason: "device-lost",
      message: "test loss",
    });
  });
});

function fakeGpu(
  adapter: WebGpuAdapterLike,
  format = "bgra8unorm",
): WebGpuLike {
  return {
    requestAdapter: async () => adapter,
    getPreferredCanvasFormat: () => format,
  };
}

function fakeAdapter(device: WebGpuDeviceLike = {}): WebGpuAdapterLike {
  return {
    requestDevice: async () => device,
  };
}

function fakeContext(
  configure: WebGpuCanvasContextLike["configure"] = () => {},
): WebGpuCanvasContextLike {
  return { configure };
}
