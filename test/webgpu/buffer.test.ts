import { describe, expect, it } from "vitest";

import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("WebGPU buffer creation boundary", () => {
  it("creates buffers through an injected device", () => {
    const created: unknown[] = [];
    const buffer = { label: "buffer" };
    const device: WebGpuBufferDeviceLike = {
      createBuffer: (descriptor) => {
        created.push(descriptor);
        return buffer;
      },
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: {
          label: "vertices",
          size: 64,
          usage: 1,
          mappedAtCreation: true,
        },
      }),
    ).toEqual({ ok: true, buffer });
    expect(created).toEqual([
      {
        label: "vertices",
        size: 64,
        usage: 1,
        mappedAtCreation: true,
      },
    ]);
  });

  it("uploads initial data after creating the buffer", () => {
    const events: string[] = [];
    const buffer = { label: "buffer" };
    const data = new Uint8Array([1, 2, 3, 4]);
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (target, offset, source, dataOffset, size) => {
          events.push(
            `write:${target === buffer}:${offset}:${source.byteLength}:${dataOffset}:${size}`,
          );
        },
      },
      createBuffer: () => {
        events.push("create");
        return buffer;
      },
    };

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 8, usage: 2, initialData: data },
      }),
    ).toEqual({ ok: true, buffer });
    expect(events).toEqual(["create", "write:true:0:4:0:4"]);
  });

  it("reports invalid sizes and empty initial data", () => {
    const device = fakeDevice();

    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 0, usage: 1 },
      }),
    ).toMatchObject({ ok: false, reason: "invalid-size" });
    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 4, usage: 1, initialData: new Uint8Array(0) },
      }),
    ).toMatchObject({ ok: false, reason: "empty-initial-data" });
    expect(
      createWebGpuBuffer({
        device,
        descriptor: { size: 2, usage: 1, initialData: new Uint8Array(4) },
      }),
    ).toMatchObject({ ok: false, reason: "invalid-size" });
  });

  it("reports missing buffer creation and upload support", () => {
    expect(
      createWebGpuBuffer({
        device: {},
        descriptor: { size: 4, usage: 1 },
      }),
    ).toMatchObject({ ok: false, reason: "create-buffer-unavailable" });
    expect(
      createWebGpuBuffer({
        device: { createBuffer: () => ({}) },
        descriptor: { size: 4, usage: 1, initialData: new Uint8Array(4) },
      }),
    ).toMatchObject({ ok: false, reason: "queue-write-buffer-unavailable" });
  });
});

function fakeDevice(): WebGpuBufferDeviceLike {
  return {
    queue: { writeBuffer: () => {} },
    createBuffer: () => ({}),
  };
}
