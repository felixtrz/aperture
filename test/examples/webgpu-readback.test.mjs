import { afterEach, describe, expect, it } from "vitest";

import {
  copyCurrentTextureReadbackSamples,
  initializeWebGpuWithOptionalReadbackUsage,
  mapCurrentTextureReadbackSamples,
  markReadbackClearOk,
} from "../../examples/webgpu-readback.js";

const originalGPUBufferUsage = globalThis.GPUBufferUsage;
const originalGPUMapMode = globalThis.GPUMapMode;

describe("browser WebGPU readback helper", () => {
  afterEach(() => {
    setGlobalWebGpuConstants(originalGPUBufferUsage, originalGPUMapMode);
  });

  it("falls back to normal initialization when COPY_SRC canvas configuration fails", async () => {
    const calls = [];
    const aperture = {
      createReadbackCanvasTextureUsage: () => ({ ok: true, usage: 17 }),
      initializeWebGpu: async (options) => {
        calls.push(options);

        return options.textureUsage === 17
          ? {
              ok: false,
              reason: "context-configure-failed",
              message: "usage denied",
            }
          : { ok: true, mode: "fallback" };
      },
    };

    await expect(
      initializeWebGpuWithOptionalReadbackUsage({
        aperture,
        canvas: "canvas",
      }),
    ).resolves.toEqual({
      initialized: { ok: true, mode: "fallback" },
      readbackUsage: {
        ok: false,
        reason: "texture-usage-unavailable",
        message: "WebGPU canvas COPY_SRC configuration failed: usage denied",
      },
    });
    expect(calls).toEqual([
      { canvas: "canvas", textureUsage: 17 },
      { canvas: "canvas" },
    ]);
  });

  it("copies current-texture samples into JSON-safe mapped pixels", async () => {
    setGlobalWebGpuConstants({ MAP_READ: 1, COPY_DST: 8 }, { READ: 1 });

    const calls = [];
    const texture = { label: "texture" };
    const buffers = [
      mappedBuffer([3, 2, 1, 255], calls),
      mappedBuffer([6, 5, 4, 255], calls),
    ];
    const plan = copyCurrentTextureReadbackSamples({
      device: {
        createBuffer: (descriptor) => {
          calls.push(["createBuffer", descriptor]);
          return buffers.shift();
        },
      },
      encoder: {
        copyTextureToBuffer: (source, destination, copySize) => {
          calls.push(["copyTextureToBuffer", source, destination, copySize]);
        },
      },
      texture,
      format: "bgra8unorm",
      width: 100,
      height: 50,
      samples: [
        { id: "left", x: 0.25, y: 0.5 },
        { id: "right", x: 0.75, y: 0.5 },
      ],
    });

    expect(plan).toMatchObject({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
      bytesPerRow: 256,
    });
    expect(calls).toContainEqual([
      "copyTextureToBuffer",
      { texture, origin: { x: 25, y: 25, z: 0 } },
      expect.objectContaining({ bytesPerRow: 256, rowsPerImage: 1 }),
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    ]);

    await expect(mapCurrentTextureReadbackSamples(plan)).resolves.toEqual({
      ok: true,
      source: "current-texture",
      format: "bgra8unorm",
      bytesPerRow: 256,
      samples: [
        {
          id: "left",
          origin: { x: 25, y: 25 },
          pixel: { r: 1, g: 2, b: 3, a: 255 },
        },
        {
          id: "right",
          origin: { x: 75, y: 25 },
          pixel: { r: 4, g: 5, b: 6, a: 255 },
        },
      ],
    });
  });

  it("reports missing buffer usage flags as a readback diagnostic", () => {
    setGlobalWebGpuConstants(undefined, { READ: 1 });

    expect(
      copyCurrentTextureReadbackSamples({
        device: {},
        encoder: {},
        texture: {},
        format: "rgba8unorm",
        width: 1,
        height: 1,
        samples: [{ id: "center", x: 0, y: 0 }],
      }),
    ).toMatchObject({
      ok: false,
      reason: "buffer-usage-unavailable",
      clearOk: false,
    });
  });

  it("reports missing texture-copy support as a readback diagnostic", () => {
    setGlobalWebGpuConstants({ MAP_READ: 1, COPY_DST: 8 }, { READ: 1 });

    expect(
      copyCurrentTextureReadbackSamples({
        device: {
          createBuffer: () => mappedBuffer([0, 0, 0, 255], []),
        },
        encoder: {},
        texture: {},
        format: "rgba8unorm",
        width: 1,
        height: 1,
        samples: [{ id: "center", x: 0, y: 0 }],
      }),
    ).toMatchObject({
      ok: false,
      reason: "copy-texture-to-buffer-unavailable",
      clearOk: false,
    });
  });

  it("reports thrown texture-copy failures as readback diagnostics", () => {
    setGlobalWebGpuConstants({ MAP_READ: 1, COPY_DST: 8 }, { READ: 1 });

    expect(
      copyCurrentTextureReadbackSamples({
        device: {
          createBuffer: () => mappedBuffer([0, 0, 0, 255], []),
        },
        encoder: {
          copyTextureToBuffer: () => {
            throw new Error("copy denied");
          },
        },
        texture: {},
        format: "rgba8unorm",
        width: 1,
        height: 1,
        samples: [{ id: "center", x: 0, y: 0 }],
      }),
    ).toMatchObject({
      ok: false,
      reason: "copy-texture-to-buffer-unavailable",
      clearOk: false,
      message: "WebGPU current-texture copy failed: copy denied",
    });
  });

  it("marks readback failures with the final clear status", () => {
    expect(
      markReadbackClearOk(
        { ok: false, reason: "map-mode-unavailable", message: "missing" },
        true,
      ),
    ).toEqual({
      ok: false,
      reason: "map-mode-unavailable",
      message: "missing",
      clearOk: true,
    });
  });
});

function mappedBuffer(bytes, calls) {
  return {
    mapAsync: async (mode) => calls.push(["mapAsync", mode]),
    getMappedRange: () => Uint8Array.from(bytes),
    unmap: () => calls.push(["unmap"]),
  };
}

function setGlobalWebGpuConstants(bufferUsage, mapMode) {
  Object.defineProperty(globalThis, "GPUBufferUsage", {
    configurable: true,
    value: bufferUsage,
  });
  Object.defineProperty(globalThis, "GPUMapMode", {
    configurable: true,
    value: mapMode,
  });
}
