import { describe, expect, it } from "vitest";

import {
  clearWebGpuCanvasWithReadback,
  createReadbackCanvasTextureUsage,
  type WebGpuClearReadbackBufferLike,
  type WebGpuClearReadbackDeviceLike,
  type WebGpuReadbackCommandEncoderLike,
} from "../../src/index.js";

describe("WebGPU clear readback", () => {
  it("creates canvas texture usage flags for readback-capable presentation", () => {
    expect(
      createReadbackCanvasTextureUsage({
        GPUTextureUsage: { COPY_SRC: 1, RENDER_ATTACHMENT: 16 },
      }),
    ).toEqual({
      ok: true,
      usage: 17,
      copySrc: 1,
      renderAttachment: 16,
    });
  });

  it("diagnoses missing WebGPU texture usage flags", () => {
    expect(createReadbackCanvasTextureUsage({})).toMatchObject({
      ok: false,
      reason: "texture-usage-unavailable",
    });
  });

  it("clears the current texture and reads a center BGRA pixel", async () => {
    const calls: unknown[] = [];
    const texture = { createView: () => "view" };
    const buffer = mappedBuffer([163, 71, 20, 255], calls);
    const encoder = recordingEncoder(calls);
    const device = recordingDevice({
      calls,
      encoder,
      buffer,
    });

    const result = await clearWebGpuCanvasWithReadback({
      device,
      context: fakeContext(texture),
      format: "bgra8unorm",
      width: 640,
      height: 480,
      color: { r: 0.08, g: 0.28, b: 0.64, a: 1 },
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toEqual({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
      origin: { x: 320, y: 240 },
      bytesPerRow: 256,
      pixel: { r: 20, g: 71, b: 163, a: 255 },
    });
    expect(calls).toContainEqual([
      "copyTextureToBuffer",
      { texture, origin: { x: 320, y: 240, z: 0 } },
      { buffer, bytesPerRow: 256, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    ]);
    expect(calls).toContainEqual(["submit", ["command-buffer"]]);
    expect(calls).toContainEqual(["mapAsync", 1]);
    expect(calls).toContainEqual(["unmap"]);
  });

  it("decodes RGBA texture bytes without channel swizzling", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoder(calls),
        buffer: mappedBuffer([20, 71, 163, 255], calls),
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 4,
      height: 4,
      origin: { x: 1, y: 2 },
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: true,
      format: "rgba8unorm",
      origin: { x: 1, y: 2 },
      pixel: { r: 20, g: 71, b: 163, a: 255 },
    });
  });

  it("diagnoses invalid readback origins while keeping the clear submission", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoder(calls),
        buffer: mappedBuffer([0, 0, 0, 255], calls),
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 4,
      height: 4,
      origin: { x: 4, y: 0 },
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: false,
      reason: "texture-size-invalid",
      clearOk: true,
    });
    expect(calls).toContainEqual(["submit", ["command-buffer"]]);
  });

  it("diagnoses missing texture-copy support while keeping the clear submission", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoderWithoutCopy(calls),
        buffer: mappedBuffer([0, 0, 0, 255], calls),
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 4,
      height: 4,
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: false,
      reason: "copy-texture-to-buffer-unavailable",
      clearOk: true,
    });
    expect(calls).toContainEqual(["submit", ["command-buffer"]]);
  });

  it("keeps the clear submission when readback buffer usage flags are unavailable", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoder(calls),
        buffer: mappedBuffer([0, 0, 0, 255], calls),
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 8,
      height: 8,
      environment: {},
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: false,
      reason: "buffer-usage-unavailable",
      clearOk: true,
    });
    expect(calls).toContainEqual(["submit", ["command-buffer"]]);
  });

  it("reports map failures after the clear command is submitted", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoder(calls),
        buffer: mappedBuffer([0, 0, 0, 255], calls, async () => {
          throw new Error("map denied");
        }),
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 8,
      height: 8,
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: false,
      reason: "readback-map-failed",
      clearOk: true,
    });
    expect(result.readback.ok).toBe(false);

    if (result.readback.ok) {
      throw new Error("Expected readback to fail.");
    }

    expect(result.readback.message).toContain("map denied");
    expect(calls).toContainEqual(["submit", ["command-buffer"]]);
  });

  it("reports mapped range failures without rejecting the clear result", async () => {
    const calls: unknown[] = [];
    const result = await clearWebGpuCanvasWithReadback({
      device: recordingDevice({
        calls,
        encoder: recordingEncoder(calls),
        buffer: {
          mapAsync: async () => {},
          getMappedRange: () => {
            throw new Error("range denied");
          },
          unmap: () => calls.push(["unmap"]),
        },
      }),
      context: fakeContext({ createView: () => "view" }),
      format: "rgba8unorm",
      width: 8,
      height: 8,
      bufferUsage: { mapRead: 1, copyDst: 8 },
      mapModeRead: 1,
    });

    expect(result.clear.ok).toBe(true);
    expect(result.readback).toMatchObject({
      ok: false,
      reason: "mapped-range-unavailable",
      clearOk: true,
    });
    expect(calls).toContainEqual(["unmap"]);
  });
});

function fakeContext(texture: { createView?: () => unknown }) {
  return {
    configure: () => {},
    getCurrentTexture: () => texture,
  };
}

function recordingDevice(options: {
  readonly calls: unknown[];
  readonly encoder: WebGpuReadbackCommandEncoderLike;
  readonly buffer: WebGpuClearReadbackBufferLike;
}): WebGpuClearReadbackDeviceLike {
  return {
    queue: {
      submit: (commandBuffers) =>
        options.calls.push(["submit", commandBuffers]),
    },
    createCommandEncoder: () => options.encoder,
    createBuffer: (descriptor) => {
      options.calls.push(["createBuffer", descriptor]);
      return options.buffer;
    },
  };
}

function recordingEncoder(calls: unknown[]): WebGpuReadbackCommandEncoderLike {
  return {
    beginRenderPass: (descriptor) => {
      calls.push(["beginRenderPass", descriptor]);
      return {
        end: () => calls.push(["end"]),
      };
    },
    copyTextureToBuffer: (source, destination, copySize) => {
      calls.push(["copyTextureToBuffer", source, destination, copySize]);
    },
    finish: () => {
      calls.push(["finish"]);
      return "command-buffer";
    },
  };
}

function recordingEncoderWithoutCopy(
  calls: unknown[],
): WebGpuReadbackCommandEncoderLike {
  return {
    beginRenderPass: (descriptor) => {
      calls.push(["beginRenderPass", descriptor]);
      return {
        end: () => calls.push(["end"]),
      };
    },
    finish: () => {
      calls.push(["finish"]);
      return "command-buffer";
    },
  };
}

function mappedBuffer(
  bytes: readonly number[],
  calls: unknown[],
  mapAsync: (mode: number) => Promise<void> = async () => {},
): WebGpuClearReadbackBufferLike {
  return {
    mapAsync: async (mode) => {
      calls.push(["mapAsync", mode]);
      await mapAsync(mode);
    },
    getMappedRange: () => {
      calls.push(["getMappedRange"]);
      return Uint8Array.from(bytes);
    },
    unmap: () => calls.push(["unmap"]),
  };
}
